"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHumanClient } from "@/lib/db/human";
import { CURRENT_USER_ID } from "@/lib/constants";

export type FormState = { error: string } | null;

const engagementSchema = z.object({
  orgName: z.string().trim().min(2, "Give the client company a name."),
  name: z.string().trim().min(2, "Give this engagement a name."),
  industry: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  horizon: z.string().trim().optional().default(""),
  keyQuestions: z.string().optional().default(""),
});

// Creates a new client (engagement) with a starter capability inventory, then
// drops the consultant into its Signals tab to start building the strategy.
// SECURITY INVOKER RPC — runs as the anon/human path, same guarantees as the
// rest of intake. It cannot fabricate a choice or a machine option.
export async function createEngagementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = engagementSchema.safeParse({
    orgName: formData.get("orgName"),
    name: formData.get("name"),
    industry: formData.get("industry"),
    description: formData.get("description"),
    horizon: formData.get("horizon"),
    keyQuestions: formData.get("keyQuestions"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  // One question per line → a clean JSON array, blanks dropped.
  const questions = parsed.data.keyQuestions
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  const db = createHumanClient();
  const { data, error } = await db.rpc("create_engagement", {
    p_org_name: parsed.data.orgName,
    p_name: parsed.data.name,
    p_industry: parsed.data.industry,
    p_description: parsed.data.description,
    p_horizon: parsed.data.horizon,
    p_key_questions: questions,
    p_created_by: CURRENT_USER_ID,
    p_seed_starter: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/");
  redirect(`/engagements/${data as string}/signals`);
}

const deleteEngagementSchema = z.object({
  engagementId: z.string().uuid(),
  confirmName: z.string().trim().min(1, "Type the client's name to confirm."),
});

// Permanent, cascading delete (0008: node/edge/ai_run/decision_log/
// coherence_run/deck_render/deck_template all ON DELETE CASCADE off
// engagement, and node cascades the rest). No soft-delete, no undo — the
// confirmName re-check is the backstop against a stray click or a tampered
// client-side form, since the UI's own match check runs only in the browser.
export async function deleteEngagementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = deleteEngagementSchema.safeParse({
    engagementId: formData.get("engagementId"),
    confirmName: formData.get("confirmName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = createHumanClient();
  const { data: eng, error: e0 } = await db
    .from("engagement")
    .select("org_name")
    .eq("id", parsed.data.engagementId)
    .single();
  if (e0 || !eng) return { error: "Client not found." };
  if ((eng as { org_name: string }).org_name !== parsed.data.confirmName) {
    return { error: "That doesn't match the client's name — nothing was deleted." };
  }

  const { error } = await db.from("engagement").delete().eq("id", parsed.data.engagementId);
  if (error) return { error: error.message };

  revalidatePath("/");
  return null;
}
