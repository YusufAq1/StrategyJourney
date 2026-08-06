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
