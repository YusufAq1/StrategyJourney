import type { Client } from "pg";
import { withPgClient } from "./pg";

// The ai_service seam. Rule 3 (CLAUDE.md §2): the AI may create `option` and
// `swot_item` nodes but MUST NOT write a `choice` node or a `decision_log` row.
//
// That boundary is enforced in Postgres — role GRANTs + RLS policies in
// migration 0001 — NOT in this code. This helper's only job is to guarantee
// every AI-originated write executes *as* the ai_service role, so the database
// boundary actually applies. Never route AI writes through the human client.
export async function withAiServiceRole<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  return withPgClient(async (client) => {
    await client.query("set role ai_service");
    try {
      return await fn(client);
    } finally {
      await client.query("reset role").catch(() => {
        /* connection is closing anyway */
      });
    }
  });
}
