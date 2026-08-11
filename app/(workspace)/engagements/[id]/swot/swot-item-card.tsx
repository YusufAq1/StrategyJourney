"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { deleteSwotItemAction, type FormState } from "../actions";
import type { SwotItem } from "@/lib/graph/queries/types";
import { nodeHref } from "@/lib/nav";

export function SwotItemCard({ engagementId, item }: { engagementId: string; item: SwotItem }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteSwotItemAction, null);

  return (
    <li className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={nodeHref(engagementId, item.nodeId, "swot")} className="text-sm text-neutral-800 hover:underline">
          {item.statement}
        </Link>
        <button onClick={() => setConfirming((v) => !v)} className="shrink-0 text-xs text-neutral-400 hover:text-red-600">
          delete
        </button>
      </div>

      {item.evidence.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.evidence.map((e) => (
            <Link
              key={e.nodeId}
              href={nodeHref(engagementId, e.nodeId, "swot")}
              title={e.sourceRef ?? undefined}
              className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200"
            >
              {e.type === "signal" ? "◆" : "▲"} {e.label.length > 40 ? e.label.slice(0, 40) + "…" : e.label}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-2">
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
            unsupported — no evidence
          </span>
        </div>
      )}

      {confirming && (
        <form action={action} className="mt-2 space-y-1">
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="nodeId" value={item.nodeId} />
          <input
            name="reason"
            required
            placeholder="Reason for deleting (required — evidence isn't discarded silently)"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
          />
          <div className="flex items-center gap-2">
            <button disabled={pending} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">
              {pending ? "…" : "Confirm delete"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-xs text-neutral-500">
              cancel
            </button>
          </div>
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        </form>
      )}
    </li>
  );
}
