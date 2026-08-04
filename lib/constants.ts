// Prototype constants. Auth is out of scope (CLAUDE.md §4): one hardcoded user,
// one seeded engagement. These become real lookups in Phase 1.
export const CURRENT_USER_ID = "00000000-0000-0000-0000-0000000000a1";
export const DEMO_ENGAGEMENT_ID = "00000000-0000-0000-0000-0000000000e1";

// signal.payload.dimension tags — stand in for the full Stage A registers.
export const DIMENSIONS = [
  "pestel_political",
  "pestel_economic",
  "pestel_social",
  "pestel_technological",
  "pestel_environmental",
  "pestel_legal",
  "market",
  "competitor",
  "internal",
  "customer",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const SOURCE_KINDS = ["web", "document", "interview", "dataset"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export function dimensionLabel(d: string): string {
  if (d.startsWith("pestel_")) return "PESTEL · " + d.slice(7).replace(/^\w/, (c) => c.toUpperCase());
  return d.replace(/^\w/, (c) => c.toUpperCase());
}
