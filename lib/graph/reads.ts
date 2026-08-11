import type { SupabaseClient } from "@supabase/supabase-js";
import type { CapabilityCell } from "./queries/types";

// Read helpers for the Consultant Workspace. All read-only, all via the
// publishable-key server client. Reads honour node RLS (human_read policy).

export type EngagementRow = {
  id: string;
  orgName: string;
  name: string;
  industry: string | null;
  description: string | null;
  horizon: string | null;
  keyQuestions: string[];
  stageCurrent: string;
};

export type EngagementSummary = {
  id: string;
  orgName: string;
  name: string;
  industry: string | null;
  horizon: string | null;
  status: string;
  createdAt: string;
};

export type SignalRow = {
  id: string;
  label: string;
  dimension: string | null;
  createdAt: string;
  source: {
    kind: string;
    uri: string | null;
    reference: string | null;
    publishedAt: string;
    retrievedAt: string;
    credibility: number;
    excerpt: string;
  } | null;
};

export type InsightRow = {
  id: string;
  label: string;
  confidence: number | null;
  citationCount: number;
  createdAt: string;
};

export type NodeRow = {
  id: string;
  type: string;
  label: string;
  status: string;
  origin: string;
  staleSince: string | null;
  dimension: string | null;
  createdAt: string;
};

export async function getEngagement(db: SupabaseClient, id: string): Promise<EngagementRow> {
  const { data, error } = await db
    .from("engagement")
    .select("id,org_name,name,industry,description,horizon,key_questions,stage_current")
    .eq("id", id)
    .single();
  if (error) throw new Error(`engagement: ${error.message}`);
  const kq = (data as { key_questions: unknown }).key_questions;
  return {
    id: data.id,
    orgName: data.org_name,
    name: data.name,
    industry: data.industry ?? null,
    description: data.description ?? null,
    horizon: data.horizon,
    keyQuestions: Array.isArray(kq) ? (kq as string[]) : [],
    stageCurrent: data.stage_current,
  };
}

// All engagements for the client-picker landing page, newest first.
export async function listEngagements(db: SupabaseClient): Promise<EngagementSummary[]> {
  const { data, error } = await db
    .from("engagement")
    .select("id,org_name,name,industry,horizon,status,created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`engagements: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    orgName: r.org_name as string,
    name: r.name as string,
    industry: (r.industry as string | null) ?? null,
    horizon: (r.horizon as string | null) ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

export async function countByType(db: SupabaseClient, engagementId: string): Promise<Record<string, number>> {
  const { data, error } = await db.from("node").select("type").eq("engagement_id", engagementId);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { type: string }[]) counts[r.type] = (counts[r.type] ?? 0) + 1;
  return counts;
}

export async function listSignals(db: SupabaseClient, engagementId: string): Promise<SignalRow[]> {
  const { data, error } = await db
    .from("node")
    .select(
      "id,label,payload,created_at, signal_source(kind,uri,reference,published_at,retrieved_at,credibility,excerpt)",
    )
    .eq("engagement_id", engagementId)
    .eq("type", "signal")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const src = (r.signal_source as Record<string, unknown>[] | null)?.[0];
    const payload = (r.payload as { dimension?: string } | null) ?? {};
    return {
      id: r.id as string,
      label: r.label as string,
      dimension: payload.dimension ?? null,
      createdAt: r.created_at as string,
      source: src
        ? {
            kind: src.kind as string,
            uri: (src.uri as string | null) ?? null,
            reference: (src.reference as string | null) ?? null,
            publishedAt: src.published_at as string,
            retrievedAt: src.retrieved_at as string,
            credibility: src.credibility as number,
            excerpt: src.excerpt as string,
          }
        : null,
    };
  });
}

export async function listInsights(db: SupabaseClient, engagementId: string): Promise<InsightRow[]> {
  const { data, error } = await db
    .from("node")
    .select("id,label,confidence,created_at")
    .eq("engagement_id", engagementId)
    .eq("type", "insight")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const insights = (data ?? []) as { id: string; label: string; confidence: number | null; created_at: string }[];

  const counts: Record<string, number> = {};
  if (insights.length > 0) {
    const { data: edges, error: e2 } = await db
      .from("edge")
      .select("to_node")
      .in("to_node", insights.map((i) => i.id))
      .eq("type", "supports");
    if (e2) throw new Error(e2.message);
    for (const e of (edges ?? []) as { to_node: string }[]) counts[e.to_node] = (counts[e.to_node] ?? 0) + 1;
  }

  return insights.map((i) => ({
    id: i.id,
    label: i.label,
    confidence: i.confidence,
    citationCount: counts[i.id] ?? 0,
    createdAt: i.created_at,
  }));
}

