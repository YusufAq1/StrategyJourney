import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";

// Shared chrome for content slides (title bar, brand band, footer). Cover has
// its own composition; slides 2-7 use this.
export function contentSlide(pptx: InstanceType<typeof pptxgen>, title: string) {
  const W = T.dimensions.widthIn;
  const slide = pptx.addSlide();
  slide.background = { color: T.color.paper };

  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: T.dimensions.heightIn, fill: { color: T.color.navy }, line: { type: "none" } });

  slide.addText("STRATEGY PLATFORMS", {
    x: T.margin.left, y: 0.32, w: 6, h: 0.24,
    fontFace: T.font.label, fontSize: 9, color: T.color.blue, bold: true, charSpacing: 3,
  });
  slide.addText(title, {
    x: T.margin.left, y: 0.58, w: W - T.margin.left - T.margin.right, h: 0.5,
    fontFace: T.font.display, fontSize: T.size.slideTitle, color: T.color.navy, bold: true,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: T.margin.left, y: 1.18, w: W - T.margin.left - T.margin.right, h: 0, line: { color: T.color.line, width: 1 },
  });

  slide.addText(
    `Consultant Workspace — prototype v0.1${T.meta.isPlaceholder ? "   ·   theme: PLACEHOLDER (not SP brand)" : ""}`,
    { x: T.margin.left, y: T.dimensions.heightIn - 0.35, w: 9, h: 0.2, fontFace: T.font.label, fontSize: T.size.footer, color: T.color.slate },
  );

  return slide;
}

// "static:Foo" title bindings resolve to "Foo".
export function resolveTitle(binding: string): string {
  return binding.startsWith("static:") ? binding.slice(7) : binding;
}
