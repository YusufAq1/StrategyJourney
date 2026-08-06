import { z } from "zod";
import { register, type GraphQuery, type QueryArgs, type QueryContext } from "./registry";
import type { SignalSummary } from "./types";
import { listSignals } from "../reads";

function host(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

// §3.2 — signals.summary(by=dimension). Establishes that everything downstream
// is sourced. Evidence = every exemplar node id.
export const signalsSummary: GraphQuery<SignalSummary> = {
  id: "signals.summary",
  args: z.object({ by: z.enum(["dimension"]).default("dimension") }).strict() as unknown as z.ZodType<QueryArgs>,

  async resolve(ctx: QueryContext): Promise<SignalSummary> {
    const signals = await listSignals(ctx.db, ctx.engagementId);
    const dates = signals.map((s) => s.source?.publishedAt).filter((d): d is string => Boolean(d)).sort();
    const dateRange = dates.length ? { earliest: dates[0], latest: dates[dates.length - 1] } : null;

    const groups: Record<string, typeof signals> = {};
    for (const s of signals) {
      const d = s.dimension ?? "unknown";
      (groups[d] ??= []).push(s);
    }

    const byDimension = Object.entries(groups)
      .map(([dimension, sigs]) => {
        const creds = sigs.map((s) => s.source?.credibility ?? 3);
        const meanCredibility = Math.round((creds.reduce((a, b) => a + b, 0) / creds.length) * 10) / 10;
        const exemplars = [...sigs]
          .sort((a, b) => (b.source?.credibility ?? 0) - (a.source?.credibility ?? 0))
          .slice(0, 2)
          .map((s) => ({
            nodeId: s.id,
            label: s.label,
            sourceRef: s.source?.uri ? host(s.source.uri) : (s.source?.reference ?? ""),
            publishedAt: s.source?.publishedAt ?? "",
          }));
        return { dimension, count: sigs.length, meanCredibility, exemplars };
      })
      .sort((a, b) => b.count - a.count);

    return { totalSignals: signals.length, dateRange, byDimension };
  },

  evidenceNodeIds: (vm) => vm.byDimension.flatMap((d) => d.exemplars.map((e) => e.nodeId)),
};

register(signalsSummary);
