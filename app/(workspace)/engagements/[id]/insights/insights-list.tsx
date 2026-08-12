"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { InsightRow } from "@/lib/graph/reads";
import { DeleteNodeButton } from "../delete-node-button";
import { nodeHref } from "@/lib/nav";

type Tier = "high" | "medium" | "low" | "unrated";

// Confidence stands in for signals' dimension — the one continuous field every
// insight carries — grouped into the same three-tier-plus-unset shape the
// filter pills expose.
function tierOf(confidence: number | null): Tier {
  if (confidence == null) return "unrated";
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

const TIER_META: Record<Tier, { accent: string; tint: string; label: string }> = {
  high: { accent: "#6F40F1", tint: "rgba(111,64,241,0.09)", label: "High confidence" },
  medium: { accent: "#007BFC", tint: "rgba(0,123,252,0.09)", label: "Medium confidence" },
  low: { accent: "#FF4151", tint: "rgba(255,65,81,0.09)", label: "Low confidence" },
  unrated: { accent: "#7B81A3", tint: "#ECEEF6", label: "Unrated" },
};

const FILTERS: { key: "all" | Tier; label: string }[] = [
  { key: "all", label: "All insights" },
  { key: "high", label: TIER_META.high.label },
  { key: "medium", label: TIER_META.medium.label },
  { key: "low", label: TIER_META.low.label },
  { key: "unrated", label: TIER_META.unrated.label },
];

export function InsightsList({ engagementId, insights }: { engagementId: string; insights: InsightRow[] }) {
  const [activeFilter, setActiveFilter] = useState<"all" | Tier>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return insights.filter((i) => {
      if (activeFilter !== "all" && tierOf(i.confidence) !== activeFilter) return false;
      if (q && !i.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [insights, activeFilter, search]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-extrabold text-neutral-900">Insights</h2>
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-600">{insights.length}</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search insights…"
          className="w-56 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((i) => {
          const tier = tierOf(i.confidence);
          const meta = TIER_META[tier];
          const dots = i.confidence != null ? Math.round(i.confidence * 5) : 0;
          return (
            <div
              key={i.id}
              className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-[22px] py-[18px] shadow-card"
              style={{ borderLeft: `4px solid ${meta.accent}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={nodeHref(engagementId, i.id, "insights")}
                  className="text-[15.5px] font-semibold leading-snug text-neutral-900 hover:underline"
                >
                  {i.label}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ background: meta.tint, color: meta.accent }}
                  >
                    {i.confidence != null ? `${i.confidence.toFixed(1)} confidence` : "Unrated"}
                  </span>
                  <DeleteNodeButton kind="insight" engagementId={engagementId} nodeId={i.id} confirmLabel="Delete insight?" variant="icon" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-500">
                <span>
                  cites {i.citationCount} signal{i.citationCount === 1 ? "" : "s"}
                </span>
                {i.confidence != null && (
                  <span className="flex items-center gap-1">
                    <span className="flex gap-0.5">
                      {[0, 1, 2, 3, 4].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: d < dots ? meta.accent : "#E1E5F0" }} />
                      ))}
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400">
            {insights.length === 0 ? "No insights yet — capture the first one." : "No insights match your search."}
          </div>
        )}
      </div>
    </section>
  );
}
