// ViewModels — the contract shared by the portal, the PPTX renderer and (later)
// the PDF, so a chart cannot look different in three places. See
// docs/graph-queries.md §3. Only the Step-2 model is defined here; slides 2-7
// add their ViewModels alongside as they are built.

export type EngagementMeta = {
  clientName: string;
  engagementName: string;
  horizon: string | null;
  keyQuestions: string[];
  generatedAt: string; // ISO
  stageCurrent: string;
};
