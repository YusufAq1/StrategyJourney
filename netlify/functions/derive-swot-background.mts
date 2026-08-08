// Background Function (up to 15 min, no response expected by the caller) —
// runs the actual Sonnet 5 SWOT derivation, which routinely exceeds Netlify's
// synchronous function limit (10s free / 26s paid). deriveSwotAction just
// starts an ai_run row and triggers this; the swot page polls that row.
//
// The `-background` filename suffix is what puts Netlify into background mode
// (async invocation, up to 15 min, no response streamed back).
import { createHumanClient } from "../../lib/db/human";
import { deriveSwot } from "../../lib/ai/derivations/swot";

export default async (req: Request) => {
  const { engagementId, runId } = (await req.json()) as { engagementId?: string; runId?: string };
  if (!engagementId || !runId) return;

  const db = createHumanClient();
  try {
    await deriveSwot(db, engagementId, runId);
  } catch (e) {
    await db.rpc("fail_ai_run", { p_run_id: runId, p_error: (e as Error).message });
  }
};
