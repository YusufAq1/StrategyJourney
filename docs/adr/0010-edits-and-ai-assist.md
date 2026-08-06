# ADR 0010 — Edits/deletes, manual SWOT, and propose-only AI assist

**Status:** Accepted (post-prototype, Step 10)

## Context
Three consultant-facing improvements were requested: cut the manual work in Signals/Insights, make deletes possible (signal/insight/capability), allow a manually-added SWOT item, and speed up local dev. Each had to fit the existing boundaries — Rule 3 (AI never decides), Rules 1–2 (sourced signals, cited insights), and CLAUDE.md §14 ("the research agent proposes, it never inserts — no auto-accept at any confidence").

## Decisions

### AI assist is propose-only, decoupled from the write
The SWOT/Options derivations write immediately via an `*_apply` RPC (`origin='ai'`). The new **signal-extraction** and **insight-suggestion** derivations deliberately do **not**. They call the model (same `callWithTool` chokepoint, thinking disabled, forced tool use) and **return proposals to the UI**; a signal/insight is written only when the human accepts it, through the existing `create_signal`/`create_insight` (`origin='human'`). This is architecturally cleaner than swot/options because the human intake functions already exist and enforce provenance, and it is the literal implementation of §14. The tool schemas carry no `accepted`/rank/recommendation field — the shape itself cannot express a decision. Input is pasted text only (no web fetching, per the chosen scope).

### AI-run logging without an apply RPC
Propose-only has no `*_apply` step, and `anon` cannot write `ai_run`. So `log_ai_run` / `set_ai_run_accepted` are `SECURITY DEFINER` owned by `ai_service` (mirroring `derive_swot_apply`'s ownership), granted EXECUTE to anon. Each propose logs one `ai_run` (`accepted=null`); the first accept marks it accepted — preserving the honest acceptance-rate metric (§7) across the propose/confirm boundary via a `runId` threaded through the UI.

### Deletes are permanent, with app-level guards
`node` had RLS enabled but no DELETE policy, so anon deletes silently matched zero rows. Migration `0006` adds `human_delete` (`for delete to anon using (type in ('signal','insight','capability'))`) — scoped so a `choice` can never be deleted (Rule 3 intact) — plus an explicit `grant delete on node to anon`. The DB does not maintain downstream integrity on delete (triggers fire only on node insert/update, never on cascade edge deletion), so guards live in the actions: deleting a signal that is an insight's **sole** evidence is blocked and names the insight; deleting a level-1 capability domain deletes its children first (the `capability.parent_id` FK is RESTRICT). Soft-delete was considered (matches the SWOT precedent and the "evidence never discarded" ethos) but the chosen behaviour is permanent-with-guards.

### Manual SWOT via create_swot
`create_swot` is `SECURITY INVOKER` (mirrors `create_capability`): a `swot_item` node (`origin='human'`) + row + optional `derives_from` edges. `human_intake` already permits a swot_item node, and no trigger forces evidence, so a human item may carry none — the card flags those "unsupported". This is a deliberate, visible relaxation of the "every SWOT item traces to evidence" promise, chosen over hard-requiring evidence.

### Performance
The ~6s dev delay is `next dev` webpack per-route compilation; `dev` now uses `--turbopack`. Smaller trims: `outputFileTracingRoot` pins the workspace root (killing the stray-home-lockfile warning); the capabilities page builds its heatmap from the cells it already fetched (`heatmapFromCells`) instead of a second identical query; `createHumanClient` is wrapped in React `cache()` so layout+page share one client per request. The deployed Netlify app already runs the fast production build; remaining latency is Supabase round-trips to `ap-south-1` (region proximity is a separate, larger change).

## Consequences
- Rule 3 and Rules 1–2 are intact: the assist cannot write, deletes cannot touch a choice, and every accepted item goes through the human intake path with real provenance.
- `ai_run` now records propose-only assist calls and their acceptance — the first real data on whether the assist earns its place.
- Human-added SWOT items can be unsupported by design; the deck and coherence surface them rather than the DB blocking them.
- Migration `0006` is the only schema change (one policy, one grant, three functions, one extra grant on `ai_run`).
