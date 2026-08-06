"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addSwotAction, type FormState } from "../actions";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const label = "block text-xs font-medium text-neutral-600 mb-1";

type EvidenceOption = { id: string; label: string; kind: "signal" | "capability" };

const QUADRANTS = [
  { value: "strength", label: "Strength" },
  { value: "weakness", label: "Weakness" },
  { value: "opportunity", label: "Opportunity" },
  { value: "threat", label: "Threat" },
] as const;

export function AddSwotForm({ engagementId, evidence }: { engagementId: string; evidence: EvidenceOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(addSwotAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-[#13294B] hover:border-[#1B4F91]"
      >
        + Add SWOT item
      </button>
    );
  }

  const signals = evidence.filter((e) => e.kind === "signal");
  const capabilities = evidence.filter((e) => e.kind === "capability");

  return (
    <form ref={formRef} action={action} className="w-full max-w-2xl rounded-lg border border-neutral-200 bg-white p-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <label className={label} htmlFor="quadrant">Quadrant</label>
          <select id="quadrant" name="quadrant" defaultValue="strength" className={field}>
            {QUADRANTS.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="statement">Statement <span className="text-red-500">*</span></label>
          <input id="statement" name="statement" required placeholder="One specific, falsifiable sentence" className={field} />
        </div>
      </div>

      <div className="mt-3">
        <label className={label} htmlFor="rationale">Rationale <span className="text-neutral-400">(optional)</span></label>
        <textarea id="rationale" name="rationale" rows={2} placeholder="Why this matters — becomes speaker notes." className={field} />
      </div>

      <div className="mt-3">
        <div className={label}>Evidence <span className="text-neutral-400">(optional — items without evidence are flagged unsupported)</span></div>
        <div className="max-h-40 overflow-y-auto rounded-md border border-neutral-200 p-2 text-sm">
          {evidence.length === 0 ? (
            <p className="text-xs text-neutral-400">No signals or capabilities to cite yet.</p>
          ) : (
            <>
              {signals.length > 0 && (
                <fieldset className="mb-2">
                  <legend className="text-[10px] uppercase tracking-wide text-neutral-400">Signals</legend>
                  {signals.map((e) => (
                    <label key={e.id} className="flex items-start gap-2 py-0.5 text-xs text-neutral-700">
                      <input type="checkbox" name="evidenceIds" value={e.id} className="mt-0.5" />
                      <span>◆ {e.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {capabilities.length > 0 && (
                <fieldset>
                  <legend className="text-[10px] uppercase tracking-wide text-neutral-400">Capabilities</legend>
                  {capabilities.map((e) => (
                    <label key={e.id} className="flex items-start gap-2 py-0.5 text-xs text-neutral-700">
                      <input type="checkbox" name="evidenceIds" value={e.id} className="mt-0.5" />
                      <span>▲ {e.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
        </div>
      </div>

      {state?.error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#13294B] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F91] disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add item"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
