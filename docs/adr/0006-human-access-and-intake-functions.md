# ADR 0006 — Human access path + atomic intake functions (prototype posture)

**Status:** Accepted (Step 3)

## Context
Auth beyond a single hardcoded user is out of scope (CLAUDE.md §4). The app still needs to read the graph and create signals/insights. Two facts shaped the design:

1. **Supabase defaults + partial RLS.** RLS is enabled only on `node` (migration 0001, for the ai_service/Rule 3 boundary). Supabase's default grants leave `anon`/`authenticated` with SELECT **and INSERT** on every other public table (`edge`, `signal_source`, `decision_log`, …). `node` had no `anon` policy, so the publishable key was blocked there specifically.
2. **PostgREST is one-statement-per-request.** A signal (`node` + `signal_source`) and an insight (`node` + ≥1 `supports` edge) each span two tables and must commit in ONE transaction, because the intake triggers are `DEFERRABLE INITIALLY DEFERRED` and validate at commit. Two separate REST inserts would commit the node alone and trip the trigger.

## Decision
- **Access:** the publishable/anon key stands in for the single consultant; all app DB access is server-side (Server Components read, Server Actions write). Migration 0002 adds `node` policies: `human_read` (anon SELECT) and `human_intake` (anon INSERT of `signal`/`insight`/`capability`/`swot_item`, `origin='human'`, **never `choice` or `option`**). No new secret is required.
- **Intake:** `create_signal()` and `create_insight()` `SECURITY INVOKER` functions do the multi-table write in one call/transaction. INVOKER (not DEFINER) so RLS and every trigger still apply — the functions bundle the writes, they do not bypass the guarantees.

## Consequences
- The Consultant Workspace reads and writes over HTTPS with the key already in `.env.local`; verified live in `next dev`.
- Rule 3 is untouched: `ai_service` is still blocked from choices/decision_log, and now anon can't create a `choice`/`option` either (defense in depth).
- **Known prototype posture / Phase-1 hardening:** RLS covers only `node`; via Supabase defaults, anon can still INSERT into `edge`/`signal_source`/`decision_log` directly (outside the intake functions). Acceptable for a single-tenant demo, NOT for production. Phase 1 introduces real authenticated users, enables RLS across all tables, revokes broad anon grants, and moves privileged writes to a `service_role` server path. Tracked here so it is a recorded decision, not an oversight.
