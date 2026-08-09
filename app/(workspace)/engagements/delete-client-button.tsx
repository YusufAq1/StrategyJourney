"use client";

import { useActionState, useState } from "react";
import { deleteEngagementAction, type FormState } from "./actions";

// Sits as a sibling to the card's <Link>, not nested inside it, so the click
// target never fights page navigation. Deleting a client is permanent and
// cascades through every signal, insight, capability, SWOT item, option,
// choice, and decision log it has — the confirm step requires typing the
// client's name back, the same weight GitHub gives repo deletion.
export function DeleteClientButton({ engagementId, orgName }: { engagementId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(deleteEngagementAction, null);
  const matches = confirmText.trim() === orgName;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Delete ${orgName}`}
        className="rounded-md bg-white/90 px-2 py-1 text-xs text-neutral-400 shadow-sm ring-1 ring-neutral-200 hover:bg-red-50 hover:text-red-700"
      >
        Delete
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-[#13294B]">Delete {orgName}?</h2>
            <p className="mt-2 text-xs text-neutral-600">
              This permanently deletes every signal, insight, capability, SWOT item, option, choice, and decision log
              for this client. This cannot be undone.
            </p>
            <form action={action} className="mt-4">
              <input type="hidden" name="engagementId" value={engagementId} />
              <label className="block text-xs font-medium text-neutral-700">
                Type <span className="font-semibold">{orgName}</span> to confirm
              </label>
              <input
                type="text"
                name="confirmName"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
                className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#1B4F91] focus:outline-none"
              />
              {state?.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setConfirmText("");
                  }}
                  className="rounded-md px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!matches || pending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Deleting…" : "Delete client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
