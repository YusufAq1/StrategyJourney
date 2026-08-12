"use client";

import { useActionState, useState } from "react";
import { createSignalAction, type FormState } from "../actions";
import { DIMENSIONS, SOURCE_KINDS, dimensionLabel } from "@/lib/constants";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const label = "block text-xs font-medium text-neutral-600 mb-1";

export function SignalForm({ engagementId }: { engagementId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSignalAction, null);
  const [kind, setKind] = useState<string>("web");
  const [credibility, setCredibility] = useState(3);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div>
        <label className={label} htmlFor="label">Signal</label>
        <input id="label" name="label" required placeholder="A sourced fact, stated plainly" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="dimension">Dimension</label>
          <select id="dimension" name="dimension" defaultValue="market" className={field}>
            {DIMENSIONS.map((d) => (
              <option key={d} value={d}>{dimensionLabel(d)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="kind">Source type</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="uri">
          Source URL {kind === "web" ? <span className="text-red-500">(required for web)</span> : <span className="text-neutral-400">(or leave blank)</span>}
        </label>
        <input id="uri" name="uri" type="url" required={kind === "web"} placeholder="https://…" className={field} />
      </div>

      <div>
        <label className={label} htmlFor="reference">
          Reference {kind === "interview" ? <span className="text-red-500">(required — who said it, and when)</span> : <span className="text-neutral-400">(for documents/interviews)</span>}
        </label>
        <input id="reference" name="reference" required={kind === "interview"} placeholder="CFO, Meridian Logistics, executive interview" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="publishedAt">Publication date <span className="text-red-500">*</span></label>
          <input id="publishedAt" name="publishedAt" type="date" required className={field} />
        </div>
        <div>
          <label className={label}>Credibility</label>
          <div className="flex gap-1.5 pt-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCredibility(n)}
                aria-label={`Credibility ${n}`}
                className={`h-[19px] w-[19px] rounded-full border-[1.5px] ${
                  n <= credibility ? "border-brand-500 bg-brand-500" : "border-neutral-300 bg-transparent"
                }`}
              />
            ))}
          </div>
          <input type="hidden" name="credibility" value={credibility} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="excerpt">Excerpt <span className="text-red-500">*</span></label>
        <textarea id="excerpt" name="excerpt" required rows={2} placeholder="The actual words / data that make this a fact" className={field} />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[#171258] px-4 py-3 text-[13.5px] font-bold text-white hover:bg-[#6F40F1] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add signal"}
      </button>
    </form>
  );
}
