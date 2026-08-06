import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callWithTool } from "../service";
import { loadPrompt, normalize } from "../prompt-loader";
import { getEngagement } from "../../graph/reads";
import { DIMENSIONS } from "../../constants";

// Propose-only (CLAUDE.md §14): extract candidate signals from pasted source
// text. Nothing is written — the derivation returns proposals to the UI, and a
// signal is created only when the human accepts it via create_signal.
const PROMPT_PATH = path.join(process.cwd(), "prompts", "signal-extraction.v1.md");
const PROMPT_TEMPLATE_ID = "signal-extraction";
const PROMPT_VERSION = "v1";
const MODEL = "claude-sonnet-5";
const MAX_PROPOSALS = 20;

type EmittedSignal = {
  suggested_label: string;
  excerpt: string;
  dimension: string;
  suggested_credibility: number;
};
type EmitSignals = { signals: EmittedSignal[] };

export type ExtractResult = {
  proposals: { suggestedLabel: string; excerpt: string; dimension: string; suggestedCredibility: number }[];
  runId: string | null;
};

const DIM_SET = new Set<string>(DIMENSIONS as readonly string[]);

export async function extractSignals(db: SupabaseClient, engagementId: string, text: string): Promise<ExtractResult> {
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 20) throw new Error("Paste a bit more source text to extract from.");

  const [eng, prompt] = await Promise.all([getEngagement(db, engagementId), loadPrompt(PROMPT_PATH, "emit_signals", "EXTRACTION RULES")]);

  const input = {
    engagement: { clientName: eng.orgName, industry: eng.industry, keyQuestions: eng.keyQuestions },
    text: trimmed.slice(0, 20000),
  };

  const { input: emitted, tokensIn, tokensOut, model } = await callWithTool<EmitSignals>({
    model: MODEL,
    system: prompt.system,
    userInput: input,
    tool: prompt.tool,
  });

  // Post-processing — enforced here, not trusted to the model.
  const seen = new Set<string>();
  const proposals: ExtractResult["proposals"] = [];
  for (const s of emitted.signals ?? []) {
    const excerpt = (s.excerpt ?? "").trim();
    if (!excerpt || !DIM_SET.has(s.dimension)) continue;
    const key = normalize(excerpt);
    if (seen.has(key)) continue;
    seen.add(key);
    proposals.push({
      suggestedLabel: (s.suggested_label ?? "").slice(0, 120) || excerpt.slice(0, 120),
      excerpt: excerpt.slice(0, 1000),
      dimension: s.dimension,
      suggestedCredibility: Math.max(1, Math.min(5, Math.round(Number(s.suggested_credibility) || 3))),
    });
    if (proposals.length >= MAX_PROPOSALS) break;
  }

  // Log the AI call (propose-only path has no *_apply RPC).
  let runId: string | null = null;
  const { data } = await db.rpc("log_ai_run", {
    p_engagement_id: engagementId,
    p_purpose: "signal_extraction",
    p_model: model,
    p_prompt_template_id: PROMPT_TEMPLATE_ID,
    p_prompt_version: PROMPT_VERSION,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
    p_output: { signals: emitted.signals ?? [], kept: proposals.length },
  });
  if (typeof data === "string") runId = data;

  return { proposals, runId };
}
