// SP theme — PLACEHOLDER (build Step 2).
//
// CLAUDE.md §9 / Appendix C item 6: the production theme MUST be extracted from
// Strategy Platforms' own PowerPoint template (colours, fonts, layout geometry).
// That file is a practice-lead deliverable and is not yet available. This is a
// deliberately neutral, professional stand-in so the deck pipeline can be built
// and slide 1 can render.
//
// EVERY value here is provisional. When the real template arrives, change the
// values in THIS FILE ONLY — nothing downstream should need to change, because
// layouts (/lib/deck/layouts/*) consume these tokens and never hard-code a
// colour, font, or measurement. `meta.isPlaceholder` is rendered on the slide
// footer so no one mistakes this for the real brand in a review.
//
// Units are inches (pptxgenjs' native unit). Colours are 6-digit hex WITHOUT a
// leading '#', as pptxgenjs expects.

export const SP_THEME = {
  meta: { name: "SP Placeholder", isPlaceholder: true },

  // 16:9
  dimensions: { widthIn: 13.333, heightIn: 7.5, aspect: "16:9" as const },
  margin: { top: 0.55, right: 0.7, bottom: 0.5, left: 0.7 },
  grid: { columns: 12, gutterIn: 0.2 },

  color: {
    ink: "1A2230", // primary text — near-black with a cool cast
    navy: "13294B", // primary brand
    blue: "1B4F91", // secondary / eyebrow
    gold: "C0A15B", // premium accent rule
    slate: "5B6472", // muted / meta text
    line: "D8DCE3", // hairlines
    paper: "FFFFFF",
    paperAlt: "F5F7FA",
  },

  // Cross-platform faces (present on Windows, macOS and Google Slides) so the
  // demo PPTX is not silently re-flowed. The real SP faces replace these.
  font: {
    display: "Georgia", // cover title — editorial weight, distinct from default Calibri
    heading: "Arial",
    body: "Arial",
    label: "Arial",
  },

  size: {
    coverTitle: 40,
    coverSubtitle: 18,
    coverMeta: 12,
    slideTitle: 26,
    body: 14,
    label: 10,
    footer: 8,
  },
} as const;

export type SpTheme = typeof SP_THEME;
