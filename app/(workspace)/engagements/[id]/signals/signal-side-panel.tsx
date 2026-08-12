"use client";

import { useState } from "react";
import { AssistPanel } from "./assist-panel";
import { SignalForm } from "./signal-form";

// One card, two tabs — AI extraction and manual entry share the same panel
// instead of a collapsible "Assist" button stacked above an always-open form.
export function SignalSidePanel({ engagementId }: { engagementId: string }) {
  const [tab, setTab] = useState<"ai" | "manual">("ai");

  return (
    <div className="sticky top-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card">
      <div className="flex border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab("ai")}
          className={`flex-1 border-b-2 px-4 py-3.5 text-[13.5px] font-bold transition-colors ${
            tab === "ai" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-transparent bg-white text-neutral-500 hover:text-neutral-700"
          }`}
        >
          ✨ AI Extract
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex-1 border-b-2 px-4 py-3.5 text-[13.5px] font-bold transition-colors ${
            tab === "manual" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-transparent bg-white text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Manual
        </button>
      </div>

      <div className="p-5">
        {tab === "ai" ? <AssistPanel engagementId={engagementId} /> : <SignalForm engagementId={engagementId} />}
      </div>
    </div>
  );
}
