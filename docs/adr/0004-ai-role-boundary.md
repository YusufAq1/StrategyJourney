# ADR 0004 — The AI write boundary is a Postgres role, not a prompt

**Status:** Accepted (Step 1) — this is Rule 3, the commercial line of the product.

## Context
A client who suspects the machine made the strategic choice will not pay strategy fees. The system must be able to prove the AI cannot decide. A prompt instruction ("do not decide") will eventually be circumvented by a well-meaning feature, and the circumvention is invisible in the output. A permission boundary fails loudly.

## Decision
A dedicated `ai_service` Postgres role. It is granted `insert` on `node, edge, option_detail, swot_item, ai_run` and `update` on `option_detail, swot_item` — and nothing on `decision_log`, `decision_node`, or `engagement`. RLS on `node` adds `ai_cannot_create_choice` (insert policy: `type <> 'choice'`) and a read policy so generation still sees the whole graph. All AI-originated writes run through `withAiServiceRole()` in `/lib/db/ai.ts`, which assumes this role.

## Consequences
- `ai_service` **can** create `option` nodes (verified) and **cannot** insert a `choice` node, update a choice, or write `decision_log` (verified live, and in the CI critical suite).
- On managed/hosted Postgres the connecting `postgres` role is not a superuser, so the migration grants it membership in `ai_service` (`grant ai_service to postgres`) purely so tests and the seam can `SET ROLE`; the boundary still binds because `ai_service` is not a table owner and has no `BYPASSRLS`.
- The option schema deliberately has no rank/score/confidence column — there is nowhere to encode a preference, reinforcing the boundary in the data model itself.
