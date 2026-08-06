import { z } from "zod";
import { register, type GraphQuery, type QueryArgs, type QueryContext } from "./registry";
import type { EngagementMeta } from "./types";

// docs/graph-queries.md §3.1 — engagement.meta(). Metadata, not a claim, so
// evidenceNodeIds is []. Reads only.
export const engagementMeta: GraphQuery<EngagementMeta> = {
  id: "engagement.meta",
  args: z.object({}).strict() as unknown as z.ZodType<QueryArgs>,

  async resolve(ctx: QueryContext): Promise<EngagementMeta> {
    const { data, error } = await ctx.db
      .from("engagement")
      .select("org_name,name,industry,horizon,key_questions,stage_current")
      .eq("id", ctx.engagementId)
      .single();
    if (error) throw new Error(`engagement.meta: ${error.message}`);

    const kq = (data as { key_questions: unknown }).key_questions;
    return {
      clientName: (data as { org_name: string }).org_name,
      engagementName: (data as { name: string }).name,
      industry: (data as { industry: string | null }).industry ?? null,
      horizon: (data as { horizon: string | null }).horizon,
      keyQuestions: Array.isArray(kq) ? (kq as string[]) : [],
      generatedAt: new Date().toISOString(),
      stageCurrent: (data as { stage_current: string }).stage_current,
    };
  },

  evidenceNodeIds: () => [],
};

register(engagementMeta);
