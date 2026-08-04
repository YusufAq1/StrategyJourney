import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { SwotView, SwotQuadrant } from "../../graph/queries/types";
import { contentSlide } from "./shared";

// Slide 5 — SWOT as a 2x2 grid. Native text + shapes; each bullet notes how many
// evidence nodes it rests on (the on-screen viewer shows the full chain).
const QUADS: { key: SwotQuadrant; label: string; color: string }[] = [
  { key: "strength", label: "Strengths", color: "2E7D32" },
  { key: "weakness", label: "Weaknesses", color: "C0392B" },
  { key: "opportunity", label: "Opportunities", color: "1B4F91" },
  { key: "threat", label: "Threats", color: "C0A15B" },
];

export function renderQuadGrid(pptx: InstanceType<typeof pptxgen>, vm: SwotView, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = T.margin.left;
  const top = 1.4;
  const W = T.dimensions.widthIn - L - T.margin.right;
  const H = T.dimensions.heightIn - top - 0.5;
  const gap = 0.2;
  const colW = (W - gap) / 2;
  const rowH = (H - gap) / 2;

  QUADS.forEach((q, i) => {
    const cx = L + (i % 2) * (colW + gap);
    const cy = top + Math.floor(i / 2) * (rowH + gap);

    slide.addShape(pptx.ShapeType.rect, {
      x: cx, y: cy, w: colW, h: rowH, fill: { color: T.color.paperAlt }, line: { color: q.color, width: 1.5 },
    });
    slide.addText(`${q.label.toUpperCase()}   ·   ${vm.quadrants[q.key].length}`, {
      x: cx + 0.14, y: cy + 0.08, w: colW - 0.28, h: 0.28, fontFace: T.font.label, fontSize: 11, bold: true, color: q.color,
    });

    const items = vm.quadrants[q.key].slice(0, 6);
    if (items.length > 0) {
      slide.addText(
        items.map((it) => ({
          text: `${it.statement}${it.evidence.length ? `  (${it.evidence.length} src)` : ""}`,
          options: { bullet: { code: "2022" }, breakLine: true, fontSize: 9, paraSpaceAfter: 3 },
        })),
        { x: cx + 0.14, y: cy + 0.44, w: colW - 0.28, h: rowH - 0.54, fontFace: T.font.body, color: T.color.ink, valign: "top" },
      );
    } else {
      slide.addText("(none derived yet)", {
        x: cx + 0.14, y: cy + 0.44, w: colW - 0.28, h: 0.3, fontFace: T.font.body, fontSize: 9, color: T.color.slate,
      });
    }
  });
}
