# Graph Query Registry

**The joint between the deck and the graph.** `slide_spec.data_binding` is a string; this document defines how it parses, resolves and what it returns.

Get this wrong and the deck composer either hard-codes SQL per slide (so the deck stops being a rendering of the graph) or accepts arbitrary SQL from a database column (an injection surface reachable from a template editor). Neither is acceptable.

---

## 1. Binding grammar

```
namespace.function(arg=value, arg=value)
```

- `namespace` and `function` are `[a-z_]+`
- arguments are `name=value`, comma-separated, order-independent, all optional
- values are `int`, `bool` (`true`/`false`), or bare string (unquoted, `[a-z0-9_]+`)
- no nesting, no expressions, no arithmetic

Valid: `capabilities.heatmap(level=2, colour_by=gap)` · `swot.derived()` · `options.all()`
Invalid: `select * from node` · `capabilities.heatmap(level=1+1)` · `foo.bar(x="a b")`

Parse with a strict regex, not a tokeniser. Anything that fails to parse is a template defect — fail loudly at render time with the slide ordinal in the message. Never fall back to rendering an empty slide; a silently blank slide in a client deck is worse than a failed render.

---

## 2. Registry shape

```ts
// /lib/graph/queries/registry.ts

export type QueryArgs = Record<string, string | number | boolean>;

export interface QueryContext {
  engagementId: string;
  db: SupabaseClient;
}

export interface GraphQuery<T> {
  /** "capabilities.heatmap" */
  id: string;
  /** Zod schema for args. Defaults live here, not in the caller. */
  args: z.ZodType<QueryArgs>;
  /** Resolves to a ViewModel. Must be pure w.r.t. the database. */
  resolve: (ctx: QueryContext, args: QueryArgs) => Promise<T>;
  /**
   * Node ids this view model rests on. Powers the provenance affordance
   * on every slide. MUST be populated — a slide that cannot say what it
   * rests on fails the §1 test.
   */
  evidenceNodeIds: (vm: T) => string[];
}

export const registry: Record<string, GraphQuery<unknown>>;
```

**Rules**

- Every query is registered by id at module load. `resolveBinding()` looks up by id and throws on miss.
- Queries read only. No query mutates.
- Every query returns a **ViewModel**, never raw rows. The ViewModel is the contract shared by the on-screen portal, the PPTX renderer and (later) the PDF — so a heatmap cannot look different in three places.
- Every query implements `evidenceNodeIds`. This is not optional.
- Each query has a unit test asserting shape against seeded data.

---

## 3. The seven bindings

### 3.1 `engagement.meta()`

```ts
type EngagementMeta = {
  clientName: string;
  engagementName: string;
  horizon: string | null;
  keyQuestions: string[];
  generatedAt: string;      // ISO
  stageCurrent: string;
};
```
Evidence: `[]` (metadata, not a claim).

### 3.2 `signals.summary(by=dimension)`

Slide 2 — the evidence base. Establishes that everything downstream is sourced.

```ts
type SignalSummary = {
  totalSignals: number;
  dateRange: { earliest: string; latest: string };
  byDimension: Array<{
    dimension: string;          // 'pestel_economic' | 'market' | ...
    count: number;
    meanCredibility: number;    // 1-5
    exemplars: Array<{          // top 2 by credibility
      nodeId: string;
      label: string;
      sourceRef: string;        // uri host, or interview reference
      publishedAt: string;
    }>;
  }>;
};
```
Args: `by` ∈ `dimension` (only value in v0.1).
Evidence: every exemplar `nodeId`.

### 3.3 `capabilities.heatmap(level=2, colour_by=gap)`

Slide 3.

```ts
type CapabilityHeatmap = {
  cells: Array<{
    nodeId: string;
    label: string;
    parentLabel: string | null;
    criticality: number;        // 1-5
    maturityCurrent: number;    // avg, 2dp
    maturityRequired: number;
    gap: number;                // max(required - current, 0)
    gapWeighted: number;        // gap * criticality — the sort key
    spread: number;             // stddev; >1.0 renders as "contested"
    contested: boolean;
    colourValue: number;        // driven by colour_by
  }>;
  scale: { min: number; max: number; midpoint: number };
};
```
Args: `level` ∈ 1|2|3 (default 2), `colour_by` ∈ `gap`|`maturity_current`|`criticality` (default `gap`).
Source: the `capability_assessment` view.
Evidence: every cell `nodeId`.

