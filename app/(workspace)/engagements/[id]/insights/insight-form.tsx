"use client";

import { useActionState, useState } from "react";
import { createInsightAction, type FormState } from "../actions";
import { dimensionLabel } from "@/lib/constants";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const label = "block text-xs font-medium text-neutral-600 mb-1";

type SignalOption = { id: string; label: string; dimension: string | null };

export function InsightForm({ engagementId, signals }: { engagementId: string; signals: SignalOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInsightAction, null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div>
        <label className={label} htmlFor="label">The insight — the &ldquo;so what&rdquo;</label>
        <textarea id="label" name="label" required rows={2} placeholder="What these signals mean, stated as a claim" className={field} />
      </div>

      <div className="w-40">
        <label className={label} htmlFor="confidence">Confidence (0–1)</label>
        <input id="confidence" name="confidence" type="number" step="0.1" min="0" max="1" placeholder="0.7" className={field} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className={label}>Cite signals <span className="text-red-500">(at least one)</span></span>
          <span className="text-xs text-neutral-500">{checked.size} selected</span>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
          {signals.length === 0 && (
            <p className="px-1 py-2 text-sm text-neutral-500">No signals yet — add some first.</p>
          )}
          {signals.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-neutral-50">
              <input
                type="checkbox"
                name="signalIds"
                value={s.id}
                checked={checked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="text-neutral-800">{s.label}</span>
                {s.dimension && (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                    {dimensionLabel(s.dimension)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || checked.size === 0}
        className="rounded-md bg-[#171258] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F40F1] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add insight"}
      </button>
    </form>
  );
}
