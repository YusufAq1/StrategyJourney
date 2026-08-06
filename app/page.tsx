import Link from "next/link";
import { format } from "date-fns";
import { createHumanClient } from "@/lib/db/human";
import { listEngagements } from "@/lib/graph/reads";
import { DEMO_ENGAGEMENT_ID } from "@/lib/constants";

// Always reflect the current client list (a newly created client must appear
// immediately), so render on demand rather than prerendering at build time.
export const dynamic = "force-dynamic";

// The front door: every client (engagement) the practice is working on. Click a
// card to open that client's workspace; add a new client with the button. Auth
// is out of scope (CLAUDE.md §4) — anyone with the link sees every client.
export default async function Home() {
  const db = createHumanClient();
  const engagements = await listEngagements(db);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[#1B4F91]">
            Strategy Platforms · Consultant Workspace
          </div>
          <h1 className="mt-1 text-xl font-semibold text-[#13294B]">Clients</h1>
          <p className="text-sm text-neutral-500">Open a client to work on their strategy, or add a new one.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            {engagements.length} client{engagements.length === 1 ? "" : "s"}
          </div>
          <Link
            href="/engagements/new"
            className="rounded-md bg-[#13294B] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F91]"
          >
            + New client
          </Link>
        </div>

        {engagements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-sm text-neutral-600">No clients yet.</p>
            <Link href="/engagements/new" className="mt-2 inline-block text-sm font-medium text-[#1B4F91] hover:underline">
              Add your first client →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {engagements.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/engagements/${e.id}`}
                  className="block h-full rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-[#1B4F91] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-base font-semibold text-[#13294B]">{e.orgName}</div>
                    {e.id === DEMO_ENGAGEMENT_ID ? (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                        Demo
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-sm text-neutral-600">{e.name}</div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {e.industry ? <span>{e.industry}</span> : null}
                    {e.horizon ? <span>· {e.horizon}</span> : null}
                    <span>· added {format(new Date(e.createdAt), "d LLL yyyy")}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