> `spread` is retained and rendered even though v0.1 has one respondent — it will be non-zero the moment Workshop Mode arrives, and a chart that has to be redesigned to accommodate it is a chart built twice.

### 3.4 `capabilities.gaps(top=8)`

Slide 4. Same cell shape as 3.3, sorted by `gapWeighted` desc, sliced.

```ts
type CapabilityGaps = {
  gaps: CapabilityHeatmap["cells"];    // sorted, sliced
  totalAssessed: number;
  totalBelowRequired: number;
};
```
Args: `top` (default 8, max 15).

### 3.5 `swot.derived()`

Slide 5.

```ts
type SwotView = {
  quadrants: Record<'strength'|'weakness'|'opportunity'|'threat', Array<{
    nodeId: string;
    statement: string;
    rank: number;
    evidence: Array<{
      nodeId: string;
      type: 'signal' | 'capability';
      label: string;
      sourceRef: string | null;
      publishedAt: string | null;
    }>;
  }>>;
  deletedCount: number;   // items removed with a reason; shown in notes, not on the slide
};
```
Excludes rows where `swot_item.deleted_at is not null`.
Evidence: every item `nodeId` **and** every nested evidence `nodeId`.

> `evidence` is populated per item, not per slide. This is what makes the §1 test work at the granularity a strategist actually asks it: not "what is this slide from" but "why is *that bullet* here".

### 3.6 `options.all()`

Slide 6.

```ts
type OptionsView = {
  options: Array<{
    nodeId: string;
    label: string;
    theBet: string;
    prerequisiteCapabilities: string[];
    whatMustBeTrue: string;
    strongestArgumentAgainst: string;
    requiresNewCapability: boolean;
    openQuestions: string | null;
    evidenceNodeIds: string[];
    selected: boolean;      // true if a considered_for edge links it to the chosen choice
  }>;
};
```

**No rank, no score, no sort by preference.** Order by `created_at` only. If a future slide layout wants ordering, it orders alphabetically. The system does not rank options — that is Rule 3 expressed in a view model.

### 3.7 `choice.selected()`

Slide 7.

```ts
type ChoiceView = {
  nodeId: string;
  statement: string;
  decidedBy: string;          // display name
  decidedAt: string;
  rationale: string;
  alternativesConsidered: Array<{ label: string; whyNot: string }>;
  revisitTrigger: string | null;
  tracesTo: Array<{           // insights and swot items this choice rests on
    nodeId: string;
    type: 'insight' | 'swot_item';
    label: string;
  }>;
};
```
Throws if no `choice` node with `status='active'` exists — a deck cannot be rendered before a choice is made, and failing loudly is correct.

---

## 4. Resolution flow

```
slide_spec.data_binding
  → parseBinding()        // strict regex; throws BindingParseError
  → registry[id]          // throws UnknownBindingError
  → args.parse()          // zod; applies defaults; throws BindingArgsError
  → resolve(ctx, args)    // returns ViewModel
  → evidenceNodeIds(vm)   // stored on the render for the provenance affordance
  → layout renderer       // /lib/deck/layouts/<layout_id>.ts
```

All three error types carry the slide ordinal and the raw binding string. Render fails; it does not degrade.

---

## 5. Layout ids

`layout_id` selects the renderer, independent of the binding. One layout may serve several bindings (3.3 and 3.4 share none — they differ), but the pairing is fixed per slide in v0.1:

| `layout_id` | Consumes | Slide |
|---|---|---|
| `cover` | `EngagementMeta` | 1 |
| `evidence_summary` | `SignalSummary` | 2 |
| `heatmap_full` | `CapabilityHeatmap` | 3 |
| `ranked_list` | `CapabilityGaps` | 4 |
| `quad_grid` | `SwotView` | 5 |
| `option_cards` | `OptionsView` | 6 |
| `choice_rationale` | `ChoiceView` | 7 |

Each layout has a matching SVG renderer in `/lib/charts/` where it needs one (`heatmap_full`, `quad_grid`). The same SVG is embedded in the portal and converted for PPTX — **one renderer, never two.**
