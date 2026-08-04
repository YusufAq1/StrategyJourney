"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHumanClient } from "@/lib/db/human";
import { CURRENT_USER_ID, DIMENSIONS, SOURCE_KINDS } from "@/lib/constants";

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

// SWOT derivation (Sonnet 5). AI writes run as ai_service via derive_swot_apply
// inside the derivation; this action just orchestrates and surfaces errors.
export async function deriveSwotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) return { error: "Missing engagement." };
  try {
    const { deriveSwot } = await import("@/lib/ai/derivations/swot");
    const db = createHumanClient();
    await deriveSwot(db, engagementId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/engagements/${engagementId}/swot`);
  return null;
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
