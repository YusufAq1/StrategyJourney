import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBinding } from "../graph/queries";
import { resolveTitle } from "./layouts/shared";
import type { SlideInput } from "./render";

// The composer (CLAUDE.md §9): binding -> ViewModel -> layout. The deck is a
// sequence of slide_spec rows; each row's data_binding resolves against the
// query registry, never arbitrary SQL. This is what makes the deck a rendering
// of the graph rather than a second source of truth.
export const HOUSE_TEMPLATE_ID = "00000000-0000-0000-0000-0000000000f1";

export type SlideReport = {
  ordinal: number;
  layoutId: string;
  title: string;
  binding: string | null;
  status: string;
  unbacked: boolean;
};

export async function composeDeck(
  db: SupabaseClient,
  engagementId: string,
  templateId: string = HOUSE_TEMPLATE_ID,
): Promise<{ slides: SlideInput[]; report: SlideReport[] }> {
  const { data: specs, error } = await db
    .from("slide_spec")
    .select("ordinal,layout_id,title_binding,data_binding,locked")
    .eq("deck_template_id", templateId)
    .order("ordinal", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (specs ?? []) as { ordinal: number; layout_id: string; title_binding: string; data_binding: string | null; locked: boolean }[];

  const slides: SlideInput[] = [];
  const report: SlideReport[] = [];
  const ctx = { engagementId, db };

  for (const s of rows) {
    const title = resolveTitle(s.title_binding);
    let vm: unknown = null;
    let status = "generated";
    let unbacked = s.locked;

    if (s.locked) {
      // locked = manually maintained; not regenerated from the graph (unbacked).
      status = "locked (manual)";
    } else if (s.data_binding) {
      try {
        vm = (await resolveBinding(s.data_binding, ctx)).vm;
      } catch (e) {
        // A missing active choice is expected before one is made.
        if (s.layout_id === "choice_rationale") {
          vm = null;
          status = "no choice yet";
        } else {
          status = `error: ${(e as Error).message}`;
          unbacked = true;
        }
      }
    }

    slides.push({ layoutId: s.layout_id, title, vm } as unknown as SlideInput);
    report.push({ ordinal: s.ordinal, layoutId: s.layout_id, title, binding: s.data_binding, status, unbacked });
  }

  return { slides, report };
}
