import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { SignalSummary } from "../../graph/queries/types";
import { contentSlide } from "./shared";
import { dimensionLabel } from "../../constants";

// Slide 2 — the evidence base. Every signal is sourced and dated; this slide
// establishes that before anything downstream is shown.
export function renderEvidenceSummary(pptx: InstanceType<typeof pptxgen>, vm: SignalSummary, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = T.margin.left;
  const top = 1.45;
  const W = T.dimensions.widthIn - L - T.margin.right;
  const H = T.dimensions.heightIn - top - 0.5;

  const range = vm.dateRange ? `${vm.dateRange.earliest} → ${vm.dateRange.latest}` : "—";
  slide.addText(`${vm.totalSignals} signals · every one sourced and dated · ${range}`, {
    x: L, y: 1.18, w: W, h: 0.22, fontFace: T.font.label, fontSize: 9, color: T.color.slate,
  });

  const dims = vm.byDimension.slice(0, 10);
  const cols = 2;
  const gap = 0.18;
  const colW = (W - gap) / cols;
  const rows = Math.max(1, Math.ceil(dims.length / cols));
  const rowH = (H - gap * (rows - 1)) / rows;

  dims.forEach((d, i) => {
    const cx = L + (i % cols) * (colW + gap);
    const cy = top + Math.floor(i / cols) * (rowH + gap);
    slide.addShape(pptx.ShapeType.rect, { x: cx, y: cy, w: colW, h: rowH, fill: { color: T.color.paperAlt }, line: { color: T.color.line, width: 0.75 } });
    slide.addText(
      [
        { text: dimensionLabel(d.dimension), options: { bold: true, fontSize: 10, color: T.color.navy } },
        { text: `   ${d.count} signal${d.count === 1 ? "" : "s"} · cred ${d.meanCredibility}/5`, options: { fontSize: 9, color: T.color.slate } },
      ],
      { x: cx + 0.12, y: cy + 0.06, w: colW - 0.24, h: 0.24, fontFace: T.font.heading, valign: "middle" },
    );
    slide.addText(
      d.exemplars.map((e) => ({ text: e.label, options: { bullet: { code: "2022" }, breakLine: true, fontSize: 8, paraSpaceAfter: 1 } })),
      { x: cx + 0.12, y: cy + 0.32, w: colW - 0.24, h: rowH - 0.4, fontFace: T.font.body, color: T.color.ink, valign: "top" },
    );
  });
}
