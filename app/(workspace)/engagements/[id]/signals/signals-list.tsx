"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SignalRow } from "@/lib/graph/reads";
import { dimensionLabel } from "@/lib/constants";
import { DeleteNodeButton } from "../delete-node-button";
import { nodeHref } from "@/lib/nav";

type Group = "market" | "competitor" | "pestel";

// Groups every signal.payload.dimension (CLAUDE.md §3) into the three families
// the filter pills expose — mirrors the design's groupOf().
function groupOf(dimension: string | null): Group {
  if (!dimension) return "competitor";
  if (dimension.startsWith("pestel_")) return "pestel";
  if (dimension === "market" || dimension === "customer") return "market";
  return "competitor";
}

const GROUP_META: Record<Group, { accent: string; tint: string; label: string }> = {
  market: { accent: "#6F40F1", tint: "rgba(111,64,241,0.09)", label: "Market & Customer" },
  competitor: { accent: "#FF4151", tint: "rgba(255,65,81,0.09)", label: "Competitor & Internal" },
  pestel: { accent: "#007BFC", tint: "rgba(0,123,252,0.09)", label: "PESTEL Context" },
};

const FILTERS: { key: "all" | Group; label: string }[] = [
  { key: "all", label: "All signals" },
  { key: "market", label: GROUP_META.market.label },
  { key: "competitor", label: GROUP_META.competitor.label },
  { key: "pestel", label: GROUP_META.pestel.label },
];

function host(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

export function SignalsList({ engagementId, signals }: { engagementId: string; signals: SignalRow[] }) {
  const [activeFilter, setActiveFilter] = useState<"all" | Group>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signals.filter((s) => {
      if (activeFilter !== "all" && groupOf(s.dimension) !== activeFilter) return false;
      if (q && !s.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [signals, activeFilter, search]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-extrabold text-neutral-900">Signals</h2>
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-600">{signals.length}</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search signals…"
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
        {filtered.map((s) => {
          const meta = GROUP_META[groupOf(s.dimension)];
          const cred = s.source?.credibility ?? 0;
          return (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-[22px] py-[18px] shadow-card"
              style={{ borderLeft: `4px solid ${meta.accent}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={nodeHref(engagementId, s.id, "signals")}
                  className="text-[15.5px] font-semibold leading-snug text-neutral-900 hover:underline"
                >
                  {s.label}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {s.dimension && (
                    <span
                      className="whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                      style={{ background: meta.tint, color: meta.accent }}
                    >
                      {dimensionLabel(s.dimension)}
                    </span>
                  )}
                  <DeleteNodeButton kind="signal" engagementId={engagementId} nodeId={s.id} confirmLabel="Delete signal?" variant="icon" />
                </div>
              </div>
              {s.source && (
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-500">
                  <span>
                    {s.source.kind} · {s.source.uri ? host(s.source.uri) : s.source.reference} · published {s.source.publishedAt}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="flex gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < cred ? meta.accent : "#E1E5F0" }} />
                      ))}
                    </span>
                    <span>{cred}/5</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400">
            {signals.length === 0 ? "No signals yet — add the first one." : "No signals match your search."}
          </div>
        )}
      </div>
    </section>
  );
}
