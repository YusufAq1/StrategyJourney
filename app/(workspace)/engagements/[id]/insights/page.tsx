import Link from "next/link";
import { createHumanClient } from "@/lib/db/human";
import { listInsights, listSignalOptions } from "@/lib/graph/reads";
import { InsightForm } from "./insight-form";
import { SuggestInsights } from "./suggest-insights";
import { DeleteNodeButton } from "../delete-node-button";
import { nodeHref } from "@/lib/nav";

export default async function InsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const [insights, signals] = await Promise.all([listInsights(db, id), listSignalOptions(db, id)]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Insights · {insights.length}</h2>
        <ul className="space-y-2">
          {insights.map((i) => (
            <li key={i.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={nodeHref(id, i.id, "insights")} className="text-sm font-medium text-[#171258] hover:underline">
                  {i.label}
                </Link>
                <DeleteNodeButton kind="insight" engagementId={id} nodeId={i.id} confirmLabel="Delete insight?" />
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                cites {i.citationCount} signal{i.citationCount === 1 ? "" : "s"}
                {i.confidence != null ? ` · confidence ${i.confidence}` : ""}
              </div>
            </li>
          ))}
          {insights.length === 0 && <p className="text-sm text-neutral-500">No insights yet.</p>}
        </ul>
      </section>

      <aside className="space-y-4">
        <SuggestInsights engagementId={id} />
        <div className="sticky top-6 rounded-lg border border-neutral-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">Capture an insight manually</h3>
          <InsightForm engagementId={id} signals={signals} />
        </div>
      </aside>
    </div>
  );
}
