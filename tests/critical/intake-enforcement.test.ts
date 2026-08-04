// Critical: intake enforcement lives in the database, not the API. These run
// on every commit. Each case runs inside a transaction that is always rolled
// back, so the suite is safe to run against the seeded engagement.
import { describe, it, expect } from "vitest";
import { withPgClient } from "../../lib/db/pg";

const ENG = "00000000-0000-0000-0000-0000000000e1"; // seeded Meridian engagement

// Runs a callback against a fresh transaction; rolls back no matter what.
// Returns whether the callback threw (used to assert acceptance vs rejection).
async function threwInTx(body: (q: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<void>): Promise<boolean> {
  return withPgClient(async (client) => {
    await client.query("begin");
    let threw = false;
    try {
      await body((sql, params) => client.query(sql, params));
    } catch {
      threw = true;
    }
    await client.query("rollback");
    return threw;
  });
}

describe("intake enforcement (DB constraint triggers)", () => {
  it("rejects a signal with no source", async () => {
    const threw = await threwInTx(async (q) => {
      await q("insert into node (engagement_id,type,label) values ($1,'signal','unsourced claim')", [ENG]);
      // Triggers are DEFERRABLE INITIALLY DEFERRED; force the check to fire now.
      await q("set constraints all immediate");
    });
    expect(threw).toBe(true);
  });

  it("rejects an insight with no supporting signal", async () => {
    const threw = await threwInTx(async (q) => {
      await q("insert into node (engagement_id,type,label) values ($1,'insight','uncited opinion')", [ENG]);
      await q("set constraints all immediate");
    });
    expect(threw).toBe(true);
  });

  it("accepts a signal inserted with its source in the same transaction", async () => {
    const threw = await threwInTx(async (q) => {
      const res = (await q(
        "insert into node (engagement_id,type,label) values ($1,'signal','sourced fact') returning id",
        [ENG],
      )) as { rows: { id: string }[] };
      await q(
        "insert into signal_source (node_id,kind,uri,published_at,excerpt) values ($1,'web','https://x.test','2026-01-01','ok')",
        [res.rows[0].id],
      );
      await q("set constraints all immediate");
    });
    expect(threw).toBe(false);
  });
});
