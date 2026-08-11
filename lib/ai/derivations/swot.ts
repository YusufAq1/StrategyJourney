import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callWithTool, type ToolTool } from "../service";
import { getEngagement, listCapabilityCells, listSignals } from "../../graph/reads";
import { CURRENT_USER_ID } from "../../constants";

// Prompt lives in the versioned file (CLAUDE.md §13) — loaded, never inlined.
const PROMPT_PATH = path.join(process.cwd(), "prompts", "swot-derivation.v1.md");
const PROMPT_TEMPLATE_ID = "swot-derivation";
const PROMPT_VERSION = "v1";
const MODEL = "claude-sonnet-5";

type EmittedItem = {
  quadrant: "strength" | "weakness" | "opportunity" | "threat";
  statement: string;
  rationale: string;
  evidence_node_ids: string[];
  rank: number;
};
type EmitSwot = { items: EmittedItem[]; coverage_gaps: string[] };

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
        if (o.name === "emit_swot") tool = o as unknown as ToolTool;
      } catch {
        /* not the tool block */
      }
    }
  }
  const system = fences.find((f) => f.lang === "" && f.body.includes("DERIVATION RULES"))?.body.trim();
  if (!tool || !system) throw new Error("could not load emit_swot tool / system prompt from prompt file");
  return { system, tool };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// Statements and evidence-id sets of currently-live (non-deleted) swot_items,
// so a re-derive doesn't pile new items on top of ones already covering the
// same fact — there is no replace-on-regenerate step in derive_swot_apply, so
// this is the only thing standing between "Re-derive SWOT" and an ever-growing
// pile of restatements.
async function loadExisting(db: SupabaseClient, engagementId: string): Promise<{ statements: Set<string>; evidenceSets: Set<string> }> {
  const { data: rows, error } = await db
    .from("node")
    .select("id,label,swot_item!inner(deleted_at)")
    .eq("engagement_id", engagementId)
    .eq("type", "swot_item")
    .is("swot_item.deleted_at", null);
  if (error) throw new Error(`loadExisting swot nodes: ${error.message}`);

  const items = (rows ?? []) as { id: string; label: string }[];
  const statements = new Set(items.map((r) => normalize(r.label)));

  const evidenceSets = new Set<string>();
  const ids = items.map((r) => r.id);
  if (ids.length > 0) {
    const { data: edges, error: e2 } = await db
      .from("edge")
      .select("from_node,to_node")
      .eq("type", "derives_from")
      .in("to_node", ids);
    if (e2) throw new Error(`loadExisting swot evidence: ${e2.message}`);
    const byItem = new Map<string, string[]>();
    for (const e of (edges ?? []) as { from_node: string; to_node: string }[]) {
      const list = byItem.get(e.to_node) ?? [];
      list.push(e.from_node);
      byItem.set(e.to_node, list);
    }
    for (const list of byItem.values()) evidenceSets.add([...list].sort().join(","));
  }

  return { statements, evidenceSets };
}

export type DeriveResult = {
  applied: number;
  rejected: number;
  coverageGaps: string[];
};

export async function deriveSwot(db: SupabaseClient, engagementId: string, runId?: string | null): Promise<DeriveResult> {
  const [eng, caps, signals, prompt, existing] = await Promise.all([
    getEngagement(db, engagementId),
    listCapabilityCells(db, engagementId),
    listSignals(db, engagementId),
    loadPrompt(),
    loadExisting(db, engagementId),
  ]);

  const input = {
    engagement: { clientName: eng.orgName, horizon: eng.horizon, keyQuestions: eng.keyQuestions },
    capabilities: caps.map((c) => ({
      nodeId: c.nodeId,
      label: c.label,
      criticality: c.criticality,
      maturityCurrent: c.maturityCurrent,
      maturityRequired: c.maturityRequired,
      gapWeighted: c.gapWeighted,
      contested: c.contested,
    })),
    signals: signals.map((s) => ({
      nodeId: s.id,
      dimension: s.dimension ?? "",
      label: s.label,
      excerpt: s.source?.excerpt ?? "",
      sourceRef: s.source?.uri ?? s.source?.reference ?? "",
      publishedAt: s.source?.publishedAt ?? "",
      credibility: s.source?.credibility ?? 3,
    })),
  };

  const known = new Set<string>([...input.capabilities.map((c) => c.nodeId), ...input.signals.map((s) => s.nodeId)]);

  const { input: emitted, tokensIn, tokensOut, model } = await callWithTool<EmitSwot>({
    model: MODEL,
    system: prompt.system,
    userInput: input,
    tool: prompt.tool,
  });

  // Post-processing — enforced in code, not trusted to the model. Pre-seeded
  // with what's already live so a re-derive doesn't restate it.
  const rejected: EmittedItem[] = [];
  const seen = new Set<string>(existing.statements);
  const seenEvidence = new Set<string>(existing.evidenceSets);
  const kept: EmittedItem[] = [];
  for (const it of emitted.items ?? []) {
    const ids = Array.isArray(it.evidence_node_ids) ? it.evidence_node_ids : [];
    if (ids.length < 1 || !ids.every((id) => known.has(id))) {
      rejected.push(it); // unknown or empty evidence → discard whole item
      continue;
    }
    const key = normalize(it.statement);
    if (seen.has(key)) continue; // dedupe across quadrants
    // Two items resting on the exact same evidence are the same underlying fact
    // restated — the model paraphrases these past the statement-text check above.
    const evidenceKey = [...ids].sort().join(",");
    if (seenEvidence.has(evidenceKey)) continue;
    seen.add(key);
    seenEvidence.add(evidenceKey);
    kept.push(it);
  }

  // Renumber ranks contiguously within each quadrant.
  const byQuad: Record<string, EmittedItem[]> = {};
  for (const it of kept) (byQuad[it.quadrant] ??= []).push(it);
  const applyItems = Object.values(byQuad).flatMap((items) =>
    [...items]
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .map((it, i) => ({
        quadrant: it.quadrant,
        statement: it.statement.slice(0, 400),
        rationale: it.rationale ?? "",
        evidence_node_ids: it.evidence_node_ids,
        rank: i + 1,
      })),
  );

  const { data, error } = await db.rpc("derive_swot_apply", {
    p_engagement_id: engagementId,
    p_items: applyItems,
    p_model: model,
    p_prompt_template_id: PROMPT_TEMPLATE_ID,
    p_prompt_version: PROMPT_VERSION,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
    p_created_by: CURRENT_USER_ID,
    p_output: { items: emitted.items, coverage_gaps: emitted.coverage_gaps, rejected },
    p_run_id: runId ?? null,
  });
  if (error) throw new Error(`derive_swot_apply: ${error.message}`);

  const created = (data as { created?: unknown[] } | null)?.created?.length ?? applyItems.length;
  return { applied: created, rejected: rejected.length, coverageGaps: emitted.coverage_gaps ?? [] };
}
