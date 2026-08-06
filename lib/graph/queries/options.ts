import { z } from "zod";
import { register, type GraphQuery, type QueryArgs, type QueryContext } from "./registry";
import type { OptionsView, OptionCard } from "./types";

function firstOf<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : (x ?? undefined);
}

// §3.6 — options.all(). Order by created_at ONLY. No rank/score/preference —
// Rule 3 expressed as a ViewModel.
export const optionsAll: GraphQuery<OptionsView> = {
  id: "options.all",
  args: z.object({}).strict() as unknown as z.ZodType<QueryArgs>,

  async resolve(ctx: QueryContext): Promise<OptionsView> {
    const db = ctx.db;
    const { data: rows, error } = await db
      .from("node")
      .select(
        "id,label,payload,created_at, option_detail(the_bet,prerequisite_capabilities,what_must_be_true,strongest_argument_against,open_questions,requires_new_capability)",
      )
      .eq("engagement_id", ctx.engagementId)
      .eq("type", "option")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const optRows = (rows ?? []) as Record<string, unknown>[];
    const ids = optRows.map((r) => r.id as string);

    const evidenceByOpt: Record<string, string[]> = {};
    const selected = new Set<string>();
    if (ids.length > 0) {
      const { data: ev, error: e2 } = await db.from("edge").select("from_node,to_node").eq("type", "derives_from").in("to_node", ids);
      if (e2) throw new Error(e2.message);
      for (const e of (ev ?? []) as { from_node: string; to_node: string }[]) {
        (evidenceByOpt[e.to_node] ??= []).push(e.from_node);
      }
      const { data: cf, error: e3 } = await db.from("edge").select("from_node").eq("type", "considered_for").in("from_node", ids);
      if (e3) throw new Error(e3.message);
      for (const e of (cf ?? []) as { from_node: string }[]) selected.add(e.from_node);
    }

    const options: OptionCard[] = optRows.map((r) => {
      const od = (firstOf(r.option_detail as Record<string, unknown> | Record<string, unknown>[]) ?? {}) as Record<string, unknown>;
      const prereqs = Array.isArray(od.prerequisite_capabilities)
        ? (od.prerequisite_capabilities as Record<string, unknown>[])
        : [];
      return {
        nodeId: r.id as string,
        label: r.label as string,
        vector: ((r.payload as { vector?: string } | null) ?? {}).vector ?? null,
        theBet: (od.the_bet as string) ?? "",
        prerequisiteCapabilities: prereqs.map((p) => ({
          capabilityNodeId: p.capability_node_id as string,
          requiredMaturity: p.required_maturity as number,
          currentlyHeld: Boolean(p.currently_held),
        })),
        whatMustBeTrue: (od.what_must_be_true as string) ?? "",
        strongestArgumentAgainst: (od.strongest_argument_against as string) ?? "",
        requiresNewCapability: Boolean(od.requires_new_capability),
        openQuestions: (od.open_questions as string | null) ?? null,
        evidenceNodeIds: evidenceByOpt[r.id as string] ?? [],
        selected: selected.has(r.id as string),
      };
    });
    return { options };
  },

  evidenceNodeIds: (vm) => vm.options.flatMap((o) => [o.nodeId, ...o.evidenceNodeIds]),
};

register(optionsAll);
