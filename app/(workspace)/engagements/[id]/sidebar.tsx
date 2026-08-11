"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/app/_components/brand-mark";

const STEPS = [
  { href: "", label: "Overview" },
  { href: "/signals", label: "Signals" },
  { href: "/insights", label: "Insights" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/swot", label: "SWOT" },
  { href: "/options", label: "Options" },
  { href: "/choice", label: "Choice" },
  { href: "/coherence", label: "Coherence" },
  { href: "/deck", label: "Deck" },
];

// Numbered-step nav, styled after the client's assessment-flow reference:
// active step gets a filled brand circle + tinted pill, the rest stay quiet
// grey. Every step stays clickable at all times — a consultant's work on a
// live engagement is non-linear, unlike a first-time intake wizard.
export function Sidebar({ id, orgName }: { id: string; orgName: string }) {
  const pathname = usePathname();
  const base = `/engagements/${id}`;

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-neutral-200 bg-white px-5 py-6">
      <div className="mb-1 px-1">
        <BrandMark />
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1 px-1 text-xs font-medium text-neutral-400 transition hover:text-brand-500"
      >
        ← All clients
      </Link>
      <div className="mb-6 mt-1.5 truncate px-1 text-sm font-semibold text-neutral-900" title={orgName}>
        {orgName}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {STEPS.map((step, i) => {
          const href = `${base}${step.href}`;
          const active = step.href === "" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  active ? "bg-brand-500 text-white" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {i + 1}
              </span>
              {step.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-1 pt-4 text-[11px] leading-relaxed text-neutral-400">
        Strategy Platforms · prototype v0.1
      </div>
    </aside>
  );
}
