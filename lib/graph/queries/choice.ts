import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { register, type GraphQuery, type QueryArgs, type QueryContext } from "./registry";
import type { ChoiceView } from "./types";

// Nullable read for the portal (empty state before a choice is made).
export async function getChoiceView(db: SupabaseClient, engagementId: string): Promise<ChoiceView | null> {
  const { data: choiceRows, error } = await db
    .from("node")
    .select("id,label,created_at")
    .eq("engagement_id", engagementId)
    .eq("type", "choice")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const choice = (choiceRows ?? [])[0] as { id: string; label: string; created_at: string } | undefined;
  if (!choice) return null;

  const { data: dl } = await db
    .from("decision_log")
    .select("decision,rationale,alternatives_considered,revisit_trigger,decided_at,decided_by")
    .eq("choice_node_id", choice.id)
    .order("decided_at", { ascending: false })
    .limit(1);
  const d = (dl ?? [])[0] as
    | { rationale: string; alternatives_considered: unknown; revisit_trigger: string | null; decided_at: string; decided_by: string }
    | undefined;

  let deciderName = "—";
  if (d?.decided_by) {
    const { data: u } = await db.from("app_user").select("display_name").eq("id", d.decided_by).maybeSingle();
    deciderName = (u as { display_name?: string } | null)?.display_name ?? deciderName;
  }

  const { data: edges } = await db.from("edge").select("from_node").eq("type", "derives_from").eq("to_node", choice.id);
  const traceIds = ((edges ?? []) as { from_node: string }[]).map((e) => e.from_node);
  let tracesTo: ChoiceView["tracesTo"] = [];
  if (traceIds.length > 0) {
    const { data: tn } = await db.from("node").select("id,type,label").in("id", traceIds);
    tracesTo = ((tn ?? []) as { id: string; type: string; label: string }[])
      .filter((n) => n.type === "insight" || n.type === "swot_item")
      .map((n) => ({ nodeId: n.id, type: n.type as "insight" | "swot_item", label: n.label }));
  }

  return {
    nodeId: choice.id,
    statement: choice.label,
    decidedBy: deciderName,
    decidedAt: d?.decided_at ?? choice.created_at,
    rationale: d?.rationale ?? "",
    alternativesConsidered: Array.isArray(d?.alternatives_considered)
      ? (d!.alternatives_considered as { label: string; whyNot: string }[])
      : [],
    revisitTrigger: d?.revisit_trigger ?? null,
    tracesTo,
  };
}

// §3.7 — choice.selected(). Throws if no active choice: a deck cannot be
// rendered before a choice is made, and failing loudly is correct.
export const choiceSelected: GraphQuery<ChoiceView> = {
  id: "choice.selected",
  args: z.object({}).strict() as unknown as z.ZodType<QueryArgs>,
  async resolve(ctx: QueryContext): Promise<ChoiceView> {
    const v = await getChoiceView(ctx.db, ctx.engagementId);
    if (!v) throw new Error("choice.selected: no active choice — make one before rendering the deck");
    return v;
  },
  evidenceNodeIds: (vm) => [vm.nodeId, ...vm.tracesTo.map((t) => t.nodeId)],
};

register(choiceSelected);
