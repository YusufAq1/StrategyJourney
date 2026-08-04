# ADR 0002 — No Postgres array columns for node references

**Status:** Accepted (Step 1)

## Context
It is tempting to store `derives_from uuid[]` or `evidence uuid[]` directly on a row. Postgres array elements cannot carry foreign keys.

## Decision
Never reference nodes via array columns. Use `edge` rows for graph relationships and explicit join tables (`decision_node`, `finding_node`) for typed membership.

## Consequences
- Every reference is FK-checked: nothing can point at a deleted or cross-engagement node.
- The `edge_same_engagement` trigger can enforce that relationships stay within one engagement — impossible to express over an array.
- Slightly more verbose writes (an insert per edge) in exchange for referential integrity that the traceability guarantee depends on.
