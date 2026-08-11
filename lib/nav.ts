// Node-page "back" navigation. Every link into /nodes/[nodeId] carries the tab
// it was clicked from, so the back link returns there instead of always falling
// back to the engagement overview.
export const NODE_TABS = ["signals", "insights", "capabilities", "swot", "options", "choice", "coherence"] as const;
export type NodeTab = (typeof NODE_TABS)[number];

const TAB_BY_NODE_TYPE: Record<string, NodeTab> = {
  signal: "signals",
  insight: "insights",
  capability: "capabilities",
  swot_item: "swot",
  option: "options",
  choice: "choice",
};

export function nodeHref(engagementId: string, nodeId: string, from: NodeTab): string {
  return `/engagements/${engagementId}/nodes/${nodeId}?from=${from}`;
}

export function resolveBackTab(nodeType: string, from?: string): NodeTab | "" {
  if (from && (NODE_TABS as readonly string[]).includes(from)) return from as NodeTab;
  return TAB_BY_NODE_TYPE[nodeType] ?? "";
}
