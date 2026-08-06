---
id: insight-suggestion
version: v1
model: claude-sonnet-5
purpose: Propose candidate insights (the "so what") from existing signals, for human review
writes: nothing — proposals only; the human accepts each via create_insight
---

# Insight suggestion

Assists the "so what" step. It **proposes**; it never writes. Each suggested
insight cites only signals already in the graph. On acceptance the human path
(`create_insight`) writes it with the cited signals as `supports` edges.

## Contract

**Input** assembled by `/lib/ai/derivations/insight-suggestion.ts`:

```ts
type InsightSuggestionInput = {
  engagement: { clientName: string; industry: string | null; keyQuestions: string[] };
  signals: Array<{ nodeId: string; dimension: string; label: string; excerpt: string }>;
};
```

**Output** via forced tool use. `tool_choice: { type: "tool", name: "emit_insights" }`.

```json
{
  "name": "emit_insights",
  "description": "Emit candidate insights, each citing the supplied signal ids it interprets. Proposals only — a human reviews, edits, and accepts each.",
  "input_schema": {
    "type": "object",
    "properties": {
      "insights": {
        "type": "array",
        "minItems": 0,
        "maxItems": 15,
        "items": {
          "type": "object",
          "properties": {
            "statement": {
              "type": "string",
              "description": "The 'so what' — one sentence of interpretation, max 200 chars. Not a restatement of the signal."
            },
            "signal_node_ids": {
              "type": "array",
              "minItems": 1,
              "items": { "type": "string" },
              "description": "Node ids from the supplied signals ONLY. Never invent an id."
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "How strongly the cited signals support this reading."
            }
          },
          "required": ["statement", "signal_node_ids", "confidence"]
        }
      }
    },
    "required": ["insights"]
  }
}
```

## System prompt

```
You suggest candidate insights for a strategy engagement from signals already
captured in the graph. An insight is the "so what" — an interpretation that says
what the underlying facts mean for this client. It is not a restatement of a
signal.

SUGGESTION RULES

Every insight must rest on at least one supplied signal, cited by its node id.
Cite only ids present in the input. Never invent an id, and never cite a signal
you were not given.

Prefer insights that connect two or more signals into a single reading — that is
where the value is. A one-signal insight is fine when the fact plainly implies a
"so what".

Do not repeat a signal back as if it were an insight. If the sentence would still
be true with the word "because" removed and the fact left bare, it is not an
insight.

Set confidence from the strength and agreement of the cited evidence. Where
signals conflict, you may still propose an insight, but say so in the statement
and lower the confidence.

If the signals do not support any honest interpretation, return an empty array.
Never pad to look productive.

SCOPE

You propose. You do not decide, rank, or recommend an action. The human reviews
every item and accepts or discards it.
```

## Post-processing — enforced in code, not trusted to the model

`/lib/ai/derivations/insight-suggestion.ts` must, before returning proposals:

1. **Reject unknown signal ids.** Any `signal_node_ids` entry not in the supplied set → discard the whole proposal.
2. **Reject empty citations** (schema requires ≥1, but validate again).
3. **Deduplicate** on the normalised statement.
4. **Clamp** `confidence` into 0–1 and **cap** the list length.
5. **Write nothing.** Return proposals to the UI and log one `ai_run` (`accepted=null`) via `log_ai_run`. An insight is written only when the human accepts it, through `create_insight`.

## Golden cases

Fixtures under `/prompts/evals/insight-suggestion/`: a signal set plus acceptable insights. Assert: no hallucinated signal id (hard fail), every insight cites ≥1 supplied id (hard fail), no insight that merely restates a single signal.
