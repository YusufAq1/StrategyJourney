// Renders slide 1 (cover) to an editable PPTX in ./out.
//   npm run deck:render
//
// It resolves engagement.meta() against the live graph when Supabase read
// access is available; otherwise it falls back to the seeded Meridian metadata
// so the deck still renders. Wiring the app's DB read path is build Step 3.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

import { renderDeck } from "../lib/deck/render";
import type { EngagementMeta } from "../lib/graph/queries/types";

const ENGAGEMENT_ID = "00000000-0000-0000-0000-0000000000e1";

// Temporary: mirrors supabase/seed.sql. Used only when a live read isn't wired.
const FIXTURE: EngagementMeta = {
  clientName: "Meridian Logistics",
  engagementName: "Meridian Growth Strategy 2027-2030",
  horizon: "3 years",
  keyQuestions: [
    "Where should Meridian compete as GCC trade lanes reconfigure?",
    "Can we defend mid-market share against digital-native forwarders?",
    "What must be true for a cross-border express tier to work?",
  ],
  generatedAt: new Date().toISOString(),
  stageCurrent: "C",
};

async function resolveMeta(): Promise<{ vm: EngagementMeta; source: string }> {
  try {
    const { createHumanClient } = await import("../lib/db/human");
    const { resolveBinding } = await import("../lib/graph/queries");
    const db = createHumanClient();
    const { vm } = await resolveBinding("engagement.meta()", { engagementId: ENGAGEMENT_ID, db });
    return { vm: vm as EngagementMeta, source: "live graph via engagement.meta()" };
  } catch (e) {
    console.warn(`[render-deck] live read unavailable (${(e as Error).message}); using seed fixture.`);
    return { vm: FIXTURE, source: "seed fixture (Meridian)" };
  }
}

async function main(): Promise<void> {
  const { vm, source } = await resolveMeta();
  const pptx = renderDeck([{ layoutId: "cover", vm }]);
  const outDir = path.resolve("out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "strategy-journey-cover.pptx");
  await pptx.writeFile({ fileName: outPath });
  console.log(`[render-deck] wrote ${outPath}  (data: ${source})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
