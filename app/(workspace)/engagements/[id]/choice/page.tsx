import Link from "next/link";
import { format } from "date-fns";
import { createHumanClient } from "@/lib/db/human";
import { getChoiceView } from "@/lib/graph/queries/choice";
import { resolveBinding } from "@/lib/graph/queries";
import { listInsights } from "@/lib/graph/reads";
import type { OptionsView, SwotView, SwotItem } from "@/lib/graph/queries/types";
import { ChoiceForm } from "./choice-form";
import { nodeHref } from "@/lib/nav";

export default async function ChoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const choice = await getChoiceView(db, id);

  if (choice) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-700">Our choice, and why</h2>
        <section className="rounded-lg border border-[#C0A15B] bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#C0A15B] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">choice</span>
            <span className="text-xs text-neutral-500">
              decided by {choice.decidedBy} · {format(new Date(choice.decidedAt), "d LLL yyyy")} · human-made
            </span>
          </div>
          <h3 className="mt-2 text-lg font-medium text-[#171258]">
            <Link href={nodeHref(id, choice.nodeId, "choice")} className="hover:underline">{choice.statement}</Link>
          </h3>
          <p className="mt-2 text-sm text-neutral-700"><span className="font-medium text-neutral-500">Rationale: </span>{choice.rationale}</p>
          {choice.revisitTrigger && (
            <p className="mt-1 text-sm text-neutral-600"><span className="font-medium">Revisit when: </span>{choice.revisitTrigger}</p>
          )}

          <div className="mt-3">
            <div className="text-xs font-medium text-neutral-600">Rests on</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {choice.tracesTo.map((t) => (
                <Link key={t.nodeId} href={nodeHref(id, t.nodeId, "choice")} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200">
                  {t.type} · {t.label.length > 44 ? t.label.slice(0, 44) + "…" : t.label}
                </Link>
              ))}
            </div>
          </div>

          {choice.alternativesConsidered.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-neutral-600">Alternatives considered</div>
              <ul className="mt-1 space-y-1">
                {choice.alternativesConsidered.map((a, i) => (
                  <li key={i} className="text-xs text-neutral-600"><span className="font-medium">{a.label}:</span> {a.whyNot}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    );
  }

  const [optRes, insights, swotRes] = await Promise.all([
    resolveBinding("options.all()", { engagementId: id, db }),
    listInsights(db, id),
    resolveBinding("swot.derived()", { engagementId: id, db }),
  ]);
  const options = (optRes.vm as OptionsView).options.map((o) => ({ id: o.nodeId, label: o.label }));
  const swot = (Object.values((swotRes.vm as SwotView).quadrants) as SwotItem[][]).flat();
  const traceables = [
    ...insights.map((i) => ({ id: i.id, type: "insight", label: i.label })),
    ...swot.map((s) => ({ id: s.nodeId, type: "swot", label: s.statement })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-700">Make the choice</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Human-only — the AI generated the options, it does not decide. Records the decision, the alternatives considered,
          rationale, decider and a revisit trigger.
        </p>
      </div>
      <div className="max-w-2xl rounded-lg border border-neutral-200 bg-white p-5">
        <ChoiceForm engagementId={id} options={options} traceables={traceables} />
      </div>
    </div>
  );
}
