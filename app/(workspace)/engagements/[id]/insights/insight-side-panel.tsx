"use client";

import { useState } from "react";
import { SuggestInsights } from "./suggest-insights";
import { InsightForm } from "./insight-form";

type SignalOption = { id: string; label: string; dimension: string | null };

// Same shell as the Signals side panel: one card, two tabs, instead of a
// collapsible "Suggest" button stacked above an always-open form.
export function InsightSidePanel({ engagementId, signals }: { engagementId: string; signals: SignalOption[] }) {
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
          ✨ AI Suggest
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
        {tab === "ai" ? <SuggestInsights engagementId={engagementId} /> : <InsightForm engagementId={engagementId} signals={signals} />}
      </div>
    </div>
  );
}
