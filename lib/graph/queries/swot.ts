import { z } from "zod";
import { register, type GraphQuery, type QueryArgs, type QueryContext } from "./registry";
import type { SwotView, SwotItem, EvidenceRef, SwotQuadrant } from "./types";

// PostgREST returns a one-to-one embed (e.g. swot_item on its node PK) as a
// single object, but a one-to-many embed (signal_source) as an array. Normalise.
function firstOf<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined);
}

// §3.5 — swot.derived(). Excludes soft-deleted items; every item carries its
// contributing evidence nodes (via derives_from edges), so "why is that bullet
// here" works at bullet granularity.
export const swotDerived: GraphQuery<SwotView> = {
  id: "swot.derived",
  args: z.object({}).strict() as unknown as z.ZodType<QueryArgs>,

  async resolve(ctx: QueryContext): Promise<SwotView> {
    const db = ctx.db;
    const { data: rows, error } = await db
      .from("node")
      .select("id,label,payload,created_at, swot_item(quadrant,rank,deleted_at)")
      .eq("engagement_id", ctx.engagementId)
      .eq("type", "swot_item")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const all = (rows ?? []) as Record<string, unknown>[];
    const active = all.filter(
      (r) => (firstOf(r.swot_item as { deleted_at: string | null } | { deleted_at: string | null }[])?.deleted_at ?? null) === null,
    );
    const deletedCount = all.length - active.length;
    const ids = active.map((r) => r.id as string);

    const evidenceByItem: Record<string, string[]> = {};
    const evidenceIds = new Set<string>();
    if (ids.length > 0) {
      const { data: edges, error: e2 } = await db
        .from("edge")
        .select("from_node,to_node")
        .eq("type", "derives_from")
        .in("to_node", ids);
      if (e2) throw new Error(e2.message);
      for (const e of (edges ?? []) as { from_node: string; to_node: string }[]) {
        (evidenceByItem[e.to_node] ??= []).push(e.from_node);
        evidenceIds.add(e.from_node);
      }
    }

    const evNodes: Record<string, EvidenceRef> = {};
    if (evidenceIds.size > 0) {
      const { data: ev, error: e3 } = await db
        .from("node")
        .select("id,type,label, signal_source(uri,reference,published_at)")
        .in("id", [...evidenceIds]);
      if (e3) throw new Error(e3.message);
      for (const n of (ev ?? []) as Record<string, unknown>[]) {
        const src = firstOf(n.signal_source as Record<string, string | null> | Record<string, string | null>[]) ?? null;
        evNodes[n.id as string] = {
          nodeId: n.id as string,
          type: n.type === "signal" ? "signal" : "capability",
          label: n.label as string,
          sourceRef: src ? (src.uri ?? src.reference) : null,
          publishedAt: src?.published_at ?? null,
        };
      }
    }

    const quadrants: Record<SwotQuadrant, SwotItem[]> = { strength: [], weakness: [], opportunity: [], threat: [] };
    for (const r of active) {
      const si = firstOf(r.swot_item as { quadrant: SwotQuadrant; rank: number | null } | { quadrant: SwotQuadrant; rank: number | null }[]);
      if (!si) continue;
      const item: SwotItem = {
        nodeId: r.id as string,
        statement: r.label as string,
        rank: si.rank ?? null,
        rationale: ((r.payload as { rationale?: string } | null) ?? {}).rationale ?? null,
        evidence: (evidenceByItem[r.id as string] ?? []).map((id) => evNodes[id]).filter(Boolean),
      };
      quadrants[si.quadrant].push(item);
    }
    for (const q of Object.keys(quadrants) as SwotQuadrant[]) {
      quadrants[q].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    }
    return { quadrants, deletedCount };
  },

  evidenceNodeIds: (vm) =>
    (Object.values(vm.quadrants) as SwotItem[][]).flat().flatMap((i) => [i.nodeId, ...i.evidence.map((e) => e.nodeId)]),
};

register(swotDerived);
