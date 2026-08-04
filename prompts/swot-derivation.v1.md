---
id: swot-derivation
version: v1
model: claude-sonnet-5
purpose: Derive a SWOT from capability assessment and dimension-tagged signals
writes: swot_item nodes + derives_from edges (never choice, never decision_log)
---

# SWOT derivation

## Contract

**Input** assembled by `/lib/ai/derivations/swot.ts` — never free text:

```ts
type SwotInput = {
  engagement: { clientName: string; horizon: string | null; keyQuestions: string[] };
  capabilities: Array<{
    nodeId: string; label: string;
    criticality: number; maturityCurrent: number; maturityRequired: number;
    gapWeighted: number; contested: boolean;
  }>;
  signals: Array<{
    nodeId: string; dimension: string; label: string;
    excerpt: string; sourceRef: string; publishedAt: string; credibility: number;
  }>;
};
```

**Output** via forced tool use. `tool_choice: { type: "tool", name: "emit_swot" }`.

```json
{
  "name": "emit_swot",
  "description": "Emit derived SWOT items. Every item must cite the evidence node ids it rests on.",
  "input_schema": {
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "minItems": 12,
        "maxItems": 28,
        "items": {
          "type": "object",
          "properties": {
            "quadrant": {
              "type": "string",
              "enum": ["strength", "weakness", "opportunity", "threat"]
            },
            "statement": {
              "type": "string",
              "description": "One sentence, max 140 chars. Specific and falsifiable. Not a category label."
            },
            "rationale": {
              "type": "string",
              "description": "Why the cited evidence supports this. Max 300 chars. Becomes speaker notes."
            },
            "evidence_node_ids": {
              "type": "array",
              "minItems": 1,
              "items": { "type": "string" },
              "description": "Node ids from the supplied capabilities and signals ONLY. Never invent an id."
            },
            "rank": {
              "type": "integer",
              "description": "1 = most material within its quadrant. Unique within quadrant."
            }
          },
          "required": ["quadrant", "statement", "rationale", "evidence_node_ids", "rank"]
        }
      },
      "coverage_gaps": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Dimensions where evidence was too thin to derive anything. Surfaced to the strategist as research tasks."
      }
    },
    "required": ["items", "coverage_gaps"]
  }
}
```

## System prompt

```
You are deriving a SWOT analysis for a strategy engagement from evidence already
captured in a strategy graph. You are not running a workshop and you are not
brainstorming: every item you produce must rest on evidence supplied to you.

DERIVATION RULES

Strengths and weaknesses come from the capability assessment.
  - A strength is a capability at or above required maturity where criticality is
    3 or higher. Low-criticality competence is not a strategic strength.
  - A weakness is a capability below required maturity, ranked by gapWeighted.
  - A capability marked contested is evidence of disagreement, not of maturity.
    If you use one, say so in the rationale.

Opportunities and threats come from signals tagged pestel_*, market or competitor.
  - An opportunity is a signal implying an addressable gain the client could act on.
  - A threat is a signal implying a loss or constraint if the client does not act.
  - Signals tagged internal or customer support strengths and weaknesses instead.

EVIDENCE RULES

Cite only node ids present in the input. Never invent an id. If you cannot
support an item with a supplied id, do not produce the item.

Prefer two or more pieces of evidence per item. A single low-credibility signal
is thin support — produce the item only if it is materially important, and say
in the rationale that the evidence is thin.

Where evidence contradicts itself, produce the item and name the contradiction
in the rationale. Never silently pick a side.

WRITING RULES

Each statement is one specific sentence a board member could disagree with.
  Good: "Service response time averages 34 hours against a competitor benchmark of 8."
  Bad:  "Customer service could be improved."
  Bad:  "Operational excellence."

Do not hedge. Do not use "may", "could potentially", "in some cases".
Do not repeat the same underlying fact across quadrants.
Do not produce filler to balance the quadrants. Four well-evidenced threats and
one opportunity is an honest output; padding it to four each is not.

Aim for four to seven items per quadrant. Fewer is acceptable where evidence is
thin — record that in coverage_gaps.

SCOPE

You produce candidate SWOT items. You do not recommend, rank across quadrants,
or suggest what the client should do about any of it. Those are later steps
performed by humans.
```

## Post-processing — enforced in code, not trusted to the model

`/lib/ai/derivations/swot.ts` must, before writing anything:

1. **Reject unknown node ids.** Any `evidence_node_ids` entry not in the input set → discard the whole item, log to `ai_run.output.rejected`. Do not attempt to repair it.
2. **Reject empty evidence.** Schema requires `minItems: 1`, but validate again — a schema is not a guarantee.
3. **Deduplicate** on normalised statement (lowercase, strip punctuation, Levenshtein < 0.15) across quadrants.
4. **Renumber ranks** contiguously within each quadrant.
5. **Write in one transaction:** `node` (type `swot_item`, `origin='ai'`, `provenance_class='derived'`) + `swot_item` row + one `derives_from` edge per evidence id.
6. **Record `ai_run`** with `accepted = null`. The strategist sets it on review. Acceptance rate below ~50% means the fix is context, not more generation.

## Regeneration

Re-running replaces items where `swot_item.deleted_at is null` **and** the item has not been edited by a human (`node.updated_by is null or node.updated_by = ai_user_id`). Human-edited and human-deleted items survive regeneration untouched — a deletion carries a recorded reason, and re-proposing a rejected item ignores the strategist's judgement.

## Golden cases

Twenty in `/prompts/evals/swot/`. Each is a fixed `SwotInput` plus a human-approved reference output. Assert on every prompt change:

- no hallucinated node ids (hard fail)
- every item has ≥1 evidence id (hard fail)
- quadrant assignment matches reference for ≥80% of items
- no item duplicated across quadrants (hard fail)
