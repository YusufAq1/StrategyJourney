import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { CapabilityGaps } from "../../graph/queries/types";
import { colorFor } from "../../charts/heatmap";
import { contentSlide } from "./shared";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Slide 4. Priority capability gaps — native text + bar shapes (editable in
// PowerPoint and Google Slides). Ordered by gapWeighted; bars share the
// heatmap's colour ramp so the two slides read as one system.
export function renderRankedList(pptx: InstanceType<typeof pptxgen>, vm: CapabilityGaps, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = T.margin.left;
  const W = T.dimensions.widthIn - L - T.margin.right;

  slide.addText(
    `${vm.totalBelowRequired} of ${vm.totalAssessed} assessed capabilities are below required maturity`,
    { x: L, y: 1.28, w: W, h: 0.3, fontFace: T.font.body, fontSize: 12, color: T.color.slate },
  );

  const maxGW = Math.max(1, ...vm.gaps.map((g) => g.gapWeighted));
  const rowH = 0.56;
  const top = 1.85;
  const labelW = 3.2;
  const metricW = 1.7;
  const barX = L + labelW + 0.2;
  const barMaxW = W - labelW - 0.2 - metricW - 0.15;

  vm.gaps.forEach((g, i) => {
    const y = top + i * rowH;
    slide.addText(g.label, {
      x: L, y, w: labelW, h: 0.26, fontFace: T.font.heading, fontSize: 12, color: T.color.ink, bold: true, valign: "middle",
    });
    slide.addText(g.parentLabel ?? "", {
      x: L, y: y + 0.24, w: labelW, h: 0.18, fontFace: T.font.label, fontSize: 8, color: T.color.slate, valign: "middle",
    });

    slide.addShape(pptx.ShapeType.rect, { x: barX, y: y + 0.06, w: barMaxW, h: rowH - 0.26, fill: { color: T.color.paperAlt }, line: { type: "none" } });
    const barW = Math.max(0.06, (g.gapWeighted / maxGW) * barMaxW);
    slide.addShape(pptx.ShapeType.rect, {
      x: barX, y: y + 0.06, w: barW, h: rowH - 0.26,
      fill: { color: colorFor(g.gap, { min: 0, max: 4, midpoint: 2 }) }, line: { type: "none" },
    });

    slide.addText(`${fmt(g.maturityCurrent)}→${g.maturityRequired}  ·  crit ${g.criticality}  ·  gw ${g.gapWeighted}`, {
      x: barX + barMaxW + 0.12, y, w: metricW, h: rowH - 0.2, fontFace: T.font.label, fontSize: 9, color: T.color.slate, valign: "middle",
    });
  });
}
