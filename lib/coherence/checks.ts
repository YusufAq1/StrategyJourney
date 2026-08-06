import type { SupabaseClient } from "@supabase/supabase-js";
import { listCapabilityCells } from "../graph/reads";

// The Coherence Engine — deterministic checks only (CLAUDE.md §8). Registry
// keyed by id so C4-C10 slot in without refactoring. Each finding names its
// primary node; accepting one requires a note and writes a decision_log entry.
export type Finding = {
  checkId: string;
  primaryNodeId: string;
  nodeIds: string[];
  message: string;
  severity: "warning" | "error";
};
export type CheckCtx = { db: SupabaseClient; engagementId: string };
export type CoherenceCheck = {
  id: string;
  title: string;
  description: string;
  isDeterministic: boolean;
  run: (ctx: CheckCtx) => Promise<Finding[]>;
};

async function activeChoiceIds(db: SupabaseClient, eng: string): Promise<string[]> {
  const { data } = await db.from("node").select("id").eq("engagement_id", eng).eq("type", "choice").eq("status", "active");
  return ((data ?? []) as { id: string }[]).map((c) => c.id);
}

// C1 — every choice traces to at least one insight or SWOT item.
const C1: CoherenceCheck = {
  id: "C1",
  title: "Choices trace to insights or SWOT",
  description: "Every active choice must rest on at least one insight or SWOT item.",
  isDeterministic: true,
  async run({ db, engagementId }) {
    const { data: choices } = await db.from("node").select("id,label").eq("engagement_id", engagementId).eq("type", "choice").eq("status", "active");
    const rows = (choices ?? []) as { id: string; label: string }[];
    if (rows.length === 0) return [];
    const ids = rows.map((c) => c.id);
    const { data: edges } = await db.from("edge").select("from_node,to_node").in("to_node", ids);
    const es = (edges ?? []) as { from_node: string; to_node: string }[];
    const fromIds = [...new Set(es.map((e) => e.from_node))];
    const { data: fromNodes } = fromIds.length ? await db.from("node").select("id,type").in("id", fromIds) : { data: [] };
    const typeById: Record<string, string> = {};
    for (const n of (fromNodes ?? []) as { id: string; type: string }[]) typeById[n.id] = n.type;
    const grounded = new Set(es.filter((e) => ["insight", "swot_item"].includes(typeById[e.from_node])).map((e) => e.to_node));
    return rows
      .filter((c) => !grounded.has(c.id))
      .map((c) => ({ checkId: "C1", primaryNodeId: c.id, nodeIds: [c.id], message: `Choice "${c.label}" does not trace to any insight or SWOT item.`, severity: "error" as const }));
  },
};

// C2 — every insight cites at least one sourced, dated signal.
const C2: CoherenceCheck = {
  id: "C2",
  title: "Insights cite sourced signals",
  description: "Every insight must cite at least one signal that carries a resolvable source and date.",
  isDeterministic: true,
  async run({ db, engagementId }) {
    const { data: insights } = await db.from("node").select("id,label").eq("engagement_id", engagementId).eq("type", "insight");
    const rows = (insights ?? []) as { id: string; label: string }[];
    if (rows.length === 0) return [];
    const ids = rows.map((i) => i.id);
    const { data: edges } = await db.from("edge").select("from_node,to_node").eq("type", "supports").in("to_node", ids);
    const es = (edges ?? []) as { from_node: string; to_node: string }[];
    const fromIds = [...new Set(es.map((e) => e.from_node))];
    const { data: sigs } = fromIds.length
      ? await db.from("node").select("id, signal_source(node_id)").in("id", fromIds).eq("type", "signal")
      : { data: [] };
    const sourced = new Set(
      ((sigs ?? []) as { id: string; signal_source: unknown[] | null }[]).filter((s) => (s.signal_source?.length ?? 0) > 0).map((s) => s.id),
    );
    const cited = new Set(es.filter((e) => sourced.has(e.from_node)).map((e) => e.to_node));
    return rows
      .filter((i) => !cited.has(i.id))
      .map((i) => ({ checkId: "C2", primaryNodeId: i.id, nodeIds: [i.id], message: `Insight "${i.label}" does not cite a sourced, dated signal.`, severity: "error" as const }));
  },
};

// C3 — every capability below required maturity is addressed by the choice (a
// prerequisite of the chosen option, or edged to the choice) or explicitly
// accepted. Stand-in for the blueprint's C8 (needs PTW "how to win").
const C3: CoherenceCheck = {
  id: "C3",
  title: "Capability gaps addressed by the choice",
  description: "A capability below required maturity should be addressed by the choice, or the gap accepted with a note.",
  isDeterministic: true,
  async run({ db, engagementId }) {
    const below = (await listCapabilityCells(db, engagementId)).filter((c) => c.level === 2 && c.gap > 0);
    if (below.length === 0) return [];

    const addressed = new Set<string>();
    const choiceIds = await activeChoiceIds(db, engagementId);
    if (choiceIds.length > 0) {
      const { data: cf } = await db.from("edge").select("from_node").eq("type", "considered_for").in("to_node", choiceIds);
      const optIds = ((cf ?? []) as { from_node: string }[]).map((e) => e.from_node);
      if (optIds.length > 0) {
        const { data: ods } = await db.from("option_detail").select("prerequisite_capabilities").in("node_id", optIds);
        for (const od of (ods ?? []) as { prerequisite_capabilities: unknown }[]) {
          const arr = Array.isArray(od.prerequisite_capabilities) ? (od.prerequisite_capabilities as Record<string, unknown>[]) : [];
          for (const p of arr) if (p.capability_node_id) addressed.add(p.capability_node_id as string);
        }
      }
      const { data: ce } = await db.from("edge").select("from_node").in("to_node", choiceIds);
      for (const e of (ce ?? []) as { from_node: string }[]) addressed.add(e.from_node);
    }

    return below
      .filter((c) => !addressed.has(c.nodeId))
      .map((c) => ({
        checkId: "C3",
        primaryNodeId: c.nodeId,
        nodeIds: [c.nodeId],
        message: `Capability "${c.label}" is below required maturity (gap ${c.gap}, weighted ${c.gapWeighted}) but is not addressed by the current choice.`,
        severity: "warning" as const,
      }));
  },
};

export const CHECKS: CoherenceCheck[] = [C1, C2, C3];
export const CHECK_BY_ID: Record<string, CoherenceCheck> = Object.fromEntries(CHECKS.map((c) => [c.id, c]));
