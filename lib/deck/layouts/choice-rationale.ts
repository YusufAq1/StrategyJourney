import type pptxgen from "pptxgenjs";
import { SP_THEME as T } from "../../../theme/sp-theme";
import type { ChoiceView } from "../../graph/queries/types";
import { contentSlide } from "./shared";

// Slide 7 — the choice and its rationale. The human decision beside the machine
// options. vm may be null (no choice yet) — render a placeholder rather than fail.
export function renderChoiceRationale(pptx: InstanceType<typeof pptxgen>, vm: ChoiceView | null, title: string): void {
  const slide = contentSlide(pptx, title);
  const L = T.margin.left;
  const W = T.dimensions.widthIn - L - T.margin.right;

  if (!vm) {
    slide.addText("No choice recorded yet.", { x: L, y: 1.6, w: W, h: 0.4, fontFace: T.font.body, fontSize: 14, color: T.color.slate });
    return;
  }

  slide.addText(vm.statement, { x: L, y: 1.35, w: W, h: 0.9, fontFace: T.font.display, fontSize: 22, bold: true, color: T.color.navy, valign: "top" });
  slide.addText(`Decided by ${vm.decidedBy}   ·   human-made`, { x: L, y: 2.28, w: W, h: 0.25, fontFace: T.font.label, fontSize: 10, color: T.color.slate });
  slide.addText([{ text: "Rationale   ", options: { bold: true } }, { text: vm.rationale }], {
    x: L, y: 2.66, w: W, h: 0.7, fontFace: T.font.body, fontSize: 12, color: T.color.ink, valign: "top",
  });

  let y = 3.5;
  if (vm.alternativesConsidered.length > 0) {
    slide.addText("Alternatives considered", { x: L, y, w: W, h: 0.24, fontFace: T.font.label, fontSize: 10, bold: true, color: T.color.blue });
    y += 0.3;
    slide.addText(
      vm.alternativesConsidered.map((a) => ({
        text: `${a.label} — ${a.whyNot}`,
        options: { bullet: { code: "2022" }, breakLine: true, fontSize: 10, paraSpaceAfter: 2 },
      })),
      { x: L, y, w: W, h: 1.6, fontFace: T.font.body, color: T.color.slate, valign: "top" },
    );
    y += Math.min(1.7, 0.28 * vm.alternativesConsidered.length + 0.3);
  }

  if (vm.revisitTrigger) {
    slide.addText([{ text: "Revisit when   ", options: { bold: true } }, { text: vm.revisitTrigger }], {
      x: L, y: Math.min(y, 6.6), w: W, h: 0.4, fontFace: T.font.body, fontSize: 11, color: T.color.slate, valign: "top",
    });
  }
}
