"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { proposeInsightsAction, acceptProposedInsightAction, type ProposeInsightsState, type FormState } from "../actions";
import type { InsightProposal } from "@/lib/ai/assist-types";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";

export function SuggestInsights({ engagementId }: { engagementId: string }) {
  const [state, action, pending] = useActionState<ProposeInsightsState, FormData>(proposeInsightsAction, null);

  const proposals = state && "proposals" in state ? state.proposals : [];
  const signalLabels = state && "proposals" in state ? state.signalLabels : {};
  const runId = state && "proposals" in state ? state.runId : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        The AI reads your signals and drafts candidate insights, each citing the signals it rests on —{" "}
        <span className="font-medium">you decide</span>; nothing saves until you accept it.
      </p>

      <form action={action}>
        <input type="hidden" name="engagementId" value={engagementId} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-[#171258] px-4 py-3 text-[13.5px] font-bold text-white hover:bg-[#6F40F1] disabled:opacity-50"
        >
          {pending ? "Thinking…" : "Suggest insights"}
        </button>
      </form>

      {state && "error" in state && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      {proposals.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-neutral-600">
            {proposals.length} candidate insight{proposals.length === 1 ? "" : "s"} — review and accept
          </div>
          {proposals.map((p, i) => (
            <ProposalCard key={i} engagementId={engagementId} proposal={p} signalLabels={signalLabels} runId={runId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  engagementId,
  proposal,
  signalLabels,
  runId,
}: {
  engagementId: string;
  proposal: InsightProposal;
  signalLabels: Record<string, string>;
  runId: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptProposedInsightAction, null);
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setAccepted(true);
    wasPending.current = pending;
  }, [pending, state]);

  if (dismissed) return null;
  if (accepted) {
    return <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">✓ Added insight</div>;
  }

  return (
    <form action={action} className="rounded-md border border-neutral-200 bg-white p-3">
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="confidence" value={String(proposal.confidence)} />
      {proposal.signalNodeIds.map((sid) => (
        <input key={sid} type="hidden" name="signalIds" value={sid} />
      ))}
      {runId && <input type="hidden" name="runId" value={runId} />}

      <textarea name="label" defaultValue={proposal.statement} rows={2} className={`${field} font-medium`} />

      <div className="mt-2 flex flex-wrap gap-1">
        {proposal.signalNodeIds.map((sid) => (
          <span key={sid} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
            ◆ {(signalLabels[sid] ?? sid).slice(0, 40)}
          </span>
        ))}
        <span className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-400">confidence {proposal.confidence.toFixed(2)}</span>
      </div>

      {state?.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}

      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded bg-[#171258] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6F40F1] disabled:opacity-50">
          {pending ? "Saving…" : "Accept"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="rounded px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100">
          Dismiss
        </button>
      </div>
    </form>
  );
}
