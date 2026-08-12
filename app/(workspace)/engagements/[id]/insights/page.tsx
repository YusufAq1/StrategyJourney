import { createHumanClient } from "@/lib/db/human";
import { listInsights, listSignalOptions } from "@/lib/graph/reads";
import { InsightsList } from "./insights-list";
import { InsightSidePanel } from "./insight-side-panel";

export default async function InsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const [insights, signals] = await Promise.all([listInsights(db, id), listSignalOptions(db, id)]);

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_400px]">
      <InsightsList engagementId={id} insights={insights} />
      <aside>
        <InsightSidePanel engagementId={id} signals={signals} />
      </aside>
    </div>
  );
}
