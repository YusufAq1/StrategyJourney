import Link from "next/link";
import { BrandMark } from "./brand-mark";

// The shell for every route outside an open engagement (client list, new
// client form). Mirrors EngagementSidebar's chrome so the app reads as one
// product, but there are no numbered steps here — just the one section.
export function HomeSidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-neutral-200 bg-white px-5 py-6">
      <div className="mb-10 px-1">
        <BrandMark />
        <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-neutral-400">
          Consultant Workspace
        </div>
      </div>

      <nav className="space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
              <path d="M3 8.5 9 3l7 5.5M4.5 8v7.5A1 1 0 0 0 5.5 16.5h9a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Clients
        </Link>
      </nav>

      <div className="mt-auto space-y-3 px-1 pt-6">
        <Link
          href="/engagements/new"
          className="block rounded-xl bg-neutral-900 px-3 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-600"
        >
          + New client
        </Link>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Strategy Platforms · prototype v0.1
        </p>
      </div>
    </aside>
  );
}
