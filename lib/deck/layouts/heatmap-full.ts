import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { CapabilityHeatmap } from "../../graph/queries/types";
import { layoutHeatmap, colorFor } from "../../charts/heatmap";
import { contentSlide } from "./shared";

// Slide 3. Renders the SAME layout model as the portal SVG (lib/charts/heatmap),
// but as native, editable PPTX shapes — identical geometry and colour.
const K = 1.55; // scale factor: fills the slide width
const S = K / 96; // inches per model-pixel

export function renderHeatmapFull(pptx: InstanceType<typeof pptxgen>, vm: CapabilityHeatmap, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = layoutHeatmap(vm);
  const originX = (T.dimensions.widthIn - L.width * S) / 2;
  const originY = 1.5;
  const pt = (px: number) => Math.max(6, Math.round(px * S * 72));

  for (const g of L.groups) {
    slide.addText(g.label, {
      x: originX + g.x * S, y: originY + g.y * S, w: g.w * S, h: g.h * S,
      fontFace: T.font.heading, fontSize: pt(12), color: T.color.navy, bold: true, valign: "middle", align: "left",
    });
  }

  for (const c of L.cells) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: originX + c.x * S, y: originY + c.y * S, w: c.w * S, h: c.h * S,
      fill: { color: c.fill }, line: { type: "none" }, rectRadius: 0.04,
    });
    slide.addText(
      [
        { text: c.label, options: { bold: true, breakLine: true, fontSize: pt(12) } },
        { text: c.sub, options: { fontSize: pt(10), breakLine: true } },
      ],
      {
        x: originX + c.x * S + 0.08, y: originY + c.y * S + 0.05, w: c.w * S - 0.16, h: c.h * S - 0.1,
        color: c.textColor, fontFace: T.font.body, valign: "top", align: "left",
      },
    );
    slide.addText(c.badge, {
      x: originX + c.x * S, y: originY + c.y * S + 0.05, w: c.w * S - 0.1, h: 0.2,
      color: c.textColor, fontFace: T.font.label, fontSize: pt(10), bold: true, align: "right", valign: "top",
    });
  }

  // legend — five swatches sampled from the same colour ramp
  const lx = originX + L.legend.x * S;
  const ly = originY + L.legend.y * S;
  const segW = (L.legend.w * S) / 5;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    slide.addShape(pptx.ShapeType.rect, {
      x: lx + i * segW, y: ly, w: segW, h: L.legend.h * S,
      fill: { color: colorFor(vm.scale.min + t * (vm.scale.max - vm.scale.min), vm.scale) }, line: { type: "none" },
    });
  }
  slide.addText(L.legend.minLabel, { x: lx, y: ly + L.legend.h * S, w: 1, h: 0.2, fontSize: 8, color: T.color.slate, fontFace: T.font.label });
  slide.addText(L.legend.maxLabel, { x: lx + L.legend.w * S - 1, y: ly + L.legend.h * S, w: 1, h: 0.2, fontSize: 8, color: T.color.slate, fontFace: T.font.label, align: "right" });
}
