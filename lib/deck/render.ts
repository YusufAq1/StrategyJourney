import pptxgen from "pptxgenjs";
import { SP_THEME } from "../../theme/sp-theme";
import { renderCover } from "./layouts/cover";
import { renderEvidenceSummary } from "./layouts/evidence-summary";
import { renderHeatmapFull } from "./layouts/heatmap-full";
import { renderRankedList } from "./layouts/ranked-list";
import { renderQuadGrid } from "./layouts/quad-grid";
import { renderOptionCards } from "./layouts/option-cards";
import { renderChoiceRationale } from "./layouts/choice-rationale";
import type { EngagementMeta, SignalSummary, CapabilityHeatmap, CapabilityGaps, SwotView, OptionsView, ChoiceView } from "../graph/queries/types";

// Deck composer skeleton (CLAUDE.md §9). A deck is a sequence of (layout, view
// model) pairs; each layout_id maps to one renderer in ./layouts. Slides 5-7
// add cases here as they are built.
export type SlideInput =
  | { layoutId: "cover"; title?: string; vm: EngagementMeta }
  | { layoutId: "evidence_summary"; title: string; vm: SignalSummary }
  | { layoutId: "heatmap_full"; title: string; vm: CapabilityHeatmap }
  | { layoutId: "ranked_list"; title: string; vm: CapabilityGaps }
  | { layoutId: "quad_grid"; title: string; vm: SwotView }
  | { layoutId: "option_cards"; title: string; vm: OptionsView }
  | { layoutId: "choice_rationale"; title: string; vm: ChoiceView | null };

export function newPresentation(): InstanceType<typeof pptxgen> {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "SP_16x9", width: SP_THEME.dimensions.widthIn, height: SP_THEME.dimensions.heightIn });
  pptx.layout = "SP_16x9";
  pptx.author = "Strategy Platforms";
  pptx.company = "Strategy Platforms";
  pptx.subject = "Strategy Journey — Consultant Workspace prototype";
  pptx.title = "Strategy Journey";
  return pptx;
}

export function renderDeck(slides: SlideInput[]): InstanceType<typeof pptxgen> {
  const pptx = newPresentation();
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    switch (s.layoutId) {
      case "cover":
        renderCover(pptx, s.vm);
        break;
      case "evidence_summary":
        renderEvidenceSummary(pptx, s.vm, s.title);
        break;
      case "heatmap_full":
        renderHeatmapFull(pptx, s.vm, s.title);
        break;
      case "ranked_list":
        renderRankedList(pptx, s.vm, s.title);
        break;
      case "quad_grid":
        renderQuadGrid(pptx, s.vm, s.title);
        break;
      case "option_cards":
        renderOptionCards(pptx, s.vm, s.title);
        break;
      case "choice_rationale":
        renderChoiceRationale(pptx, s.vm, s.title);
        break;
      default: {
        const _exhaustive: never = s;
        throw new Error(`no layout renderer for slide ${i + 1}: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  return pptx;
}
