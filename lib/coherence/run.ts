import type { SupabaseClient } from "@supabase/supabase-js";
import { CHECKS, CHECK_BY_ID, type Finding } from "./checks";

export type FindingView = {
  id: string;
  checkId: string;
  severity: string;
  message: string;
  status: string;
  isDeterministic: boolean;
  nodes: { id: string; type: string; label: string }[];
  resolutionNote: string | null;
  decisionId: string | null;
};

// Runs every check and records the fresh violations. A (check, node) pair that
// already has an ACCEPTED finding is skipped — an acknowledged incoherence does
// not nag again on re-run.
export async function runCoherence(db: SupabaseClient, engagementId: string): Promise<{ open: number }> {
  const { data: accepted } = await db
    .from("coherence_finding")
    .select("check_id, coherence_run!inner(engagement_id), finding_node(node_id)")
    .eq("status", "accepted")
    .eq("coherence_run.engagement_id", engagementId);
  const acceptedSet = new Set<string>();
  for (const f of (accepted ?? []) as { check_id: string; finding_node: { node_id: string }[] | null }[]) {
    for (const fn of f.finding_node ?? []) acceptedSet.add(`${f.check_id}:${fn.node_id}`);
  }

  const findings: Finding[] = [];
  for (const chk of CHECKS) findings.push(...(await chk.run({ db, engagementId })));
  const fresh = findings.filter((f) => !acceptedSet.has(`${f.checkId}:${f.primaryNodeId}`));

  const { data: run, error } = await db
    .from("coherence_run")
    .insert({ engagement_id: engagementId, triggered_by: "manual", checks_run: CHECKS.map((c) => c.id), findings_count: fresh.length })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const runId = (run as { id: string }).id;

  if (fresh.length > 0) {
    const { data: inserted, error: e2 } = await db
      .from("coherence_finding")
      .insert(
        fresh.map((f) => ({
          run_id: runId,
          check_id: f.checkId,
          is_deterministic: CHECK_BY_ID[f.checkId]?.isDeterministic ?? true,
          severity: f.severity,
          message: f.message,
          status: "open",
        })),
      )
      .select("id");
    if (e2) throw new Error(e2.message);
    const ins = (inserted ?? []) as { id: string }[];
    const fnRows: { finding_id: string; node_id: string }[] = [];
    ins.forEach((row, i) => {
      for (const nid of fresh[i].nodeIds) fnRows.push({ finding_id: row.id, node_id: nid });
    });
    if (fnRows.length > 0) {
      const { error: e3 } = await db.from("finding_node").insert(fnRows);
      if (e3) throw new Error(e3.message);
    }
  }
  return { open: fresh.length };
}

// The most-recent run's open findings, plus all accepted findings (history).
export async function getCoherenceView(
  db: SupabaseClient,
  engagementId: string,
): Promise<{ lastRunAt: string | null; open: FindingView[]; accepted: FindingView[] }> {
  const { data: runs } = await db
    .from("coherence_run")
    .select("id,ran_at")
    .eq("engagement_id", engagementId)
    .order("ran_at", { ascending: false })
    .limit(1);
  const latest = (runs ?? [])[0] as { id: string; ran_at: string } | undefined;

  const openRaw = latest
    ? (
        await db
          .from("coherence_finding")
          .select("id,check_id,severity,message,status,is_deterministic, finding_node(node_id)")
          .eq("run_id", latest.id)
          .eq("status", "open")
      ).data ?? []
    : [];
  const acceptedRaw =
    (
      await db
        .from("coherence_finding")
        .select("id,check_id,severity,message,status,is_deterministic,resolution_note,decision_id, coherence_run!inner(engagement_id), finding_node(node_id)")
        .eq("status", "accepted")
        .eq("coherence_run.engagement_id", engagementId)
    ).data ?? [];

  const allNodeIds = new Set<string>();
  for (const f of [...openRaw, ...acceptedRaw] as { finding_node: { node_id: string }[] | null }[]) {
    for (const fn of f.finding_node ?? []) allNodeIds.add(fn.node_id);
  }
  const nodeById: Record<string, { id: string; type: string; label: string }> = {};
  if (allNodeIds.size > 0) {
    const { data: nodes } = await db.from("node").select("id,type,label").in("id", [...allNodeIds]);
    for (const n of (nodes ?? []) as { id: string; type: string; label: string }[]) nodeById[n.id] = n;
  }

  const toView = (f: Record<string, unknown>): FindingView => ({
    id: f.id as string,
    checkId: f.check_id as string,
    severity: f.severity as string,
    message: f.message as string,
    status: f.status as string,
    isDeterministic: (f.is_deterministic as boolean) ?? true,
    nodes: ((f.finding_node as { node_id: string }[] | null) ?? []).map((fn) => nodeById[fn.node_id]).filter(Boolean),
    resolutionNote: (f.resolution_note as string | null) ?? null,
    decisionId: (f.decision_id as string | null) ?? null,
  });

  return {
    lastRunAt: latest?.ran_at ?? null,
    open: (openRaw as Record<string, unknown>[]).map(toView),
    accepted: (acceptedRaw as Record<string, unknown>[]).map(toView),
  };
}
