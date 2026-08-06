import Link from "next/link";
import { createHumanClient } from "@/lib/db/human";
import { getEngagement } from "@/lib/graph/reads";
import { NavTabs } from "./nav-tabs";

export default async function EngagementLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createHumanClient();
  const eng = await getEngagement(db, id);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#1B4F91]">
              Strategy Platforms · Consultant Workspace
            </div>
            <Link href="/" className="text-xs font-medium text-[#1B4F91] hover:underline">
              ← All clients
            </Link>
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[#13294B]">{eng.name}</h1>
          <div className="text-sm text-neutral-500">
            {eng.orgName}
            {eng.industry ? ` · ${eng.industry}` : ""}
            {eng.horizon ? ` · ${eng.horizon}` : ""} · Stage {eng.stageCurrent}
          </div>
          <NavTabs id={id} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
