// One-off runner for option generation (same path the "Generate options" button
// uses). Persists AI-generated option nodes via generate_options_apply (ai_service).
//   npx tsx scripts/generate-options.ts
import { config } from "dotenv";
config({ path: ".env.local" });

const ENGAGEMENT_ID = "00000000-0000-0000-0000-0000000000e1";

async function main(): Promise<void> {
  const { createHumanClient } = await import("../lib/db/human");
  const { generateOptions } = await import("../lib/ai/derivations/options");
  const res = await generateOptions(createHumanClient(), ENGAGEMENT_ID);
  console.log(`[generate-options] applied=${res.applied} rejected=${res.rejected} vectors=${res.vectors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
