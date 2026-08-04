// One-off runner for the SWOT derivation (same path the "Derive SWOT" button
// uses). Persists AI-derived swot_item nodes via derive_swot_apply (as ai_service).
//   npx tsx scripts/derive-swot.ts
import { config } from "dotenv";
config({ path: ".env.local" });

const ENGAGEMENT_ID = "00000000-0000-0000-0000-0000000000e1";

async function main(): Promise<void> {
  const { createHumanClient } = await import("../lib/db/human");
  const { deriveSwot } = await import("../lib/ai/derivations/swot");
  const res = await deriveSwot(createHumanClient(), ENGAGEMENT_ID);
  console.log(`[derive-swot] applied=${res.applied} rejected=${res.rejected}`);
  if (res.coverageGaps.length) console.log(`[derive-swot] coverage gaps: ${res.coverageGaps.join("; ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
