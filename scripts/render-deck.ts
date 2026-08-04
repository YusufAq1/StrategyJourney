// Renders the deck (cover + capability heatmap + priority gaps) to an editable
// PPTX in ./out, resolving each slide's data_binding against the live graph.
//   npm run deck:render
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

import { renderDeck, type SlideInput } from "../lib/deck/render";
import { heatmapSvg } from "../lib/charts/heatmap";
import type { EngagementMeta, CapabilityHeatmap, CapabilityGaps, SwotView } from "../lib/graph/queries/types";

const ENGAGEMENT_ID = "00000000-0000-0000-0000-0000000000e1";

async function main(): Promise<void> {
  const { createHumanClient } = await import("../lib/db/human");
  const { resolveBinding } = await import("../lib/graph/queries");
  const ctx = { engagementId: ENGAGEMENT_ID, db: createHumanClient() };

  const cover = await resolveBinding("engagement.meta()", ctx);
  const heatmap = await resolveBinding("capabilities.heatmap(level=2, colour_by=gap)", ctx);
  const gaps = await resolveBinding("capabilities.gaps(top=8)", ctx);
  const swot = await resolveBinding("swot.derived()", ctx);

  const slides: SlideInput[] = [
    { layoutId: "cover", vm: cover.vm as EngagementMeta },
    { layoutId: "heatmap_full", title: "Business capability heatmap", vm: heatmap.vm as CapabilityHeatmap },
    { layoutId: "ranked_list", title: "Priority capability gaps", vm: gaps.vm as CapabilityGaps },
    { layoutId: "quad_grid", title: "SWOT", vm: swot.vm as SwotView },
  ];

  const pptx = renderDeck(slides);
  const outDir = path.resolve("out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "strategy-journey-deck.pptx");
  await pptx.writeFile({ fileName: outPath });

  // Also emit the portal-identical heatmap SVG (same layout model) for preview.
  await writeFile(path.join(outDir, "heatmap.svg"), heatmapSvg(heatmap.vm as CapabilityHeatmap), "utf8");

  console.log(`[render-deck] wrote ${outPath} — ${slides.length} slides, data from live graph`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
