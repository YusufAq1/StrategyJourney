"use client";

import { useActionState } from "react";
import { createEngagementAction, type FormState } from "../actions";

const field = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const label = "block text-xs font-medium text-neutral-600 mb-1";

export function NewClientForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createEngagementAction, null);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="orgName">Client company <span className="text-red-500">*</span></label>
          <input id="orgName" name="orgName" required placeholder="Acme Logistics" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="industry">Industry</label>
          <input id="industry" name="industry" placeholder="Freight & logistics" className={field} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="name">Engagement name <span className="text-red-500">*</span></label>
        <input id="name" name="name" required placeholder="Growth strategy 2026" className={field} />
      </div>

      <div>
        <label className={label} htmlFor="description">Company description</label>
        <textarea id="description" name="description" rows={2} placeholder="A sentence or two on what the company does and its current situation." className={field} />
      </div>

      <div>
        <label className={label} htmlFor="horizon">Planning horizon</label>
        <input id="horizon" name="horizon" placeholder="3 years" className={field} />
      </div>

      <div>
        <label className={label} htmlFor="keyQuestions">Key strategic questions <span className="text-neutral-400">(one per line)</span></label>
        <textarea
          id="keyQuestions"
          name="keyQuestions"
          rows={4}
          placeholder={"Where should we grow next?\nWhich capabilities must we build to get there?"}
          className={field}
        />
      </div>

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#171258] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F40F1] disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create client & start"}
        </button>
        <span className="text-xs text-neutral-400">
          A starter capability inventory is added automatically — you can edit it on the Capabilities tab.
        </span>
      </div>
    </form>
  );
}
