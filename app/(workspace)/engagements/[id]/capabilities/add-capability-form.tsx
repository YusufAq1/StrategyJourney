"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addCapabilityAction, type FormState } from "../actions";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500";
const label = "block text-xs font-medium text-neutral-600 mb-1";

type Domain = { id: string; label: string };

export function AddCapabilityForm({ engagementId, domains }: { engagementId: string; domains: Domain[] }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"1" | "2">(domains.length > 0 ? "2" : "1");
  const [state, action, pending] = useActionState<FormState, FormData>(addCapabilityAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  // Reset + close once a submission lands without an error.
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
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-[#171258] hover:border-[#6F40F1]"
      >
        + Add capability
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="rounded-lg border border-neutral-200 bg-white p-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="level">Type</label>
          <select id="level" name="level" value={level} onChange={(e) => setLevel(e.target.value as "1" | "2")} className={field}>
            <option value="2" disabled={domains.length === 0}>Capability (under a domain)</option>
            <option value="1">Top-level domain</option>
          </select>
        </div>
        {level === "2" && (
          <div className="sm:col-span-2">
            <label className={label} htmlFor="parentId">Parent domain</label>
            <select id="parentId" name="parentId" className={field} defaultValue={domains[0]?.id ?? ""}>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3">
        <label className={label} htmlFor="capLabel">Name <span className="text-red-500">*</span></label>
        <input id="capLabel" name="label" required placeholder={level === "1" ? "e.g. Commercial & Go-to-Market" : "e.g. Key Account Management"} className={field} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="criticality">Criticality (1–5)</label>
          <select id="criticality" name="criticality" defaultValue="4" className={field}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="maturityRequired">Required (1–5)</label>
          <select id="maturityRequired" name="maturityRequired" defaultValue="4" className={field}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="current">Current (1–5)</label>
          <select id="current" name="current" defaultValue="1" className={field}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {state?.error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#171258] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F40F1] disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add capability"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
