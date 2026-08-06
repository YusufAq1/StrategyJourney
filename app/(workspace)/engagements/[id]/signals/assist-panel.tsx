"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { proposeSignalsAction, acceptProposedSignalAction, type ProposeSignalsState, type FormState } from "../actions";
import { DIMENSIONS, SOURCE_KINDS, dimensionLabel } from "@/lib/constants";
import type { SignalProposal } from "@/lib/ai/assist-types";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const label = "block text-xs font-medium text-neutral-600 mb-1";

type Source = { kind: string; uri: string; reference: string; publishedAt: string };

export function AssistPanel({ engagementId }: { engagementId: string }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>({ kind: "web", uri: "", reference: "", publishedAt: "" });
  const [state, action, pending] = useActionState<ProposeSignalsState, FormData>(proposeSignalsAction, null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-[#1B4F91] bg-[#1B4F91]/5 px-3 py-2 text-sm font-medium text-[#1B4F91] hover:bg-[#1B4F91]/10"
      >
        ✨ Assist: extract signals from a source
      </button>
    );
  }

  const proposals = state && "proposals" in state ? state.proposals : [];
  const runId = state && "proposals" in state ? state.runId : null;

  return (
    <div className="space-y-3 rounded-lg border border-[#1B4F91]/30 bg-[#1B4F91]/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#13294B]">✨ Extract signals from a source</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">close</button>
      </div>
      <p className="text-xs text-neutral-500">
        Paste an article, notes, or an interview transcript. The AI drafts candidate signals — <span className="font-medium">you decide</span>;
        nothing is saved until you accept it.
      </p>

      {/* Shared source — attached to every signal you accept from this text. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={label}>Source type</label>
          <select className={field} value={source.kind} onChange={(e) => setSource((s) => ({ ...s, kind: e.target.value }))}>
            {SOURCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Published date</label>
          <input type="date" className={field} value={source.publishedAt} onChange={(e) => setSource((s) => ({ ...s, publishedAt: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{source.kind === "web" ? "Source URL (required for web)" : "Source URL (optional)"}</label>
          <input type="url" className={field} placeholder="https://…" value={source.uri} onChange={(e) => setSource((s) => ({ ...s, uri: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{source.kind === "interview" ? "Reference (required — who said it, and when)" : "Reference (for documents/interviews)"}</label>
          <input className={field} placeholder="CFO, Acme Ltd, executive interview" value={source.reference} onChange={(e) => setSource((s) => ({ ...s, reference: e.target.value }))} />
        </div>
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="engagementId" value={engagementId} />
        <textarea name="text" rows={6} required placeholder="Paste the source text here…" className={field} />
        <button type="submit" disabled={pending} className="rounded-md bg-[#13294B] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F91] disabled:opacity-50">
          {pending ? "Reading…" : "Extract signals"}
        </button>
      </form>

      {state && "error" in state && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      {proposals.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-neutral-600">
            {proposals.length} candidate signal{proposals.length === 1 ? "" : "s"} — review and accept
          </div>
          {proposals.map((p, i) => (
            <ProposalCard key={i} engagementId={engagementId} source={source} proposal={p} runId={runId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  engagementId,
  source,
  proposal,
  runId,
}: {
  engagementId: string;
  source: Source;
  proposal: SignalProposal;
  runId: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptProposedSignalAction, null);
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setAccepted(true);
    wasPending.current = pending;
  }, [pending, state]);

  if (dismissed) return null;
  if (accepted) {
    return <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">✓ Added: {proposal.suggestedLabel}</div>;
  }

  return (
    <form action={action} className="rounded-md border border-neutral-200 bg-white p-3">
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="kind" value={source.kind} />
      <input type="hidden" name="uri" value={source.uri} />
      <input type="hidden" name="reference" value={source.reference} />
      <input type="hidden" name="publishedAt" value={source.publishedAt} />
      {runId && <input type="hidden" name="runId" value={runId} />}

      <input name="label" defaultValue={proposal.suggestedLabel} className={`${field} font-medium`} />
      <textarea name="excerpt" defaultValue={proposal.excerpt} rows={2} className={`${field} mt-2`} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select name="dimension" defaultValue={proposal.dimension} className={field}>
          {DIMENSIONS.map((d) => <option key={d} value={d}>{dimensionLabel(d)}</option>)}
        </select>
        <select name="credibility" defaultValue={String(proposal.suggestedCredibility)} className={field}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>credibility {n}</option>)}
        </select>
      </div>

      {state?.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}

      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded bg-[#13294B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B4F91] disabled:opacity-50">
          {pending ? "Saving…" : "Accept"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="rounded px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100">
          Dismiss
        </button>
      </div>
    </form>
  );
}
