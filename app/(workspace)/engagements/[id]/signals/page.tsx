import { createHumanClient } from "@/lib/db/human";
import { listSignals } from "@/lib/graph/reads";
import { SignalsList } from "./signals-list";
import { SignalSidePanel } from "./signal-side-panel";

export default async function SignalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const signals = await listSignals(db, id);

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_400px]">
      <SignalsList engagementId={id} signals={signals} />
      <aside>
        <SignalSidePanel engagementId={id} />
      </aside>
    </div>
  );
}
