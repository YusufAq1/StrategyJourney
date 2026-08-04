// Critical: guards against RLS being silently disabled or a policy dropped in a
// future change — the failure mode that would quietly remove the Rule 3 and
// engagement-isolation guarantees. Cheap structural checks, run every commit.
import { describe, it, expect } from "vitest";
import { withPgClient } from "../../lib/db/pg";

describe("RLS isolation", () => {
  it("row level security is enabled on node", async () => {
    const enabled = await withPgClient(async (client) => {
      const { rows } = await client.query(
        "select relrowsecurity from pg_class where oid = 'public.node'::regclass",
      );
      return rows[0].relrowsecurity as boolean;
    });
    expect(enabled).toBe(true);
  });

  it("the AI and human policies are present on node", async () => {
    const names = await withPgClient(async (client) => {
      const { rows } = await client.query(
        "select policyname from pg_policies where schemaname='public' and tablename='node'",
      );
      return rows.map((r: { policyname: string }) => r.policyname);
    });
    expect(names).toEqual(
      expect.arrayContaining([
        "ai_can_read",
        "ai_cannot_create_choice",
        "ai_cannot_modify_choice",
        "human_node_access",
      ]),
    );
  });

  it("ai_service holds no UPDATE grant on node (choice tampering fails at the grant, not just RLS)", async () => {
    const canUpdateNode = await withPgClient(async (client) => {
      const { rows } = await client.query(
        "select has_table_privilege('ai_service','public.node','update') as u",
      );
      return rows[0].u as boolean;
    });
    expect(canUpdateNode).toBe(false);
  });
});
