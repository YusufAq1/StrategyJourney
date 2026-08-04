import { z } from "zod";
import { register, type GraphQuery, type QueryArgs, type QueryContext } from "./registry";
import type { CapabilityCell, CapabilityHeatmap, CapabilityGaps } from "./types";
import { listCapabilityCells } from "../reads";

function colourValueFor(cell: CapabilityCell, colourBy: string): number {
  if (colourBy === "maturity_current") return cell.maturityCurrent;
  if (colourBy === "criticality") return cell.criticality;
  return cell.gap; // default
}

// §3.3 — capabilities.heatmap(level=2, colour_by=gap)
export const capabilitiesHeatmap: GraphQuery<CapabilityHeatmap> = {
  id: "capabilities.heatmap",
  args: z
    .object({
      level: z.coerce.number().int().min(1).max(3).default(2),
      colour_by: z.enum(["gap", "maturity_current", "criticality"]).default("gap"),
    })
    .strict() as unknown as z.ZodType<QueryArgs>,

  async resolve(ctx: QueryContext, args: QueryArgs): Promise<CapabilityHeatmap> {
    const level = (args.level as number) ?? 2;
    const colourBy = (args.colour_by as string) ?? "gap";
    const all = await listCapabilityCells(ctx.db, ctx.engagementId);
    const cells = all
      .filter((c) => c.level === level)
      .map((c) => ({ ...c, colourValue: colourValueFor(c, colourBy) }))
      .sort((a, b) => b.gapWeighted - a.gapWeighted);

    // Fixed, meaningful scale so colour is stable across engagements and edits.
    const scale =
      colourBy === "gap"
        ? { min: 0, max: 4, midpoint: 2 }
        : { min: 1, max: 5, midpoint: 3 };
    return { cells, scale };
  },

  evidenceNodeIds: (vm) => vm.cells.map((c) => c.nodeId),
};

// §3.4 — capabilities.gaps(top=8). Same cell shape, sorted by gapWeighted desc.
export const capabilitiesGaps: GraphQuery<CapabilityGaps> = {
  id: "capabilities.gaps",
  args: z
    .object({ top: z.coerce.number().int().min(1).max(15).default(8) })
    .strict() as unknown as z.ZodType<QueryArgs>,

  async resolve(ctx: QueryContext, args: QueryArgs): Promise<CapabilityGaps> {
    const top = (args.top as number) ?? 8;
    const all = await listCapabilityCells(ctx.db, ctx.engagementId);
    const assessable = all.filter((c) => c.level === 2);
    const sorted = [...assessable].sort((a, b) => b.gapWeighted - a.gapWeighted);
    return {
      gaps: sorted.slice(0, top),
      totalAssessed: assessable.length,
      totalBelowRequired: assessable.filter((c) => c.gap > 0).length,
    };
  },

  evidenceNodeIds: (vm) => vm.gaps.map((c) => c.nodeId),
};

register(capabilitiesHeatmap);
register(capabilitiesGaps);
