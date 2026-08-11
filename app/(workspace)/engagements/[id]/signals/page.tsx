import Link from "next/link";
import { createHumanClient } from "@/lib/db/human";
import { listSignals } from "@/lib/graph/reads";
import { dimensionLabel } from "@/lib/constants";
import { SignalForm } from "./signal-form";
import { AssistPanel } from "./assist-panel";
import { DeleteNodeButton } from "../delete-node-button";
import { nodeHref } from "@/lib/nav";

function host(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

export default async function SignalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const signals = await listSignals(db, id);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Signals · {signals.length}</h2>
        <ul className="space-y-2">
          {signals.map((s) => (
            <li key={s.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <Link href={nodeHref(id, s.id, "signals")} className="text-sm font-medium text-[#171258] hover:underline">
                  {s.label}
                </Link>
                <div className="flex shrink-0 items-start gap-2">
                  {s.dimension && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                      {dimensionLabel(s.dimension)}
                    </span>
                  )}
                  <DeleteNodeButton kind="signal" engagementId={id} nodeId={s.id} confirmLabel="Delete signal?" />
                </div>
              </div>
              {s.source && (
                <div className="mt-2 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-600">{s.source.kind}</span>
                  {" · "}
                  {s.source.uri ? host(s.source.uri) : s.source.reference}
                  {" · published "}
                  {s.source.publishedAt}
                  {" · credibility "}
                  {s.source.credibility}/5
                </div>
              )}
            </li>
          ))}
          {signals.length === 0 && <p className="text-sm text-neutral-500">No signals yet — add the first one.</p>}
        </ul>
      </section>

      <aside className="space-y-4">
        <AssistPanel engagementId={id} />
        <div className="sticky top-6 rounded-lg border border-neutral-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">Add a signal manually</h3>
          <SignalForm engagementId={id} />
        </div>
      </aside>
    </div>
  );
}
