"use client";

import { useState, useTransition } from "react";
import { updateMaturityAction } from "../actions";

// Inline consultant scoring: changing the current-maturity select upserts the
// score and revalidates, so the inventory, gaps and heatmap all move together.
export function MaturityControl({
  engagementId,
  capabilityId,
  value,
}: {
  engagementId: string;
  capabilityId: string;
  value: number;
}) {
  const [val, setVal] = useState(String(value));
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const m = e.target.value;
    setVal(m);
    const fd = new FormData();
    fd.set("engagementId", engagementId);
    fd.set("capabilityId", capabilityId);
    fd.set("maturity", m);
    start(() => {
      void updateMaturityAction(null, fd);
    });
  }

  return (
    <select
      value={val}
      onChange={onChange}
      disabled={pending}
      aria-label="current maturity"
      className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}
