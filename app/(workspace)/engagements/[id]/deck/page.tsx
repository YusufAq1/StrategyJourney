import { format } from "date-fns";
import { createHumanClient } from "@/lib/db/human";
import { composeDeck } from "@/lib/deck/compose";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const { report } = await composeDeck(db, id);

  const { data: renders } = await db
    .from("deck_render")
    .select("rendered_at,duration_ms,unbacked_slide_count")
    .eq("engagement_id", id)
    .order("rendered_at", { ascending: false })
    .limit(1);
  const last = (renders ?? [])[0] as { rendered_at: string; duration_ms: number | null; unbacked_slide_count: number } | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">Deck</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
            Seven slides, rendered from the graph — genuinely editable PowerPoint (native text and charts, correct in PowerPoint and Google
            Slides).
            {last
              ? ` Last render ${format(new Date(last.rendered_at), "d LLL HH:mm")} · ${last.duration_ms}ms${
                  (last.duration_ms ?? 0) < 60000 ? " (under 60s ✓)" : ""
                } · ${last.unbacked_slide_count} unbacked slide${last.unbacked_slide_count === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>
        <a
          href={`/api/engagements/${id}/deck/render`}
          download
          className="shrink-0 rounded-md bg-[#171258] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F40F1]"
        >
          Generate &amp; download deck
        </a>
      </div>

      <section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Slide</th>
              <th className="px-3 py-2 font-medium">Binding</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r) => (
              <tr key={r.ordinal} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 text-neutral-500">{r.ordinal}</td>
                <td className="px-3 py-2 font-medium text-[#171258]">{r.title}</td>
                <td className="px-3 py-2 text-xs text-neutral-500">{r.binding ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={r.unbacked ? "text-amber-700" : r.status.startsWith("error") ? "text-red-700" : "text-emerald-700"}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-neutral-400">
        The theme is a flagged placeholder until the SP PowerPoint template is supplied. Manual edits to a slide are preserved by marking it
        <span className="font-medium"> locked</span>, which also marks it unbacked so graph drift is measured, not silent.
      </p>
    </div>
  );
}
