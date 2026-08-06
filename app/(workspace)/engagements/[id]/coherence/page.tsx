import { format } from "date-fns";
import { createHumanClient } from "@/lib/db/human";
import { getCoherenceView } from "@/lib/coherence/run";
import { CHECKS } from "@/lib/coherence/checks";
import { RunCoherenceButton } from "./run-button";
import { FindingCard } from "./finding-card";

export default async function CoherencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const view = await getCoherenceView(db, id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">Coherence</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Deterministic checks{view.lastRunAt ? ` · last run ${format(new Date(view.lastRunAt), "d LLL yyyy HH:mm")}` : ""}. Accepting a finding requires a
            note and records it in the decision log.
          </p>
        </div>
        <RunCoherenceButton engagementId={id} hasRun={view.lastRunAt !== null} />
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Checks</h3>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          {CHECKS.map((c) => (
            <li key={c.id} className="rounded border border-neutral-200 bg-white p-2 text-xs">
              <span className="font-semibold text-neutral-700">{c.id}</span> <span className="text-neutral-500">{c.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Open findings · {view.open.length}</h3>
        {view.lastRunAt === null ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            No checks run yet — click “Run coherence checks”.
          </p>
        ) : view.open.length === 0 ? (
          <p className="rounded-lg border border-dashed border-emerald-300 bg-white p-6 text-center text-sm text-emerald-700">
            No open findings — the strategy is coherent on C1–C3.
          </p>
        ) : (
          <ul className="space-y-2">
            {view.open.map((f) => (
              <FindingCard key={f.id} engagementId={id} finding={f} />
            ))}
          </ul>
        )}
      </section>

      {view.accepted.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">Accepted — recorded as decisions · {view.accepted.length}</h3>
          <ul className="space-y-2">
            {view.accepted.map((f) => (
              <li key={f.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">{f.checkId}</span>
                  <span className="text-[10px] uppercase text-emerald-600">accepted</span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{f.message}</p>
                <p className="mt-1 text-xs text-neutral-500"><span className="font-medium">Note: </span>{f.resolutionNote}</p>
                <p className="mt-0.5 text-[10px] text-neutral-400">→ recorded in the decision log</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
