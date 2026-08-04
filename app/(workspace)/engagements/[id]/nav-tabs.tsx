"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/engagements/${id}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/signals`, label: "Signals", exact: false },
    { href: `${base}/insights`, label: "Insights", exact: false },
    { href: `${base}/capabilities`, label: "Capabilities", exact: false },
    { href: `${base}/swot`, label: "SWOT", exact: false },
  ];
  return (
    <nav className="mt-3 flex gap-1">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              active ? "bg-[#13294B] text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
