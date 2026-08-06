import { createHumanClient } from "@/lib/db/human";
import { listCapabilityCells } from "@/lib/graph/reads";
import { resolveBinding } from "@/lib/graph/queries";
import type { CapabilityHeatmap, CapabilityCell } from "@/lib/graph/queries/types";
import { heatmapSvg } from "@/lib/charts/heatmap";
import { MaturityControl } from "./maturity-control";
import { AddCapabilityForm } from "./add-capability-form";

export default async function CapabilitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();

  const [cells, heatmap] = await Promise.all([
    listCapabilityCells(db, id),
    resolveBinding("capabilities.heatmap(level=2, colour_by=gap)", { engagementId: id, db }),
  ]);
  // Only build the SVG when there's something to show — a brand-new client has an
  // empty inventory until capabilities are added.
  const svg = cells.length > 0 ? heatmapSvg(heatmap.vm as CapabilityHeatmap) : "";

  // Inventory ordering: each level-1 domain followed by its children.
  const level1 = cells.filter((c) => c.level === 1).sort((a, b) => a.label.localeCompare(b.label));
  const ordered: CapabilityCell[] = [];
  for (const p of level1) {
    ordered.push(p);
    ordered.push(
      ...cells.filter((c) => c.level === 2 && c.parentLabel === p.label).sort((a, b) => b.gapWeighted - a.gapWeighted),
    );
  }

  const domains = level1.map((c) => ({ id: c.nodeId, label: c.label }));

  return (
    <div className="space-y-8">
      {cells.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Business capability heatmap · level 2, coloured by gap</h2>
          <div className="w-full max-w-3xl" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-2 text-xs text-neutral-400">Same layout model as the deck heatmap — identical geometry and colour.</p>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-neutral-700">Inventory &amp; assessment</h2>
          <AddCapabilityForm engagementId={id} domains={domains} />
        </div>

        {cells.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
            No capabilities yet. Use <span className="font-medium">+ Add capability</span> above to build the inventory.
          </div>
        ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2 font-medium">Capability</th>
                <th className="px-3 py-2 font-medium">Criticality</th>
                <th className="px-3 py-2 font-medium">Required</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">Gap</th>
                <th className="px-3 py-2 font-medium">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.nodeId} className="border-b border-neutral-100 last:border-0">
                  <td className={`px-4 py-2 ${c.level === 1 ? "font-semibold text-[#13294B]" : "pl-8 text-neutral-700"}`}>
                    {c.label}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{c.criticality}</td>
                  <td className="px-3 py-2 text-neutral-600">{c.maturityRequired}</td>
                  <td className="px-3 py-2">
                    <MaturityControl engagementId={id} capabilityId={c.nodeId} value={Math.round(c.maturityCurrent)} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={c.gap > 0 ? "font-medium text-red-700" : "text-neutral-400"}>
                      {Number.isInteger(c.gap) ? c.gap : c.gap.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{c.gapWeighted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {cells.length > 0 && (
          <p className="mt-2 text-xs text-neutral-400">Change a current-maturity score — the gaps and the heatmap above update on save.</p>
        )}
      </section>
    </div>
  );
}
