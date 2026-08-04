// Critical: Rule 3, the commercial line of the whole product. The ai_service
// role can create option/swot nodes but MUST NOT write a choice node or a
// decision_log row. Enforced by Postgres GRANTs + RLS, never by a prompt.
// Every case runs under `set local role ai_service` inside a rolled-back tx.
import { describe, it, expect } from "vitest";
import { withPgClient } from "../../lib/db/pg";

const ENG = "00000000-0000-0000-0000-0000000000e1";
const USR = "00000000-0000-0000-0000-0000000000a1";

async function asAiService<T>(body: (q: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T> {
  return withPgClient(async (client) => {
    await client.query("begin");
    await client.query("set local role ai_service");
    try {
      return await body((sql, params) => client.query(sql, params));
    } finally {
      await client.query("rollback");
    }
  });
}

async function rejects(sql: string, params: unknown[]): Promise<boolean> {
  return asAiService(async (q) => {
    try {
      await q(sql, params);
      return false;
    } catch {
      return true;
    }
  });
}

describe("Rule 3 — ai_service write boundary", () => {
  it("CANNOT insert a choice node", async () => {
    expect(
      await rejects("insert into node (engagement_id,type,label,origin) values ($1,'choice','AI choice','ai')", [ENG]),
    ).toBe(true);
  });

  it("CANNOT write a decision_log row", async () => {
    expect(
      await rejects(
        "insert into decision_log (engagement_id,title,decision,rationale,decided_by) values ($1,'t','d','r',$2)",
        [ENG, USR],
      ),
    ).toBe(true);
  });

  it("CANNOT update a choice node", async () => {
    expect(await rejects("update node set label='tampered' where type='choice'", [])).toBe(true);
  });

  it("CAN insert an option node", async () => {
    const ok = await asAiService(async (q) => {
      try {
        await q(
          "insert into node (engagement_id,type,label,origin,provenance_class) values ($1,'option','probe option','ai','derived')",
          [ENG],
        );
        return true;
      } catch {
        return false;
      }
    });
    expect(ok).toBe(true);
  });

  it("CAN read the graph (RLS grants select, not a zero-row silent failure)", async () => {
    const n = await asAiService(async (q) => {
      const res = await q("select count(*)::int as n from node where type='signal'", []);
      return res.rows[0].n as number;
    });
    expect(n).toBeGreaterThanOrEqual(2);
  });
});
