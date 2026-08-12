"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EvidenceRef } from "@/lib/graph/queries/types";
import { nodeHref, type NodeTab } from "@/lib/nav";

const TYPE_GLYPH: Record<EvidenceRef["type"], string> = {
  signal: "◆",
  capability: "▲",
  swot_item: "★",
};
const TYPE_LABEL: Record<EvidenceRef["type"], string> = {
  signal: "Signal",
  capability: "Capability",
  swot_item: "SWOT item",
};

export function EvidencePopover({
  engagementId,
  evidence,
  from = "options",
}: {
  engagementId: string;
  evidence: EvidenceRef[];
  from?: NodeTab;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (evidence.length === 0) return null;

  return (
    <div ref={ref} className="relative mt-2 inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-200"
      >
        Evidence · {evidence.length}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-md border border-neutral-200 bg-white shadow-lg">
          <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
            {evidence.map((e) => (
              <li key={e.nodeId}>
                <Link
                  href={nodeHref(engagementId, e.nodeId, from)}
                  className="block px-3 py-2 hover:bg-neutral-50"
                  onClick={() => setOpen(false)}
                >
                  <p className="text-xs text-neutral-800">
                    <span className="text-neutral-400">{TYPE_GLYPH[e.type]}</span>{" "}
                    <span className="text-neutral-500">{TYPE_LABEL[e.type]} · </span>
                    {e.label}
                  </p>
                  {(e.sourceRef || e.publishedAt) && (
                    <p className="mt-0.5 text-[10px] text-neutral-400">
                      {[e.sourceRef, e.publishedAt].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
