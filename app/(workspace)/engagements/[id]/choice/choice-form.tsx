"use client";

import { useState, useActionState } from "react";
import { makeChoiceAction, type FormState } from "../actions";

type Opt = { id: string; label: string };
type Trace = { id: string; type: string; label: string };

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm";
const label = "block text-xs font-medium text-neutral-600 mb-1";

export function ChoiceForm({ engagementId, options, traceables }: { engagementId: string; options: Opt[]; traceables: Trace[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(makeChoiceAction, null);
  const [selected, setSelected] = useState<string>("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="optionsJson" value={JSON.stringify(options)} />

      <div>
        <label className={label}>The choice — a full sentence</label>
        <textarea name="statement" required rows={2} placeholder="e.g. Meridian will compete on guaranteed same-day cross-border clearance." className={field} />
      </div>

      <div>
        <span className={label}>Which option are you choosing? <span className="text-red-500">*</span></span>
        <div className="space-y-1 rounded-md border border-neutral-200 p-2">
          {options.map((o) => (
            <div key={o.id} className="rounded p-1">
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="selectedOption" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} required className="mt-1" />
                <span className="text-neutral-800">{o.label}</span>
              </label>
              {selected !== o.id && (
                <input
                  name={`whyNot_${o.id}`}
                  placeholder="Why not this one? (recorded as an alternative considered)"
                  className="mt-1 ml-6 w-[calc(100%-1.5rem)] rounded border border-neutral-200 px-2 py-1 text-xs"
                />
              )}
            </div>
          ))}
          {options.length === 0 && <p className="px-1 py-2 text-xs text-neutral-500">No options yet — generate options first.</p>}
        </div>
      </div>

      <div>
        <span className={label}>
          What does this rest on? <span className="text-red-500">(at least one insight or SWOT item)</span>
        </span>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
          {traceables.map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="tracesTo" value={t.id} className="mt-1" />
              <span>
                <span className="mr-1 text-[10px] uppercase tracking-wide text-neutral-400">{t.type}</span>
                <span className="text-neutral-700">{t.label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>Rationale</label>
        <textarea name="rationale" required rows={2} className={field} />
      </div>
      <div>
        <label className={label}>Revisit trigger — when should this be reopened?</label>
        <input name="revisitTrigger" placeholder="e.g. top-20 churn exceeds 15%, or a platform entrant wins a flagship account" className={field} />
      </div>

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#13294B] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F91] disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record choice + decision log"}
      </button>
    </form>
  );
}