export async function getNode(db: SupabaseClient, nodeId: string): Promise<NodeRow | null> {
  const { data, error } = await db
    .from("node")
    .select("id,type,label,status,origin,stale_since,payload,created_at")
    .eq("id", nodeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const payload = (data.payload as { dimension?: string } | null) ?? {};
  return {
    id: data.id,
    type: data.type,
    label: data.label,
    status: data.status,
    origin: data.origin,
    staleSince: data.stale_since,
    dimension: payload.dimension ?? null,
    createdAt: data.created_at,
  };
}

// Capability cells for an engagement — joins the capability table (level,
// parent, criticality, required) with the capability_assessment view (current
// maturity avg, spread). The single fetch behind the heatmap, the gaps list and
// the inventory table, so all three agree. colourValue defaults to gap; the
// heatmap query overrides it per colour_by.
export async function listCapabilityCells(db: SupabaseClient, engagementId: string): Promise<CapabilityCell[]> {
  const { data: capNodes, error: e0 } = await db
    .from("node")
    .select("id,label")
    .eq("engagement_id", engagementId)
    .eq("type", "capability");
  if (e0) throw new Error(e0.message);
  const nodes = (capNodes ?? []) as { id: string; label: string }[];
  if (nodes.length === 0) return [];

  const labelById: Record<string, string> = {};
  const ids: string[] = [];
  for (const n of nodes) {
    labelById[n.id] = n.label;
    ids.push(n.id);
  }

  const { data: caps, error: e1 } = await db
    .from("capability")
    .select("node_id,level,parent_id,criticality,maturity_required")
    .in("node_id", ids);
  if (e1) throw new Error(e1.message);

  const { data: view, error: e2 } = await db
    .from("capability_assessment")
    .select("node_id,maturity_current,spread")
    .in("node_id", ids);
  if (e2) throw new Error(e2.message);

  const vById: Record<string, { maturity_current: number | null; spread: number | null }> = {};
  for (const v of (view ?? []) as { node_id: string; maturity_current: number | null; spread: number | null }[]) {
    vById[v.node_id] = { maturity_current: v.maturity_current, spread: v.spread };
  }

  const capRows = (caps ?? []) as {
    node_id: string;
    level: number;
    parent_id: string | null;
    criticality: number;
    maturity_required: number;
  }[];

  // A level-1 domain doesn't carry its own consultant score — its current
  // maturity is the average of its level-2 children's, so it can never drift
  // from the sub-capabilities it's meant to summarise.
  const childCurrentsByParent = new Map<string, number[]>();
  for (const c of capRows) {
    if (c.level !== 2 || !c.parent_id) continue;
    const v = vById[c.node_id];
    const cur = v?.maturity_current != null ? Number(v.maturity_current) : 0;
    const list = childCurrentsByParent.get(c.parent_id) ?? [];
    list.push(cur);
    childCurrentsByParent.set(c.parent_id, list);
  }

  return capRows.map((c) => {
    const children = c.level === 1 ? childCurrentsByParent.get(c.node_id) : undefined;
    let cur: number;
    if (children && children.length > 0) {
      cur = children.reduce((sum, n) => sum + n, 0) / children.length;
    } else {
      const v = vById[c.node_id];
      cur = v?.maturity_current != null ? Number(v.maturity_current) : 0;
    }
    const req = c.maturity_required;
    const crit = c.criticality;
    const gap = Math.max(req - cur, 0);
    const v = vById[c.node_id];
    const spread = v?.spread != null ? Number(v.spread) : 0;
    return {
      nodeId: c.node_id,
      label: labelById[c.node_id] ?? "(unnamed)",
      parentLabel: c.parent_id ? labelById[c.parent_id] ?? null : null,
      level: c.level,
      criticality: crit,
      maturityCurrent: cur,
      maturityRequired: req,
      gap,
      gapWeighted: Math.round(gap * crit * 10) / 10,
      spread,
      contested: spread > 1.0,
      colourValue: gap,
    };
  });
}

// Signals available to cite when capturing an insight (id + label only).
export async function listSignalOptions(
  db: SupabaseClient,
  engagementId: string,
): Promise<{ id: string; label: string; dimension: string | null }[]> {
  const { data, error } = await db
    .from("node")
    .select("id,label,payload")
    .eq("engagement_id", engagementId)
    .eq("type", "signal")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    dimension: ((r.payload as { dimension?: string } | null) ?? {}).dimension ?? null,
  }));
}
