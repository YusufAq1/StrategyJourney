// Client-safe DTOs for the propose→review→accept AI assist. No SDK imports here,
// so both server derivations/actions and client review components can use them.

export type SignalProposal = {
  suggestedLabel: string;
  excerpt: string;
  dimension: string;
  suggestedCredibility: number;
};

export type InsightProposal = {
  statement: string;
  signalNodeIds: string[];
  confidence: number;
};
