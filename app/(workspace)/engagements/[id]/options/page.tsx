import Link from "next/link";
import { createHumanClient } from "@/lib/db/human";
import { resolveBinding } from "@/lib/graph/queries";
import type { OptionsView } from "@/lib/graph/queries/types";
import { GenerateOptionsButton } from "./generate-button";
import { nodeHref } from "@/lib/nav";

const VECTOR_LABEL: Record<string, string> = {
  deeper_penetration: "Deeper penetration",
  adjacent_segment: "Adjacent segment",
  new_geography: "New geography",
  new_business_model: "New business model",
  partnership: "Partnership",
  acquisition: "Acquisition",
};

export default async function OptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const { vm } = await resolveBinding("options.all()", { engagementId: id, db });
  const view = vm as OptionsView;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-700">Options considered</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {view.options.length} option{view.options.length === 1 ? "" : "s"} · machine-generated, <span className="font-medium">unranked</span> — ordered by vector,
            never by preference. The choice beside them is human-made.
          </p>
        </div>
        <GenerateOptionsButton engagementId={id} hasOptions={view.options.length > 0} />
      </div>

      {view.options.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No options generated yet. Sonnet 5 generates ≥5 materially different growth options spanning the space, each with its
          bet, prerequisites, the strongest argument against, and its evidence. It does not rank or recommend.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {view.options.map((o) => (
            <section key={o.nodeId} className={`rounded-lg border bg-white p-4 ${o.selected ? "border-[#C0A15B] ring-1 ring-[#C0A15B]" : "border-neutral-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#171258]">
                  <Link href={nodeHref(id, o.nodeId, "options")} className="hover:underline">{o.label}</Link>
                </h3>
                <div className="flex shrink-0 items-center gap-1">
                  {o.requiresNewCapability && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">needs new capability</span>
                  )}
                  {o.selected && <span className="rounded bg-[#C0A15B] px-1.5 py-0.5 text-[10px] font-medium text-white">chosen</span>}
                </div>
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-400">{VECTOR_LABEL[o.vector ?? ""] ?? o.vector}</div>

              <p className="mt-2 text-sm text-neutral-800"><span className="font-medium text-neutral-500">The bet: </span>{o.theBet}</p>
              <p className="mt-1 text-xs text-neutral-600"><span className="font-medium">What must be true: </span>{o.whatMustBeTrue}</p>
              <p className="mt-1 text-xs text-red-700"><span className="font-medium">Strongest argument against: </span>{o.strongestArgumentAgainst}</p>
              {o.openQuestions && (
                <p className="mt-1 text-xs text-neutral-500"><span className="font-medium">Open questions: </span>{o.openQuestions}</p>
              )}

              {o.evidenceNodeIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {o.evidenceNodeIds.map((eid) => (
                    <Link key={eid} href={nodeHref(id, eid, "options")} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200">
                      evidence
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
