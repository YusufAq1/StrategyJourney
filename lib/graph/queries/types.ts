// ViewModels — the contract shared by the portal, the PPTX renderer and (later)
// the PDF, so a chart cannot look different in three places. See
// docs/graph-queries.md §3.

export type EngagementMeta = {
  clientName: string;
  engagementName: string;
  industry: string | null;
  horizon: string | null;
  keyQuestions: string[];
  generatedAt: string; // ISO
  stageCurrent: string;
};

// §3.2 — signals.summary(by=dimension)
export type SignalSummary = {
  totalSignals: number;
  dateRange: { earliest: string; latest: string } | null;
  byDimension: Array<{
    dimension: string;
    count: number;
    meanCredibility: number;
    exemplars: Array<{ nodeId: string; label: string; sourceRef: string; publishedAt: string }>;
  }>;
};

// §3.3 / §3.4 — capability heatmap + gaps cell.
export type CapabilityCell = {
  nodeId: string;
  label: string;
  parentLabel: string | null;
  level: number;
  criticality: number; // 1-5
  maturityCurrent: number; // avg, may be fractional
  maturityRequired: number;
  gap: number; // max(required - current, 0)
  gapWeighted: number; // gap * criticality — the sort key
  spread: number; // stddev; >1.0 renders as "contested"
  contested: boolean;
  colourValue: number; // driven by colour_by
};

export type CapabilityHeatmap = {
  cells: CapabilityCell[];
  scale: { min: number; max: number; midpoint: number };
};

export type CapabilityGaps = {
  gaps: CapabilityCell[];
  totalAssessed: number;
  totalBelowRequired: number;
};

// Shared evidence-node shape — anything a derived artifact (SWOT item, option)
// can point a derives_from edge at. Used wherever an evidence list needs a
// real label/type/source instead of a bare node id.
export type EvidenceRef = {
  nodeId: string;
  type: "signal" | "capability" | "swot_item";
  label: string;
  sourceRef: string | null;
  publishedAt: string | null;
};

// §3.5 — swot.derived()
export type SwotQuadrant = "strength" | "weakness" | "opportunity" | "threat";
export type SwotItem = {
  nodeId: string;
  statement: string;
  rank: number | null;
  rationale: string | null;
  evidence: EvidenceRef[];
};
export type SwotView = {
  quadrants: Record<SwotQuadrant, SwotItem[]>;
  deletedCount: number;
};

// §3.6 — options.all(). No rank/score/preference field, by design (Rule 3).
export type OptionPrereq = { capabilityNodeId: string; requiredMaturity: number; currentlyHeld: boolean };
export type OptionCard = {
  nodeId: string;
  label: string;
  vector: string | null;
  theBet: string;
  prerequisiteCapabilities: OptionPrereq[];
  whatMustBeTrue: string;
  strongestArgumentAgainst: string;
  requiresNewCapability: boolean;
  openQuestions: string | null;
  evidence: EvidenceRef[];
  selected: boolean;
};
export type OptionsView = { options: OptionCard[] };

// §3.7 — choice.selected()
export type ChoiceView = {
  nodeId: string;
  statement: string;
  decidedBy: string;
  decidedAt: string;
  rationale: string;
  alternativesConsidered: { label: string; whyNot: string }[];
  revisitTrigger: string | null;
  tracesTo: { nodeId: string; type: "insight" | "swot_item"; label: string }[];
};
