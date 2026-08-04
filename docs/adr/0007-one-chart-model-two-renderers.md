# ADR 0007 — One chart model, two renderers (portal SVG + native PPTX shapes)

**Status:** Accepted (Step 4)

## Context
Three requirements about charts pull against each other:
- §9 / §13: "one SVG chart pipeline in `/lib/charts`, consumed identically by the portal and the deck"; "charts render as SVG only."
- Criterion 8: the generated PPTX opens in PowerPoint **and Google Slides** with **editable charts** — never images of slides.
- Criterion 10: the heatmap renders **identically** on screen and in the deck.

Embedding the portal SVG into the PPTX (the literal "one SVG, converted for PPTX" reading) satisfies "identical" but not "editable in Google Slides": Google Slides rasterises embedded SVG on import, so the chart would arrive as a picture — exactly what criterion 8 forbids.

## Decision
The single source of truth is the **layout + colour model** in `/lib/charts/heatmap.ts` (`layoutHeatmap`, `colorFor`, `textOn`) — cell positions, colours, and text, computed once from the ViewModel. Two thin renderers consume it:
- **Portal:** `heatmapSvg()` emits SVG for the browser.
- **Deck:** `lib/deck/layouts/heatmap-full.ts` emits **native PPTX shapes** (rounded rects + text runs), scaling the same pixel model into inches.

"Identical" is guaranteed because geometry and colour come from one model. "Editable everywhere" is guaranteed because the deck uses native shapes, which PowerPoint and Google Slides both render and edit. Slide 4 (`ranked_list`) is likewise native text + bar shapes.

## Consequences
- One place defines how a heatmap looks; the two renderers cannot drift on colour or geometry (verified: portal cells and deck slide-2 cells carry the same labels, values, gap badges and fill colours).
- This is a deliberate re-reading of "one SVG pipeline" as "one chart **model**": the model is single-sourced; SVG and PPTX-shapes are output formats. Flagged here because it diverges from the literal "SVG only / embed the SVG" wording, in favour of the two hard acceptance criteria (editable in both apps).
- Cost: a chart needs a small PPTX-shapes renderer in addition to the SVG one. Accepted — it is the only way to be both identical and editable in PowerPoint and Google Slides.
