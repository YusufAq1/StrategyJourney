"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHumanClient } from "@/lib/db/human";
import { CURRENT_USER_ID, DIMENSIONS, SOURCE_KINDS } from "@/lib/constants";
import type { SignalProposal, InsightProposal } from "@/lib/ai/assist-types";

// The API-layer enforcement (START-HERE Step 3): source + date are impossible to
// skip here, mirroring the form and the DB trigger backstop.
export type FormState = { error: string } | null;

const signalSchema = z
  .object({
    engagementId: z.string().uuid(),
    label: z.string().trim().min(3, "Give the signal a short label."),
    dimension: z.enum(DIMENSIONS),
    kind: z.enum(SOURCE_KINDS),
    uri: z.string().trim().optional().default(""),
    reference: z.string().trim().optional().default(""),
    publishedAt: z.string().min(1, "A publication date is required."),
    credibility: z.coerce.number().int().min(1).max(5),
    excerpt: z.string().trim().min(1, "An excerpt (the actual evidence) is required."),
  })
  .refine((d) => d.kind !== "web" || d.uri.length > 0, {
    message: "A web source needs a resolvable URL.",
    path: ["uri"],
  })
  .refine((d) => d.kind !== "interview" || d.reference.length > 0, {
    message: "An interview needs a reference (who said it, and when).",
    path: ["reference"],
  })
  .refine((d) => d.uri.length > 0 || d.reference.length > 0, {
    message: "Every source must be resolvable: provide a URL or a reference.",
    path: ["uri"],
  });

export async function createSignalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const db = createHumanClient();
  const { data, error } = await db.rpc("create_signal", {
    p_engagement_id: d.engagementId,
    p_label: d.label,
    p_dimension: d.dimension,
    p_kind: d.kind,
    p_uri: d.uri || null,
    p_reference: d.reference || null,
    p_published_at: d.publishedAt,
    p_retrieved_at: null,
    p_credibility: d.credibility,
    p_excerpt: d.excerpt,
    p_created_by: CURRENT_USER_ID,
  });
  if (error) return { error: error.message };

  revalidatePath(`/engagements/${d.engagementId}/signals`);
  redirect(`/engagements/${d.engagementId}/nodes/${data}`);
}

const insightSchema = z.object({
  engagementId: z.string().uuid(),
  label: z.string().trim().min(5, "State the 'so what' as a full sentence."),
  confidence: z.coerce.number().min(0).max(1).optional(),
});

