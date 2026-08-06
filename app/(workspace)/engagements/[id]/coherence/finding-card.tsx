"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { acceptFindingAction, type FormState } from "../actions";
import type { FindingView } from "@/lib/coherence/run";

export function FindingCard({ engagementId, finding }: { engagementId: string; finding: FindingView }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(acceptFindingAction, null);
  const tone = finding.severity === "error" ? "border-red-300" : "border-amber-300";

  return (
    <li className={`rounded-md border ${tone} bg-white p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">{finding.checkId}</span>
            {finding.isDeterministic && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">deterministic</span>}
            <span className={`text-[10px] uppercase ${finding.severity === "error" ? "text-red-600" : "text-amber-600"}`}>{finding.severity}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-800">{finding.message}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {finding.nodes.map((n) => (
              <Link key={n.id} href={`/engagements/${engagementId}/nodes/${n.id}`} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200">
                {n.type} · {n.label.length > 36 ? n.label.slice(0, 36) + "…" : n.label}
              </Link>
            ))}
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
          accept with note
        </button>
      </div>

      {open && (
        <form action={action} className="mt-2 space-y-1">
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="findingId" value={finding.id} />
          <textarea name="note" required rows={2} placeholder="Why is this acceptable? (recorded as a decision-log entry)" className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
          <div className="flex items-center gap-2">
            <button disabled={pending} className="rounded bg-[#13294B] px-2 py-1 text-xs text-white disabled:opacity-50">
              {pending ? "…" : "Accept + log decision"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500">cancel</button>
          </div>
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        </form>
      )}
    </li>
  );
}
