// Background Function counterpart to derive-swot-background.mts — runs
// option generation (Opus 5, sometimes two sequential calls when the first
// pass doesn't span enough vectors), which needs even more headroom than SWOT
// derivation and would not survive a synchronous request/response cycle.
//
// The `-background` filename suffix is what puts Netlify into background mode
// (async invocation, up to 15 min, no response streamed back).
import { createHumanClient } from "../../lib/db/human";
import { generateOptions } from "../../lib/ai/derivations/options";

export default async (req: Request) => {
  const { engagementId, runId } = (await req.json()) as { engagementId?: string; runId?: string };
  if (!engagementId || !runId) return;

  const db = createHumanClient();
  try {
    await generateOptions(db, engagementId, runId);
  } catch (e) {
    await db.rpc("fail_ai_run", { p_run_id: runId, p_error: (e as Error).message });
  }
};