export async function createInsightAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const confidenceRaw = formData.get("confidence");
  const parsed = insightSchema.safeParse({
    engagementId: formData.get("engagementId"),
    label: formData.get("label"),
    confidence: confidenceRaw ? confidenceRaw : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const signalIds = formData.getAll("signalIds").map(String).filter(Boolean);
  if (signalIds.length < 1) return { error: "An insight must cite at least one signal." };

  const db = createHumanClient();
  const { data, error } = await db.rpc("create_insight", {
    p_engagement_id: parsed.data.engagementId,
    p_label: parsed.data.label,
    p_confidence: parsed.data.confidence ?? null,
    p_signal_ids: signalIds,
    p_created_by: CURRENT_USER_ID,
  });
  if (error) return { error: error.message };

  revalidatePath(`/engagements/${parsed.data.engagementId}/insights`);
  redirect(`/engagements/${parsed.data.engagementId}/nodes/${data}`);
}

const scoreSchema = z.object({
  engagementId: z.string().uuid(),
  capabilityId: z.string().uuid(),
  maturity: z.coerce.number().int().min(1).max(5),
});

// Consultant scoring — upsert the current-maturity score for the single
// respondent. capability_score is keyed (capability, respondent, mode) so
// Workshop Mode later is a new input path, not a migration.
export async function updateMaturityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = scoreSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid score." };

  const db = createHumanClient();
  const { error } = await db.from("capability_score").upsert(
    {
      capability_id: parsed.data.capabilityId,
      respondent_id: CURRENT_USER_ID,
      mode: "consultant",
      maturity: parsed.data.maturity,
    },
    { onConflict: "capability_id,respondent_id,mode" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/engagements/${parsed.data.engagementId}/capabilities`);
  return null;
}

const addCapabilitySchema = z
  .object({
    engagementId: z.string().uuid(),
    label: z.string().trim().min(2, "Give the capability a name."),
    level: z.coerce.number().int().min(1).max(2),
    parentId: z.string().uuid().optional().or(z.literal("")),
    criticality: z.coerce.number().int().min(1).max(5),
    maturityRequired: z.coerce.number().int().min(1).max(5),
    current: z.coerce.number().int().min(1).max(5),
  })
  .refine((d) => d.level === 1 || (d.parentId && d.parentId.length > 0), {
    message: "A level-2 capability needs a parent domain.",
    path: ["parentId"],
  });

// Add a capability by hand (node + typed row + initial score), via the
// create_capability RPC. Human path, so it obeys the same intake policy — a
// capability is not a choice or a machine option.
export async function addCapabilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addCapabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const db = createHumanClient();
  const { error } = await db.rpc("create_capability", {
    p_engagement_id: parsed.data.engagementId,
    p_label: parsed.data.label,
    p_level: parsed.data.level,
    p_parent_id: parsed.data.level === 2 ? parsed.data.parentId : null,
    p_criticality: parsed.data.criticality,
    p_maturity_required: parsed.data.maturityRequired,
    p_current: parsed.data.current,
    p_created_by: CURRENT_USER_ID,
  });
  if (error) return { error: error.message };

  revalidatePath(`/engagements/${parsed.data.engagementId}/capabilities`);
  return null;
}

// SWOT derivation (Sonnet 5). The model call routinely runs past Netlify's
// synchronous function limit, so this action only starts the run (an ai_run
// row + a trigger to the Netlify Background Function that does the actual
// work) and returns immediately; the swot page polls checkAiRunStatusAction
// until it lands. Locally (no `netlify dev`, so no functions endpoint to
// trigger) it falls back to running the derivation inline.
export type DerivationState = { error: string } | { runId: string } | null;

export async function deriveSwotAction(_prev: DerivationState, formData: FormData): Promise<DerivationState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };

  const db = createHumanClient();
  const { data: runId, error } = await db.rpc("start_ai_run", {
    p_engagement_id: engagementId,
    p_purpose: "swot_derivation",
    p_model: "claude-sonnet-5",
    p_prompt_template_id: "swot-derivation",
    p_prompt_version: "v1",
  });
  if (error || !runId) return { error: error?.message ?? "Could not start the derivation." };

  const base = process.env.URL || process.env.DEPLOY_URL || "";
  if (!base) {
    // Local dev without `netlify dev` running — no background functions
    // endpoint to hit, so run inline (there's no 10s Lambda limit on localhost).
    try {
      const { deriveSwot } = await import("@/lib/ai/derivations/swot");
      await deriveSwot(db, engagementId, runId);
    } catch (e) {
      await db.rpc("fail_ai_run", { p_run_id: runId, p_error: (e as Error).message });
      return { error: (e as Error).message };
    }
    revalidatePath(`/engagements/${engagementId}/swot`);
    return { runId };
  }

  try {
    await fetch(`${base}/.netlify/functions/derive-swot-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engagementId, runId }),
    });
  } catch (e) {
    await db.rpc("fail_ai_run", { p_run_id: runId, p_error: (e as Error).message });
    return { error: "Could not start the background derivation." };
  }
  return { runId };
}

// Polled by DeriveButton / GenerateOptionsButton until status leaves 'running'.
export async function checkAiRunStatusAction(
  runId: string,
): Promise<{ status: "running" | "succeeded" | "failed"; error: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const db = createHumanClient();
  const { data, error } = await db.rpc("get_ai_run_status", { p_run_id: runId }).single();
  if (error || !data) return null;
  const row = data as { status: string; error_message: string | null };
  return { status: row.status as "running" | "succeeded" | "failed", error: row.error_message };
}

const deleteSwotSchema = z.object({
  engagementId: z.string().uuid(),
  nodeId: z.string().uuid(),
  reason: z.string().trim().min(3, "A deletion reason is required — evidence is not discarded silently."),
});

// Deletion requires a recorded reason (CLAUDE.md §7 acceptance criterion; the DB
// check constraint is the backstop).
export async function deleteSwotItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = deleteSwotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = createHumanClient();
  const { error } = await db
    .from("swot_item")
    .update({ deleted_at: new Date().toISOString(), deleted_by: CURRENT_USER_ID, deletion_reason: parsed.data.reason })
    .eq("node_id", parsed.data.nodeId);
  if (error) return { error: error.message };

  revalidatePath(`/engagements/${parsed.data.engagementId}/swot`);
  return null;
}

