# ADR 0003 — Intake rules are enforced in the database

**Status:** Accepted (Step 1)

## Context
The blueprint enforced "a signal needs a source", "an insight needs a signal", "a choice needs grounding" at the API layer only. Seed scripts, imports, and future tooling bypass the API — and unsourced nodes entering invisibly would break the traceability chain that justifies the whole architecture.

## Decision
Enforce intake in Postgres as **deferrable, initially deferred** constraint triggers (`signal_needs_source`, `insight_needs_signal`, `choice_needs_grounding`), plus the `edge_same_engagement` guard. The API keeps its own validation for better error messages; the DB is the backstop that survives everything.

`INITIALLY DEFERRED` is required so a node and its evidence can be inserted across two statements in one transaction (the API and `seed.sql` both rely on this).

## Consequences
- A signal with no `signal_source`, or an insight with no supporting `supports` edge, cannot be committed by any path.
- Because the checks fire at **commit**, a test that wants to observe a violation inside a subtransaction must `SET CONSTRAINTS ALL IMMEDIATE` to force it (see `assert_raises` in the assertion suite — a defect found and fixed in Step 1).
- Deferral is the reason the seed can insert 18 signals + sources and 4 insights + citing edges in a single transaction.
