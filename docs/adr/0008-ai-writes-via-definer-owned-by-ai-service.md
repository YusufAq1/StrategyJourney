# ADR 0008 — AI writes run through a SECURITY DEFINER function owned by ai_service

**Status:** Accepted (Step 5)

## Context
AI-derived nodes must be written as `origin='ai'`, which only the `ai_service` role may do (the `ai_cannot_create_choice` RLS policy checks `origin='ai'`). The intended path is a raw Postgres connection that assumes `ai_service` (`/lib/db/ai.ts`, `SET ROLE`). But the prototype runtime talks to Postgres over PostgREST/HTTPS with the publishable key (no DB password, ADR 0006), and PostgREST cannot `SET ROLE`. A signal or SWOT write also spans multiple tables and must be atomic (deferred triggers).

Two ways to bridge that on the HTTPS path:
- **DEFINER owned by `postgres`** — runs as a superuser-ish role, bypasses RLS. Rule 3 would then rest on the function's *code* only (it happens not to insert a choice). CLAUDE.md §2 is explicit that Rule 3 must be a **permission boundary**, not code discipline.
- **DEFINER owned by `ai_service`** — runs with `ai_service`'s privileges. RLS and the revoked `decision_log` grant still bind it.

## Decision
`derive_swot_apply` is `SECURITY DEFINER` **owned by `ai_service`**, `EXECUTE` granted to `anon`/`authenticated`. A Server Action (anon) calls it; the body runs as `ai_service` and does the whole write — swot_item node (`origin='ai'`, `provenance_class='derived'`) + swot_item row + one `derives_from` edge per verified evidence id + the `ai_run` log — in one transaction. (`ai_service` was granted `CREATE` on schema `public` so it can own the function; this does not widen Rule 3.)

## Consequences
- The AI write path is still a **permission boundary**: even this function cannot insert a `choice` or write `decision_log`, because `ai_service`'s RLS/grants forbid it. Verified live (2 swot nodes + 3 derives_from edges + 1 ai_run created; choice/decision_log still blocked).
- Works over HTTPS with no DB password; the `SET ROLE`-based `/lib/db/ai.ts` remains the Phase-1 path once a server-side Postgres connection exists.
- Unknown evidence ids are dropped inside the function as a backstop to the code-side post-processing in `/lib/ai/derivations/swot.ts`.
- SECURITY DEFINER functions are a privilege-escalation surface; this one is narrow (fixed logic, only creates swot_items) and `search_path` is pinned.
