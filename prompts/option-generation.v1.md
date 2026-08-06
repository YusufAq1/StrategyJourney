---
id: option-generation
version: v1
model: claude-sonnet-5
purpose: Generate a set of growth options spanning the strategic space
writes: option nodes + option_detail + derives_from edges (NEVER a choice node)
---

# Growth option generation

This is the hardest generative task in the prototype and the one where model tier matters most. **A weak option set is worse than none — it makes a poor choice look considered.** Opus 5, no exceptions, no cost-driven downgrade.

## Contract

**Input** assembled by `/lib/ai/derivations/options.ts`:

```ts
type OptionInput = {
  engagement: { clientName: string; horizon: string | null; keyQuestions: string[] };
  swot: Array<{ nodeId: string; quadrant: string; statement: string; rank: number }>;
  capabilities: Array<{
    nodeId: string; label: string;
    criticality: number; maturityCurrent: number; maturityRequired: number;
  }>;
  signals: Array<{ nodeId: string; dimension: string; label: string; excerpt: string }>;
};
```

**Output** via forced tool use. `tool_choice: { type: "tool", name: "emit_options" }`.

```json
{
  "name": "emit_options",
  "description": "Emit a set of growth options. The set is deliberately unranked.",
  "input_schema": {
    "type": "object",
    "properties": {
      "options": {
        "type": "array",
        "minItems": 5,
        "maxItems": 8,
        "items": {
          "type": "object",
          "properties": {
            "label": {
              "type": "string",
              "description": "Short name, max 60 chars. Names the move, not the benefit."
            },
            "vector": {
              "type": "string",
              "enum": ["deeper_penetration", "adjacent_segment", "new_geography",
                       "new_business_model", "partnership", "acquisition"],
              "description": "Which part of the space this occupies. The set must span at least four distinct vectors."
            },
            "the_bet": {
              "type": "string",
              "description": "What the client is wagering on, in one sentence. Max 200 chars."
            },
            "prerequisite_capabilities": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "capability_node_id": { "type": "string" },
                  "required_maturity": { "type": "integer", "minimum": 1, "maximum": 5 },
                  "currently_held": { "type": "boolean" }
                },
                "required": ["capability_node_id", "required_maturity", "currently_held"]
              }
            },
            "what_must_be_true": {
              "type": "string",
              "description": "The conditions under which this works. Max 400 chars. These become assumption candidates in a later phase."
            },
            "strongest_argument_against": {
              "type": "string",
              "description": "The best case a sceptic would make. Not a token caveat. Max 400 chars."
            },
            "evidence_node_ids": {
              "type": "array",
              "minItems": 1,
              "items": { "type": "string" },
              "description": "Node ids from the supplied input ONLY. Never invent an id."
            },
            "open_questions": {
              "type": "string",
              "description": "What could not be assessed from available evidence. Null if none."
            }
          },
          "required": ["label", "vector", "the_bet", "prerequisite_capabilities",
                       "what_must_be_true", "strongest_argument_against", "evidence_node_ids"]
        }
      }
    },
    "required": ["options"]
  }
}
```

Note what the schema **does not** contain: no score, no rank, no recommendation, no confidence, no "preferred" flag. There is nowhere to put a preference. That is deliberate — the shape of the tool enforces Rule 3 as firmly as the database role does.

## System prompt

```
You are generating a set of growth options for a strategy engagement, from
evidence already captured in a strategy graph.

You generate the option space. You do not choose within it. A human decision-
maker, accountable for the outcome, will choose. Your job is to make sure the
set they choose from is genuinely varied and honestly described.

THE SPACE

Generate at least five materially different options spanning these vectors:
deeper penetration of current segments, adjacent segments, new geographies,
new business models, partnership, acquisition.

The set must cover at least four distinct vectors. Five variations on one
vector is not an option set — it is one option with decorations.

At least one option must require capabilities the client does not currently
hold. A set composed entirely of comfortable moves is not a strategy choice,
and its comfort will not be visible to the reader unless something in the set
is uncomfortable.

Include at least one option you expect to be rejected. A set where every
option is plausible gives the decision no shape.

FOR EACH OPTION

the_bet: what is being wagered on. Concrete.
  Good: "That mid-market shippers will pay a premium for guaranteed same-day
         cross-border clearance."
  Bad:  "That there is growth in the mid-market."

prerequisite_capabilities: cite actual capability node ids from the input and
  state the maturity each would need. Mark currently_held false where the
  assessed maturity falls short. Do not invent capabilities.

what_must_be_true: the conditions under which the bet pays. These must be
  falsifiable and, ideally, observable before the outcome is known.

strongest_argument_against: the best case an intelligent sceptic would make.
  Not a risk register entry. Not "execution may be challenging". The actual
  reason a thoughtful person in the room would say no.

evidence_node_ids: cite only ids present in the input.

HONESTY RULES

Do not rank the options. Do not recommend one. Do not order them so that a
preference is implied by position — order them by vector.

Do not use comparative framing between options ("unlike option 2...",
"the more attractive path..."). Each option stands alone.

If the evidence is insufficient to assess an option properly, generate it
anyway and say precisely what is missing in open_questions. An option with a
stated evidence gap is more useful than a confident option resting on nothing.

If two options are substantially the same bet, merge them and generate a
different one instead.
```

## Post-processing — enforced in code

`/lib/ai/derivations/options.ts` must:

1. **Reject unknown node ids** in `evidence_node_ids` or `prerequisite_capabilities[].capability_node_id` → discard that option, log it. If fewer than five survive, **fail the run** and surface the error. Do not silently present four options; the minimum is a product guarantee.
2. **Assert vector spread** ≥4 distinct. If not, fail and retry once with the violation named in a follow-up turn. Fail the run on a second violation.
3. **Assert** at least one option has `currently_held: false` on a prerequisite. Set `option_detail.requires_new_capability` accordingly.
4. **Reject any ranking language** — scan `label`, `the_bet` and `what_must_be_true` for `best|recommend|preferred|optimal|strongest option|we suggest`. Match → discard the option and log. This is cheap and catches drift that the schema cannot.
5. **Write in one transaction:** `node` (type `option`, `origin='ai'`, `provenance_class='derived'`) + `option_detail` + one `derives_from` edge per evidence id.
6. **Persist order as `created_at` only.** Never write a rank column; there isn't one.

## The write restriction, demonstrated

This derivation runs under the `ai_service` role. Its credential can insert `option` nodes and cannot insert a `choice` node. The CI test in `supabase/tests/` proves it. When the practice lead asks "what stops it choosing?", the answer is a failing SQL statement, not a paragraph in a prompt.

## Golden cases

Twenty in `/prompts/evals/options/`. Assert on every prompt change:

- ≥5 options, ≥4 distinct vectors (hard fail)
- no hallucinated node ids (hard fail)
- no ranking language (hard fail)
- ≥1 option requiring an unheld capability (hard fail)
- `strongest_argument_against` is substantive — reject if under 80 chars or matching a generic-caveat blocklist