// Option generation (Sonnet 5, sometimes two sequential calls). Same async
// start-and-poll pattern as deriveSwotAction — this can still run past a
// synchronous function's limit, especially with the retry.
export async function generateOptionsAction(_prev: DerivationState, formData: FormData): Promise<DerivationState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };

  const db = createHumanClient();
  const { data: runId, error } = await db.rpc("start_ai_run", {
    p_engagement_id: engagementId,
    p_purpose: "option_generation",
    p_model: "claude-sonnet-5",
    p_prompt_template_id: "option-generation",
    p_prompt_version: "v1",
  });
  if (error || !runId) return { error: error?.message ?? "Could not start generation." };

  const base = process.env.URL || process.env.DEPLOY_URL || "";
  if (!base) {
    try {
      const { generateOptions } = await import("@/lib/ai/derivations/options");
      await generateOptions(db, engagementId, runId);
    } catch (e) {
      await db.rpc("fail_ai_run", { p_run_id: runId, p_error: (e as Error).message });
      return { error: (e as Error).message };
    }
    revalidatePath(`/engagements/${engagementId}/options`);
    return { runId };
  }

  try {
    await fetch(`${base}/.netlify/functions/generate-options-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engagementId, runId }),
    });
  } catch (e) {
    await db.rpc("fail_ai_run", { p_run_id: runId, p_error: (e as Error).message });
    return { error: "Could not start the background generation." };
  }
  return { runId };
}

// The choice — HUMAN only (make_choice runs as the caller, never ai_service).
export async function makeChoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const statement = String(formData.get("statement") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "").trim();
  const revisit = String(formData.get("revisitTrigger") ?? "").trim();
  const selectedOption = String(formData.get("selectedOption") ?? "").trim();
  const tracesTo = formData.getAll("tracesTo").map(String).filter(Boolean);

  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };
  if (statement.length < 8) return { error: "State the choice as a full sentence." };
  if (rationale.length < 8) return { error: "A rationale is required." };
  if (!selectedOption) return { error: "Select the option you are choosing." };
  if (tracesTo.length < 1) return { error: "A choice must trace to at least one insight or SWOT item." };

  let optionsMeta: { id: string; label: string }[] = [];
  try {
    optionsMeta = JSON.parse(String(formData.get("optionsJson") ?? "[]"));
  } catch {
    optionsMeta = [];
  }
  const alternatives = optionsMeta
    .filter((o) => o.id !== selectedOption)
    .map((o) => ({ label: o.label, whyNot: String(formData.get(`whyNot_${o.id}`) ?? "").trim() }))
    .filter((a) => a.whyNot.length > 0);

  const db = createHumanClient();
  const { data, error } = await db.rpc("make_choice", {
    p_engagement_id: engagementId,
    p_statement: statement,
    p_rationale: rationale,
    p_decided_by: CURRENT_USER_ID,
    p_revisit_trigger: revisit || null,
    p_traces_to: tracesTo,
    p_selected_option: selectedOption,
    p_alternatives: alternatives,
  });
  if (error) return { error: error.message };

  revalidatePath(`/engagements/${engagementId}/choice`);
  redirect(`/engagements/${engagementId}/nodes/${data}`);
}

// Coherence Engine — deterministic checks (C1-C3).
export async function runCoherenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };
  try {
    const { runCoherence } = await import("@/lib/coherence/run");
    await runCoherence(createHumanClient(), engagementId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/engagements/${engagementId}/coherence`);
  return null;
}

const acceptSchema = z.object({
  engagementId: z.string().uuid(),
  findingId: z.string().uuid(),
  note: z.string().trim().min(5, "A note is required — accepting a known incoherence is itself a recorded decision."),
});

// Accepting a finding requires a note AND writes a decision_log entry
// (CLAUDE.md §8; the DB check constraint is the backstop).
export async function acceptFindingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = createHumanClient();
  const { data: dl, error: e1 } = await db
    .from("decision_log")
    .insert({
      engagement_id: parsed.data.engagementId,
      title: "Coherence finding accepted",
      decision: "Accepted a known incoherence",
      alternatives_considered: [],
      rationale: parsed.data.note,
      decided_by: CURRENT_USER_ID,
    })
    .select("id")
    .single();
  if (e1) return { error: e1.message };

  const { error: e2 } = await db
    .from("coherence_finding")
    .update({ status: "accepted", resolution_note: parsed.data.note, resolved_by: CURRENT_USER_ID, decision_id: (dl as { id: string }).id })
    .eq("id", parsed.data.findingId);
  if (e2) return { error: e2.message };

  revalidatePath(`/engagements/${parsed.data.engagementId}/coherence`);
  return null;
}

