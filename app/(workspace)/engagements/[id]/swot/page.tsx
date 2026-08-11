import { createHumanClient } from "@/lib/db/human";
import { resolveBinding } from "@/lib/graph/queries";
import { listSignalOptions, listCapabilityCells } from "@/lib/graph/reads";
import type { SwotView, SwotItem, SwotQuadrant } from "@/lib/graph/queries/types";
import { DeriveButton } from "./derive-button";
import { SwotItemCard } from "./swot-item-card";
import { AddSwotForm } from "./add-swot-form";

const QUADS: { key: SwotQuadrant; label: string; tone: string }[] = [
  { key: "strength", label: "Strengths", tone: "border-emerald-300" },
  { key: "weakness", label: "Weaknesses", tone: "border-red-300" },
  { key: "opportunity", label: "Opportunities", tone: "border-blue-300" },
  { key: "threat", label: "Threats", tone: "border-amber-300" },
];

export default async function SwotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const [{ vm }, signalOpts, capCells] = await Promise.all([
    resolveBinding("swot.derived()", { engagementId: id, db }),
    listSignalOptions(db, id),
    listCapabilityCells(db, id),
  ]);
  const view = vm as SwotView;
  const total = (Object.values(view.quadrants) as SwotItem[][]).reduce((n, arr) => n + arr.length, 0);

  const evidence = [
    ...signalOpts.map((s) => ({ id: s.id, label: s.label, kind: "signal" as const })),
    ...capCells.filter((c) => c.level === 2).map((c) => ({ id: c.nodeId, label: c.label, kind: "capability" as const })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">Derived SWOT</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {total} item{total === 1 ? "" : "s"}
            {view.deletedCount > 0 ? ` · ${view.deletedCount} deleted with a reason` : ""} · AI-derived, every item traces to its evidence
          </p>
        </div>
        <DeriveButton engagementId={id} hasItems={total > 0} />
      </div>

      <div>
        <AddSwotForm engagementId={id} evidence={evidence} />
      </div>

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No SWOT derived yet. Strengths and weaknesses come from the capability assessment; opportunities and threats from
          PESTEL, market and competitor signals. Click <span className="font-medium">Derive SWOT</span> — a model ranks and
          phrases; you edit.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {QUADS.map((q) => (
            <section key={q.key} className={`rounded-lg border ${q.tone} bg-white p-4`}>
              <h3 className="mb-2 text-sm font-semibold text-[#171258]">
                {q.label} · {view.quadrants[q.key].length}
              </h3>
              <ul className="space-y-2">
                {view.quadrants[q.key].map((item) => (
                  <SwotItemCard key={item.nodeId} engagementId={id} item={item} />
                ))}
                {view.quadrants[q.key].length === 0 && <li className="text-xs text-neutral-400">none</li>}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
