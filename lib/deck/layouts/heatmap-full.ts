import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { CapabilityHeatmap } from "../../graph/queries/types";
import { layoutHeatmap, colorFor } from "../../charts/heatmap";
import { contentSlide } from "./shared";

// Slide 3. Renders the SAME layout model as the portal SVG (lib/charts/heatmap),
// but as native, editable PPTX shapes — identical geometry and colour. The card
// grid grows taller with more capabilities (unlike the old fixed-row grid), so
// the scale factor is fit to the model's actual size each render rather than
// fixed — the model geometry itself never changes, only how it's scaled into
// the slide's inches.
const ORIGIN_Y = 1.4;

export function renderHeatmapFull(pptx: InstanceType<typeof pptxgen>, vm: CapabilityHeatmap, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = layoutHeatmap(vm);

  const maxWIn = T.dimensions.widthIn - T.margin.left - T.margin.right;
  const maxHIn = T.dimensions.heightIn - ORIGIN_Y - 0.4;
  const K = Math.min((maxWIn * 96) / L.width, (maxHIn * 96) / L.height, 1.3);
  const S = K / 96; // inches per model-pixel

  const originX = (T.dimensions.widthIn - L.width * S) / 2;
  const originY = ORIGIN_Y;
  const pt = (px: number) => Math.max(6, Math.round(px * S * 72));

  for (const g of L.groups) {
    slide.addText(g.label.toUpperCase(), {
      x: originX + g.x * S, y: originY + g.y * S, w: g.w * S, h: 0.2,
      fontFace: T.font.heading, fontSize: pt(12), color: "3A4A6B", bold: true, valign: "top", align: "left",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: originX + g.x * S, y: originY + g.underlineY * S, w: g.w * S, h: 0,
      line: { color: "E1E4E9", width: 0.75 },
    });
  }

  for (const c of L.cells) {
    const cx = originX + c.x * S;
    const cy = originY + c.y * S;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: cx, y: cy, w: c.w * S, h: c.h * S,
      fill: { color: c.fill }, line: { type: "none" }, rectRadius: 0.06,
    });

    slide.addText(c.label, {
      x: cx + 0.19, y: cy + 0.15, w: c.nameBoxW * S, h: 0.32,
      color: c.textColor, fontFace: T.font.heading, fontSize: pt(13.5), bold: true, valign: "top", align: "left",
    });

    const b = c.badge;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: originX + b.x * S, y: originY + b.y * S, w: b.w * S, h: b.h * S,
      fill: { color: c.badgeBg }, line: { type: "none" }, rectRadius: 0.09,
    });
    slide.addText(b.text, {
      x: originX + b.x * S, y: originY + b.y * S, w: b.w * S, h: b.h * S,
      color: c.textColor, fontFace: T.font.label, fontSize: pt(10.5), bold: true, valign: "middle", align: "center",
    });

    const bar = c.bar;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: originX + bar.trackX * S, y: originY + bar.trackY * S, w: bar.trackW * S, h: bar.trackH * S,
      fill: { color: c.trackBg }, line: { type: "none" }, rectRadius: 0.02,
    });
    if (bar.fillW > 0) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: originX + bar.trackX * S, y: originY + bar.trackY * S, w: bar.fillW * S, h: bar.trackH * S,
        fill: { color: c.fillBg }, line: { type: "none" }, rectRadius: 0.02,
      });
    }
    slide.addShape(pptx.ShapeType.roundRect, {
      x: originX + bar.tickX * S, y: originY + bar.tickY * S, w: bar.tickW * S, h: bar.tickH * S,
      fill: { color: c.textColor }, line: { type: "none" }, rectRadius: 0.01,
    });
    slide.addText(bar.label, {
      x: originX + bar.trackX * S, y: originY + bar.labelY * S - 0.13, w: bar.trackW * S, h: 0.2,
      color: c.mutedColor, fontFace: T.font.body, fontSize: pt(11), valign: "top", align: "left",
    });

    slide.addText(c.critLabel.text, {
      x: cx + 0.19, y: originY + c.critLabel.y * S - 0.13, w: c.nameBoxW * S, h: 0.2,
      color: c.mutedColor, fontFace: T.font.body, fontSize: pt(11), valign: "top", align: "left",
    });
  }

  // legend — divider + five swatches sampled from the same colour ramp
  const legend = L.legend;
  slide.addShape(pptx.ShapeType.line, {
    x: originX + legend.x * S, y: originY + legend.dividerY * S, w: legend.w * S, h: 0,
    line: { color: "E1E4E9", width: 0.75 },
  });
  const lx = originX + legend.x * S;
  const ly = originY + legend.y * S;
  const segW = (legend.w * S) / 5;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    slide.addShape(pptx.ShapeType.rect, {
      x: lx + i * segW, y: ly, w: segW, h: legend.h * S,
      fill: { color: colorFor(vm.scale.min + t * (vm.scale.max - vm.scale.min), vm.scale) }, line: { type: "none" },
    });
  }
  slide.addText(legend.minLabel, { x: lx, y: ly + legend.h * S + 0.02, w: 1, h: 0.2, fontSize: 9, color: T.color.slate, fontFace: T.font.label });
  slide.addText(legend.maxLabel, { x: lx + legend.w * S - 1, y: ly + legend.h * S + 0.02, w: 1, h: 0.2, fontSize: 9, color: T.color.slate, fontFace: T.font.label, align: "right" });
}
