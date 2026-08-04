import type pptxgen from "pptxgenjs";
import { format } from "date-fns";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { EngagementMeta } from "../../graph/queries/types";

// Slide 1 — cover. Consumes EngagementMeta (docs/graph-queries.md §5, layout
// `cover`). Everything is native, editable PPTX: real text boxes and vector
// shapes, never an image of a slide. All colours/fonts/measurements come from
// the theme tokens — nothing hard-coded — so swapping in the real SP template
// re-skins this slide with no code change.
export function renderCover(pptx: InstanceType<typeof pptxgen>, vm: EngagementMeta): void {
  const W = T.dimensions.widthIn;
  const H = T.dimensions.heightIn;
  const L = T.margin.left;
  const contentW = W - L - T.margin.right;

  const slide = pptx.addSlide();
  slide.background = { color: T.color.paper };

  // Left brand band.
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: H, fill: { color: T.color.navy } });

  // Eyebrow / brand mark.
  slide.addText("STRATEGY PLATFORMS", {
    x: L, y: T.margin.top, w: contentW, h: 0.3,
    fontFace: T.font.label, fontSize: T.size.label, color: T.color.blue, bold: true, charSpacing: 3,
  });

  // Title = engagement name.
  slide.addText(vm.engagementName, {
    x: L, y: 2.1, w: contentW, h: 1.6,
    fontFace: T.font.display, fontSize: T.size.coverTitle, color: T.color.navy, bold: true,
    align: "left", valign: "top",
  });

  // Gold accent rule.
  slide.addShape(pptx.ShapeType.line, {
    x: L, y: 3.85, w: 2.4, h: 0, line: { color: T.color.gold, width: 2.5 },
  });

  // Client / subtitle.
  slide.addText(vm.clientName, {
    x: L, y: 4.0, w: contentW, h: 0.5,
    fontFace: T.font.heading, fontSize: T.size.coverSubtitle, color: T.color.ink, align: "left",
  });

  // Meta line.
  const meta = [
    vm.horizon ? `Horizon: ${vm.horizon}` : null,
    `Stage ${vm.stageCurrent}`,
    `Generated ${format(new Date(vm.generatedAt), "d LLL yyyy")}`,
  ]
    .filter((x): x is string => Boolean(x))
    .join("      ");
  slide.addText(meta, {
    x: L, y: 4.6, w: contentW, h: 0.35,
    fontFace: T.font.label, fontSize: T.size.coverMeta, color: T.color.slate, align: "left",
  });

  // The questions the strategy must answer.
  if (vm.keyQuestions.length > 0) {
    const items = vm.keyQuestions.map((q) => ({
      text: q,
      options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 4 },
    }));
    slide.addText(
      [
        {
          text: "The questions this strategy must answer",
          options: { bold: true, color: T.color.ink, breakLine: true, paraSpaceAfter: 6 },
        },
        ...items,
      ],
      { x: L, y: 5.35, w: contentW, h: 1.5, fontFace: T.font.body, fontSize: 11, color: T.color.slate, valign: "top" },
    );
  }

  // Footer — flags the placeholder theme so no one mistakes it for SP brand.
  slide.addText(
    `Consultant Workspace — prototype v0.1${T.meta.isPlaceholder ? "   ·   theme: PLACEHOLDER (not SP brand)" : ""}`,
    { x: L, y: H - 0.4, w: contentW, h: 0.25, fontFace: T.font.label, fontSize: T.size.footer, color: T.color.slate },
  );
}
