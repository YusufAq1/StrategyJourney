import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callWithTool, type ToolTool } from "../service";
import { getEngagement, listCapabilityCells, listSignals } from "../../graph/reads";
import { resolveBinding } from "../../graph/queries";
import type { SwotView, SwotItem } from "../../graph/queries/types";
import { CURRENT_USER_ID } from "../../constants";

const PROMPT_PATH = path.join(process.cwd(), "prompts", "option-generation.v1.md");
const PROMPT_TEMPLATE_ID = "option-generation";
const PROMPT_VERSION = "v1";
const MODEL = "claude-opus-5"; // CLAUDE.md §7: Opus 5, the hardest generative task
const RANK_RE = /\b(best|recommend|preferred|optimal|strongest option|we suggest)\b/i;

type Prereq = { capability_node_id: string; required_maturity: number; currently_held: boolean };
type EmittedOption = {
  label: string;
  vector: string;
  the_bet: string;
  prerequisite_capabilities: Prereq[];
  what_must_be_true: string;
  strongest_argument_against: string;
  evidence_node_ids: string[];
  open_questions?: string | null;
};
type EmitOptions = { options: EmittedOption[] };

function extractFences(md: string): { lang: string; body: string }[] {
  const out: { lang: string; body: string }[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push({ lang: m[1], body: m[2] });
  return out;
}
async function loadPrompt(): Promise<{ system: string; tool: ToolTool }> {
  const md = await readFile(PROMPT_PATH, "utf8");
  const fences = extractFences(md);
  let tool: ToolTool | null = null;
  for (const f of fences) {
    if (f.lang === "json") {
      try {
        const o = JSON.parse(f.body) as { name?: string };
        if (o.name === "emit_options") tool = o as unknown as ToolTool;
      } catch {
        /* not the tool block */
      }
    }
  }
  const system = fences.find((f) => f.lang === "" && f.body.includes("THE SPACE"))?.body.trim();
  if (!tool || !system) throw new Error("could not load emit_options tool / system prompt from prompt file");
  return { system, tool };
}

export type OptionsDeriveResult = { applied: number; rejected: number; vectors: number };

export async function generateOptions(db: SupabaseClient, engagementId: string, runId?: string | null): Promise<OptionsDeriveResult> {
  const [eng, caps, signals, swotRes, prompt] = await Promise.all([
    getEngagement(db, engagementId),
    listCapabilityCells(db, engagementId),
    listSignals(db, engagementId),
    resolveBinding("swot.derived()", { engagementId, db }),
    loadPrompt(),
  ]);
  const swot = (Object.values((swotRes.vm as SwotView).quadrants) as SwotItem[][]).flat();

  const capIds = new Set(caps.map((c) => c.nodeId));
  const knownIds = new Set<string>([...capIds, ...signals.map((s) => s.id), ...swot.map((s) => s.nodeId)]);

  const input = {
    engagement: { clientName: eng.orgName, horizon: eng.horizon, keyQuestions: eng.keyQuestions },
    swot: swot.map((s, i) => ({ nodeId: s.nodeId, quadrant: (s as SwotItem & { quadrant?: string }).quadrant ?? "", statement: s.statement, rank: s.rank ?? i + 1 })),
    capabilities: caps.map((c) => ({
      nodeId: c.nodeId,
      label: c.label,
      criticality: c.criticality,
      maturityCurrent: c.maturityCurrent,
      maturityRequired: c.maturityRequired,
    })),
    signals: signals.map((s) => ({ nodeId: s.id, dimension: s.dimension ?? "", label: s.label, excerpt: s.source?.excerpt ?? "" })),
  };

  type Kept = EmittedOption & { requires_new_capability: boolean };
  const runOnce = async (
    payload: unknown,
  ): Promise<{ kept: Kept[]; rejected: number; raw: EmittedOption[]; tokensIn: number; tokensOut: number; model: string }> => {
    const { input: emitted, tokensIn, tokensOut, model } = await callWithTool<EmitOptions>({
      model: MODEL,
      system: prompt.system,
      userInput: payload,
      tool: prompt.tool,
      maxTokens: 16000,
    });
    const kept: Kept[] = [];
    let rejected = 0;
    for (const o of emitted.options ?? []) {
      const evOk = Array.isArray(o.evidence_node_ids) && o.evidence_node_ids.length >= 1 && o.evidence_node_ids.every((id) => knownIds.has(id));
      const prereqs = Array.isArray(o.prerequisite_capabilities) ? o.prerequisite_capabilities : [];
      const preOk = prereqs.every((p) => capIds.has(p.capability_node_id));
      const rankFree = ![o.label, o.the_bet, o.what_must_be_true].some((t) => RANK_RE.test(t ?? ""));
      if (!evOk || !preOk || !rankFree) {
        rejected++;
        continue;
      }
      kept.push({ ...o, prerequisite_capabilities: prereqs, requires_new_capability: prereqs.some((p) => p.currently_held === false) });
    }
    return { kept, rejected, raw: emitted.options ?? [], tokensIn, tokensOut, model };
  };

  const distinctVectors = (opts: Kept[]) => new Set(opts.map((o) => o.vector)).size;

  let run = await runOnce(input);
  if (distinctVectors(run.kept) < 4) {
    run = await runOnce({
      ...input,
      constraint_violation: `Your previous set spanned only ${distinctVectors(run.kept)} distinct vectors after validation. Regenerate spanning at least 4 distinct vectors.`,
    });
    if (distinctVectors(run.kept) < 4) throw new Error(`option set spans only ${distinctVectors(run.kept)} vectors after one retry (need >=4)`);
  }
  if (run.kept.length < 5) throw new Error(`only ${run.kept.length} options survived post-processing (need >=5); minimum is a product guarantee`);
  if (!run.kept.some((o) => o.requires_new_capability)) throw new Error("no option requires an unheld capability — refusing an all-comfortable set");

  const applyOptions = run.kept.map((o) => ({
    label: o.label.slice(0, 60),
    vector: o.vector,
    the_bet: o.the_bet,
    prerequisite_capabilities: o.prerequisite_capabilities,
    what_must_be_true: o.what_must_be_true,
    strongest_argument_against: o.strongest_argument_against,
    open_questions: o.open_questions ?? null,
    requires_new_capability: o.requires_new_capability,
    evidence_node_ids: o.evidence_node_ids,
  }));

  const { data, error } = await db.rpc("generate_options_apply", {
    p_engagement_id: engagementId,
    p_options: applyOptions,
    p_model: run.model,
    p_prompt_template_id: PROMPT_TEMPLATE_ID,
    p_prompt_version: PROMPT_VERSION,
    p_tokens_in: run.tokensIn,
    p_tokens_out: run.tokensOut,
    p_created_by: CURRENT_USER_ID,
    p_output: { options: run.raw, rejected: run.rejected },
    p_run_id: runId ?? null,
  });
  if (error) throw new Error(`generate_options_apply: ${error.message}`);

  const applied = (data as { created?: unknown[] } | null)?.created?.length ?? applyOptions.length;
  return { applied, rejected: run.rejected, vectors: distinctVectors(run.kept) };
}
