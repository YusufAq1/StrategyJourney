import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callWithTool } from "../service";
import { loadPrompt, normalize } from "../prompt-loader";
import { getEngagement, listSignals } from "../../graph/reads";

// Propose-only (CLAUDE.md §14): suggest candidate insights from the engagement's
// existing signals. Nothing is written — an insight is created only when the
// human accepts it via create_insight (which writes the supports edges).
const PROMPT_PATH = path.join(process.cwd(), "prompts", "insight-suggestion.v1.md");
const PROMPT_TEMPLATE_ID = "insight-suggestion";
const PROMPT_VERSION = "v1";
const MODEL = "claude-sonnet-5";
const MAX_PROPOSALS = 15;

type EmittedInsight = { statement: string; signal_node_ids: string[]; confidence: number };
type EmitInsights = { insights: EmittedInsight[] };

export type SuggestResult = {
  proposals: { statement: string; signalNodeIds: string[]; confidence: number }[];
  signalLabels: Record<string, string>;
  runId: string | null;
};

export async function suggestInsights(db: SupabaseClient, engagementId: string): Promise<SuggestResult> {
  const [eng, signals, prompt] = await Promise.all([
    getEngagement(db, engagementId),
    listSignals(db, engagementId),
    loadPrompt(PROMPT_PATH, "emit_insights", "SUGGESTION RULES"),
  ]);

  if (signals.length === 0) throw new Error("Add some signals first — insights are suggested from them.");

  const known = new Set(signals.map((s) => s.id));
  const signalLabels: Record<string, string> = {};
  for (const s of signals) signalLabels[s.id] = s.label;

  const input = {
    engagement: { clientName: eng.orgName, industry: eng.industry, keyQuestions: eng.keyQuestions },
    signals: signals.map((s) => ({
      nodeId: s.id,
      dimension: s.dimension ?? "",
      label: s.label,
      excerpt: s.source?.excerpt ?? "",
    })),
  };

  const { input: emitted, tokensIn, tokensOut, model } = await callWithTool<EmitInsights>({
    model: MODEL,
    system: prompt.system,
    userInput: input,
    tool: prompt.tool,
  });

  // Post-processing — reject unknown ids, dedupe, clamp.
  const seen = new Set<string>();
  const proposals: SuggestResult["proposals"] = [];
  for (const it of emitted.insights ?? []) {
    const ids = Array.isArray(it.signal_node_ids) ? it.signal_node_ids.filter((id) => known.has(id)) : [];
    if (ids.length < 1) continue; // empty or all-unknown → discard
    const statement = (it.statement ?? "").trim();
    if (!statement) continue;
    const key = normalize(statement);
    if (seen.has(key)) continue;
    seen.add(key);
    proposals.push({
      statement: statement.slice(0, 300),
      signalNodeIds: [...new Set(ids)],
      confidence: Math.max(0, Math.min(1, Number(it.confidence) || 0.5)),
    });
    if (proposals.length >= MAX_PROPOSALS) break;
  }

  let runId: string | null = null;
  const { data } = await db.rpc("log_ai_run", {
    p_engagement_id: engagementId,
    p_purpose: "insight_suggestion",
    p_model: model,
    p_prompt_template_id: PROMPT_TEMPLATE_ID,
    p_prompt_version: PROMPT_VERSION,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
    p_output: { insights: emitted.insights ?? [], kept: proposals.length },
  });
  if (typeof data === "string") runId = data;

  return { proposals, signalLabels, runId };
}
