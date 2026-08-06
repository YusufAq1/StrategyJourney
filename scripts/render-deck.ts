// Renders the full deck (spec-driven, from slide_spec) to an editable PPTX in
// ./out, plus the portal-identical heatmap SVG.  npm run deck:render
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

import { renderDeck } from "../lib/deck/render";
import { composeDeck } from "../lib/deck/compose";
import { heatmapSvg } from "../lib/charts/heatmap";
import { resolveBinding } from "../lib/graph/queries";
import type { CapabilityHeatmap } from "../lib/graph/queries/types";

const ENGAGEMENT_ID = "00000000-0000-0000-0000-0000000000e1";

async function main(): Promise<void> {
  const { createHumanClient } = await import("../lib/db/human");
  const db = createHumanClient();

  const { slides, report } = await composeDeck(db, ENGAGEMENT_ID);
  const started = Date.now();
  const pptx = renderDeck(slides);
  const outDir = path.resolve("out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "strategy-journey-deck.pptx");
  await pptx.writeFile({ fileName: outPath });
  const ms = Date.now() - started;

  const heatmap = await resolveBinding("capabilities.heatmap(level=2, colour_by=gap)", { engagementId: ENGAGEMENT_ID, db });
  await writeFile(path.join(outDir, "heatmap.svg"), heatmapSvg(heatmap.vm as CapabilityHeatmap), "utf8");

  console.log(`[render-deck] wrote ${outPath} — ${slides.length} slides in ${ms}ms`);
  for (const r of report) console.log(`  slide ${r.ordinal} ${r.layoutId.padEnd(18)} ${r.status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
