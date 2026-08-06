"use client";

import { useActionState, useState } from "react";
import {
  deleteSignalAction,
  deleteInsightAction,
  deleteCapabilityAction,
  type FormState,
} from "./actions";

const ACTIONS = {
  signal: deleteSignalAction,
  insight: deleteInsightAction,
  capability: deleteCapabilityAction,
} as const;

// Small inline delete control: a trash affordance that reveals a confirm, then
// submits the matching server action. Errors (e.g. a signal that's an insight's
// only evidence) surface inline.
export function DeleteNodeButton({
  kind,
  engagementId,
  nodeId,
  confirmLabel,
}: {
  kind: keyof typeof ACTIONS;
  engagementId: string;
  nodeId: string;
  confirmLabel?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(ACTIONS[kind], null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-700"
          aria-label="Delete"
        >
          Delete
        </button>
        {state?.error && <span className="max-w-xs text-right text-[11px] text-red-700">{state.error}</span>}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="nodeId" value={nodeId} />
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-neutral-500">{confirmLabel ?? "Delete?"}</span>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
        >
          No
        </button>
      </div>
      {state?.error && <span className="max-w-xs text-right text-[11px] text-red-700">{state.error}</span>}
    </form>
  );
}