// ---------------------------------------------------------------------------
// Deletes (permanent, with guards). The DB now permits deleting signal/insight/
// capability nodes (migration 0006); these actions add the integrity checks the
// database does not — nothing catches an orphaned insight or a restricted
// capability parent on its own.
// ---------------------------------------------------------------------------

export async function deleteSignalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const signalId = String(formData.get("nodeId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId) || !/^[0-9a-f-]{36}$/i.test(signalId)) return { error: "Missing ids." };

  const db = createHumanClient();

  // Guard: would deleting this signal leave any insight with zero evidence?
  const { data: sup, error: e0 } = await db.from("edge").select("to_node").eq("from_node", signalId).eq("type", "supports");
  if (e0) return { error: e0.message };
  const insightIds = [...new Set(((sup ?? []) as { to_node: string }[]).map((e) => e.to_node))];
  if (insightIds.length > 0) {
    const { data: allSup, error: e1 } = await db.from("edge").select("to_node").in("to_node", insightIds).eq("type", "supports");
    if (e1) return { error: e1.message };
    const counts: Record<string, number> = {};
    for (const e of (allSup ?? []) as { to_node: string }[]) counts[e.to_node] = (counts[e.to_node] ?? 0) + 1;
    const soleFor = insightIds.filter((id) => (counts[id] ?? 0) <= 1);
    if (soleFor.length > 0) {
      const { data: labs } = await db.from("node").select("label").in("id", soleFor);
      const names = ((labs ?? []) as { label: string }[]).map((l) => `“${l.label}”`).join("; ");
      return {
        error: `This signal is the only evidence for ${soleFor.length} insight${soleFor.length === 1 ? "" : "s"} (${names}). Edit or delete ${soleFor.length === 1 ? "it" : "them"} first.`,
      };
    }
  }

  const { error } = await db.from("node").delete().eq("id", signalId);
  if (error) return { error: error.message };
  revalidatePath(`/engagements/${engagementId}/signals`);
  return null;
}

export async function deleteInsightAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId) || !/^[0-9a-f-]{36}$/i.test(nodeId)) return { error: "Missing ids." };
  const db = createHumanClient();
  const { error } = await db.from("node").delete().eq("id", nodeId);
  if (error) return { error: error.message };
  revalidatePath(`/engagements/${engagementId}/insights`);
  return null;
}

export async function deleteCapabilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId) || !/^[0-9a-f-]{36}$/i.test(nodeId)) return { error: "Missing ids." };
  const db = createHumanClient();

  // capability.parent_id is RESTRICT: a level-1 domain with children can't be
  // deleted until its children are gone. Delete the children first.
  const { data: kids, error: e0 } = await db.from("capability").select("node_id").eq("parent_id", nodeId);
  if (e0) return { error: e0.message };
  const kidIds = ((kids ?? []) as { node_id: string }[]).map((k) => k.node_id);
  if (kidIds.length > 0) {
    const { error: ek } = await db.from("node").delete().in("id", kidIds);
    if (ek) return { error: ek.message };
  }

  const { error } = await db.from("node").delete().eq("id", nodeId);
  if (error) return { error: error.message };
  revalidatePath(`/engagements/${engagementId}/capabilities`);
  return null;
}

// ---------------------------------------------------------------------------
// Manual add SWOT (human). Evidence is optional; unsupported items are flagged
// in the UI. Writes via create_swot (origin='human').
// ---------------------------------------------------------------------------
const addSwotSchema = z.object({
  engagementId: z.string().uuid(),
  quadrant: z.enum(["strength", "weakness", "opportunity", "threat"]),
  statement: z.string().trim().min(3, "Give the item a statement."),
  rationale: z.string().trim().optional().default(""),
});

