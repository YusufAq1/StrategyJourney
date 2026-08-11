import Link from "next/link";
import { notFound } from "next/navigation";
import { createHumanClient } from "@/lib/db/human";
import { getNode } from "@/lib/graph/reads";
import { getProvenance } from "@/lib/graph/provenance";
import { dimensionLabel } from "@/lib/constants";
import { resolveBackTab } from "@/lib/nav";

const typeColor: Record<string, string> = {
  signal: "bg-[#6F40F1] text-white",
  insight: "bg-[#171258] text-white",
  capability: "bg-emerald-700 text-white",
  swot_item: "bg-amber-600 text-white",
  option: "bg-violet-700 text-white",
  choice: "bg-[#C0A15B] text-white",
};

function TypeBadge({ t }: { t: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor[t] ?? "bg-neutral-500 text-white"}`}>
      {t.replace("_", " ")}
    </span>
  );
}

function host(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; nodeId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id, nodeId } = await params;
  const { from } = await searchParams;
  const db = createHumanClient();
  const node = await getNode(db, nodeId);
  if (!node) notFound();

  const chain = await getProvenance(db, nodeId);
  const root = chain.find((r) => r.depth === 0);
  const upstream = chain.filter((r) => r.depth > 0);
  const signalCount = chain.filter((r) => r.nodeType === "signal").length;
  const maxDepth = chain.reduce((m, r) => Math.max(m, r.depth), 0);
  // The tab this node was reached from, so "back" returns there rather than
  // always to the overview — falls back to a type-based tab when reached
  // directly (e.g. a create-action redirect) rather than via a listing page.
  const backTab = resolveBackTab(node.type, from);
  const chainQuery = backTab ? `?from=${backTab}` : "";

  return (
    <div className="space-y-6">
      <Link href={`/engagements/${id}/${backTab}`} className="text-xs text-neutral-500 hover:underline">
        ← back
      </Link>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge t={node.type} />
          {node.dimension && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
              {dimensionLabel(node.dimension)}
            </span>
          )}
          <span className="text-xs text-neutral-400">
            {node.origin}
            {node.staleSince ? " · stale" : ""}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-medium text-[#171258]">{node.label}</h2>
        {root && (root.sourceUri || root.sourceRef) && (
          <div className="mt-2 text-sm text-neutral-600">
            Source:{" "}
            {root.sourceUri ? (
              <a href={root.sourceUri} target="_blank" rel="noreferrer" className="text-[#6F40F1] underline">
                {host(root.sourceUri)}
              </a>
            ) : (
              root.sourceRef
            )}
            {root.publishedAt ? ` · published ${root.publishedAt}` : ""}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">Why is this here?</h3>
          {signalCount > 0 && (
            <span className="text-xs text-neutral-500">
              rests on {signalCount} sourced signal{signalCount === 1 ? "" : "s"} · chain depth {maxDepth}
            </span>
          )}
        </div>

        {upstream.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            This is a root {node.type.replace("_", " ")} — it carries its own source (above), and the chain ends here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upstream.map((r) => (
              <li
                key={`${r.depth}-${r.nodeId}`}
                style={{ marginLeft: (r.depth - 1) * 20 }}
                className="rounded-md border border-neutral-100 bg-neutral-50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-neutral-400">via {r.via}</span>
                  <TypeBadge t={r.nodeType} />
                  <Link href={`/engagements/${id}/nodes/${r.nodeId}${chainQuery}`} className="text-sm text-[#171258] hover:underline">
                    {r.label}
                  </Link>
                </div>
                {r.nodeType === "signal" && (r.sourceUri || r.sourceRef) && (
                  <div className="mt-1 text-xs text-neutral-500">
                    {r.sourceUri ? host(r.sourceUri) : r.sourceRef}
                    {r.publishedAt ? ` · published ${r.publishedAt}` : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
