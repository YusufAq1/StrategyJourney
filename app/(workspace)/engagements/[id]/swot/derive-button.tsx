"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deriveSwotAction, checkAiRunStatusAction, type DerivationState } from "../actions";

const POLL_MS = 2000;

export function DeriveButton({ engagementId, hasItems }: { engagementId: string; hasItems: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DerivationState, FormData>(deriveSwotAction, null);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state && "runId" in state) {
      runIdRef.current = state.runId;
      setPollError(null);
      setPolling(true);
    }
  }, [state]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(async () => {
      const runId = runIdRef.current;
      if (!runId) return;
      const res = await checkAiRunStatusAction(runId);
      if (!res || res.status === "running") return;
      setPolling(false);
      if (res.status === "succeeded") {
        router.refresh();
      } else {
        setPollError(res.error ?? "Derivation failed.");
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [polling, router]);

  const busy = pending || polling;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="engagementId" value={engagementId} />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[#13294B] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F91] disabled:opacity-50"
      >
        {busy ? "Deriving with Sonnet 5…" : hasItems ? "Re-derive SWOT" : "Derive SWOT"}
      </button>
      {state && "error" in state && (
        <p className="max-w-md rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      {pollError && <p className="max-w-md rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{pollError}</p>}
    </form>
  );
}
