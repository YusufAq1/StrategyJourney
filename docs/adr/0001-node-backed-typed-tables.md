# ADR 0001 — Every graph entity is a `node`; typed tables extend it

**Status:** Accepted (Step 1)

## Context
The graph has six spine types plus four feeding in (capability, option, swot_item, choice…). The blueprint listed some of these as standalone tables while also drawing edges to them. `edge.from_node`/`to_node` are single FKs to `node(id)`; they cannot polymorphically reference four different tables, and the provenance walk (`node_provenance`) breaks the instant a chain crosses an entity that isn't a `node`.

## Decision
Every graph entity gets a row in `node`. Typed tables (`capability`, `swot_item`, `option_detail`) **extend** it, keyed `node_id uuid primary key references node(id)`. They never sit beside the graph.

## Consequences
- Edges and the recursive provenance query work uniformly across all entity types.
- Common concerns (status, origin, provenance_class, staleness, confidence) live once on `node`.
- A typed row cannot exist without its `node` row; deletes cascade from `node`.
- Queries that need typed attributes join `node` → typed table on `node_id`.
