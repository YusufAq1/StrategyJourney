import type { SupabaseClient } from "@supabase/supabase-js";

// Wraps node_provenance() — the §1 test. Returns the upstream chain from a node
// back to its sourced, dated signals.
export type ProvenanceRow = {
  depth: number;
  nodeId: string;
  nodeType: string;
  label: string;
  via: string | null;
  sourceUri: string | null;
  sourceRef: string | null;
  publishedAt: string | null;
};

export async function getProvenance(db: SupabaseClient, nodeId: string): Promise<ProvenanceRow[]> {
  const { data, error } = await db.rpc("node_provenance", { target: nodeId });
  if (error) throw new Error(`node_provenance: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    depth: r.depth as number,
    nodeId: r.node_id as string,
    nodeType: r.node_type as string,
    label: r.label as string,
    via: (r.via as string | null) ?? null,
    sourceUri: (r.source_uri as string | null) ?? null,
    sourceRef: (r.source_ref as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
  }));
}
