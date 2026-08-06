import { createHumanClient } from "@/lib/db/human";
import { composeDeck, HOUSE_TEMPLATE_ID } from "@/lib/deck/compose";
import { renderDeck } from "@/lib/deck/render";

// pptxgenjs needs the Node runtime; always render fresh from the graph.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createHumanClient();

  const started = Date.now();
  const { slides, report } = await composeDeck(db, id);
  const pptx = renderDeck(slides);
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const durationMs = Date.now() - started;

  // Instrument every render (CLAUDE.md §9): timing + which slides are unbacked.
  await db.from("deck_render").insert({
    deck_template_id: HOUSE_TEMPLATE_ID,
    engagement_id: id,
    slides_changed: report,
    unbacked_slide_count: report.filter((r) => r.unbacked).length,
    duration_ms: durationMs,
  });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": 'attachment; filename="strategy-journey-deck.pptx"',
    },
  });
}
