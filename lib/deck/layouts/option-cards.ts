import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { OptionsView } from "../../graph/queries/types";
import { contentSlide } from "./shared";

// Slide 6 — options considered. Unranked cards; the chosen one (if any) is
// outlined. Native text/shapes. This is half of the Rule 3 demonstration.
export function renderOptionCards(pptx: InstanceType<typeof pptxgen>, vm: OptionsView, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = T.margin.left;
  const top = 1.4;
  const W = T.dimensions.widthIn - L - T.margin.right;
  const H = T.dimensions.heightIn - top - 0.5;

  slide.addText("Machine-generated · unranked · the choice beside them is human-made", {
    x: L, y: 1.15, w: W, h: 0.2, fontFace: T.font.label, fontSize: 9, color: T.color.slate,
  });

  const opts = vm.options.slice(0, 8);
  const cols = 2;
  const gap = 0.18;
  const colW = (W - gap * (cols - 1)) / cols;
  const rows = Math.max(1, Math.ceil(opts.length / cols));
  const rowH = (H - gap * (rows - 1)) / rows;

  opts.forEach((o, i) => {
    const cx = L + (i % cols) * (colW + gap);
    const cy = top + Math.floor(i / cols) * (rowH + gap);
    slide.addShape(pptx.ShapeType.rect, {
      x: cx, y: cy, w: colW, h: rowH,
      fill: { color: T.color.paper },
      line: { color: o.selected ? T.color.gold : T.color.line, width: o.selected ? 1.5 : 0.75 },
    });
    slide.addText(
      [
        { text: o.label, options: { bold: true, fontSize: 10, color: T.color.navy, breakLine: true } },
        { text: o.theBet, options: { fontSize: 8, color: T.color.ink, breakLine: true, paraSpaceBefore: 2 } },
        { text: `Against: ${o.strongestArgumentAgainst}`, options: { fontSize: 8, italic: true, color: "C0392B", breakLine: true, paraSpaceBefore: 2 } },
      ],
      { x: cx + 0.1, y: cy + 0.08, w: colW - 0.2, h: rowH - 0.16, fontFace: T.font.body, valign: "top", align: "left" },
    );
    if (o.selected) {
      slide.addText("CHOSEN", { x: cx + colW - 0.95, y: cy + 0.06, w: 0.85, h: 0.16, fontFace: T.font.label, fontSize: 7, bold: true, color: "C0A15B", align: "right" });
    }
  });
}
