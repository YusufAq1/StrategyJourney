import Link from "next/link";
import { createHumanClient } from "@/lib/db/human";
import { getEngagement, countByType } from "@/lib/graph/reads";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();
  const [eng, counts] = await Promise.all([getEngagement(db, id), countByType(db, id)]);

  const cards = [
    { label: "Signals", n: counts.signal ?? 0, href: `/engagements/${id}/signals` },
    { label: "Insights", n: counts.insight ?? 0, href: `/engagements/${id}/insights` },
    { label: "Capabilities", n: counts.capability ?? 0, href: `/engagements/${id}` },
  ];

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-400"
          >
            <div className="text-3xl font-semibold text-[#171258]">{c.n}</div>
            <div className="text-sm text-neutral-500">{c.label}</div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">The questions this strategy must answer</h2>
        <ul className="mt-2 space-y-1">
          {eng.keyQuestions.map((q, i) => (
            <li key={i} className="text-sm text-neutral-600">• {q}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
