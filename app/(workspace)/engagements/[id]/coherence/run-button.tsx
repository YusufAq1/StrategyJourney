"use client";

import { useActionState } from "react";
import { runCoherenceAction, type FormState } from "../actions";

export function RunCoherenceButton({ engagementId, hasRun }: { engagementId: string; hasRun: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(runCoherenceAction, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="engagementId" value={engagementId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#13294B] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F91] disabled:opacity-50"
      >
        {pending ? "Running checks…" : hasRun ? "Re-run checks" : "Run coherence checks"}
      </button>
      {state?.error && <p className="max-w-md rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