export async function addSwotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addSwotSchema.safeParse({
    engagementId: formData.get("engagementId"),
    quadrant: formData.get("quadrant"),
    statement: formData.get("statement"),
    rationale: formData.get("rationale"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const evidenceIds = formData
    .getAll("evidenceIds")
    .map((v) => String(v))
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));

  const db = createHumanClient();
  const { error } = await db.rpc("create_swot", {
    p_engagement_id: parsed.data.engagementId,
    p_quadrant: parsed.data.quadrant,
    p_statement: parsed.data.statement,
    p_rationale: parsed.data.rationale,
    p_evidence_ids: evidenceIds.length > 0 ? evidenceIds : null,
    p_created_by: CURRENT_USER_ID,
  });
  if (error) return { error: error.message };
  revalidatePath(`/engagements/${parsed.data.engagementId}/swot`);
  return null;
}

// ---------------------------------------------------------------------------
// AI assist — propose → review → accept. The AI only proposes (CLAUDE.md §14);
// nothing is written until the human accepts, and then via the existing
// create_signal / create_insight (origin='human'). Each propose call is logged
// to ai_run; accepting marks that run accepted.
// ---------------------------------------------------------------------------

// Parses an uploaded PDF/.docx/.md/.txt file into plain text so it can
// populate the same paste box the extraction below reads from. Nothing is
// persisted — the file is parsed in memory and discarded.
export type ExtractFileTextState = { error: string } | { text: string; filename: string } | null;

export async function extractFileTextAction(_prev: ExtractFileTextState, formData: FormData): Promise<ExtractFileTextState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  try {
    const { extractTextFromUpload } = await import("@/lib/files/extract-text");
    const text = await extractTextFromUpload(file);
    return { text, filename: file.name };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type ProposeSignalsState =
  | { error: string }
  | { proposals: SignalProposal[]; runId: string | null }
  | null;

export async function proposeSignalsAction(_prev: ProposeSignalsState, formData: FormData): Promise<ProposeSignalsState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  const text = String(formData.get("text") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };
  try {
    const { extractSignals } = await import("@/lib/ai/derivations/signal-extraction");
    const { proposals, runId } = await extractSignals(createHumanClient(), engagementId, text);
    return { proposals, runId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Accepts one reviewed signal proposal (with the shared source the consultant
// supplied). Reuses the same validation as the manual path; does NOT redirect,
// so the reviewer stays open for the next proposal.
export async function acceptProposedSignalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const db = createHumanClient();
  const { error } = await db.rpc("create_signal", {
    p_engagement_id: d.engagementId,
    p_label: d.label,
    p_dimension: d.dimension,
    p_kind: d.kind,
    p_uri: d.uri || null,
    p_reference: d.reference || null,
    p_published_at: d.publishedAt,
    p_retrieved_at: null,
    p_credibility: d.credibility,
    p_excerpt: d.excerpt,
    p_created_by: CURRENT_USER_ID,
  });
  if (error) return { error: error.message };

  const runId = String(formData.get("runId") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(runId)) await db.rpc("set_ai_run_accepted", { p_run_id: runId, p_accepted: true });

  revalidatePath(`/engagements/${d.engagementId}/signals`);
  return null;
}

export type ProposeInsightsState =
  | { error: string }
  | { proposals: InsightProposal[]; signalLabels: Record<string, string>; runId: string | null }
  | null;

export async function proposeInsightsAction(_prev: ProposeInsightsState, formData: FormData): Promise<ProposeInsightsState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };
  try {
    const { suggestInsights } = await import("@/lib/ai/derivations/insight-suggestion");
    const { proposals, signalLabels, runId } = await suggestInsights(createHumanClient(), engagementId);
    return { proposals, signalLabels, runId };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function acceptProposedInsightAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = insightSchema.safeParse({
    engagementId: formData.get("engagementId"),
    label: formData.get("label"),
    confidence: formData.get("confidence") ? formData.get("confidence") : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const signalIds = formData.getAll("signalIds").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (signalIds.length < 1) return { error: "An insight must cite at least one signal." };

  const db = createHumanClient();
  const { error } = await db.rpc("create_insight", {
    p_engagement_id: parsed.data.engagementId,
    p_label: parsed.data.label,
    p_confidence: parsed.data.confidence ?? null,
    p_signal_ids: signalIds,
    p_created_by: CURRENT_USER_ID,
  });
  if (error) return { error: error.message };

  const runId = String(formData.get("runId") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(runId)) await db.rpc("set_ai_run_accepted", { p_run_id: runId, p_accepted: true });

  revalidatePath(`/engagements/${parsed.data.engagementId}/insights`);
  return null;
}
