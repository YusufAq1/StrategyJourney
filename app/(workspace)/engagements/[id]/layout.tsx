import { createHumanClient } from "@/lib/db/human";
import { getEngagement } from "@/lib/graph/reads";
import { Sidebar } from "./sidebar";

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
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <Sidebar id={id} orgName={eng.orgName} />

      <div className="min-w-0 flex-1">
        <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
          <div className="px-8 py-6">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-brand-500">
              {[eng.industry, eng.horizon, `Stage ${eng.stageCurrent}`].filter(Boolean).join(" · ")}
            </div>
            <h1 className="mt-1 text-xl font-bold text-neutral-900">{eng.name}</h1>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
