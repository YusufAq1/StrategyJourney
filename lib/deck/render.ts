import pptxgen from "pptxgenjs";
import { SP_THEME } from "../../theme/sp-theme";
import { renderCover } from "./layouts/cover";
import type { EngagementMeta } from "../graph/queries/types";

// Deck composer skeleton (CLAUDE.md §9). A deck is a sequence of (layout, view
// model) pairs; each layout_id maps to one renderer in ./layouts. Slides 2-7
// register their layouts here as they are built — the shape does not change.
export type SlideInput = { layoutId: "cover"; vm: EngagementMeta };

type LayoutFn = (pptx: InstanceType<typeof pptxgen>, vm: never) => void;

const LAYOUTS: Record<SlideInput["layoutId"], LayoutFn> = {
  cover: renderCover as LayoutFn,
};

export function newPresentation(): InstanceType<typeof pptxgen> {
  const pptx = new pptxgen();
  pptx.defineLayout({
    name: "SP_16x9",
    width: SP_THEME.dimensions.widthIn,
    height: SP_THEME.dimensions.heightIn,
  });
  pptx.layout = "SP_16x9";
  pptx.author = "Strategy Platforms";
  pptx.company = "Strategy Platforms";
  pptx.subject = "Strategy Journey — Consultant Workspace prototype";
  pptx.title = "Strategy Journey";
  return pptx;
}

export function renderDeck(slides: SlideInput[]): InstanceType<typeof pptxgen> {
  const pptx = newPresentation();
  slides.forEach((s, i) => {
    const fn = LAYOUTS[s.layoutId];
    if (!fn) throw new Error(`no layout renderer for "${s.layoutId}" (slide ${i + 1})`);
    fn(pptx, s.vm as never);
  });
  return pptx;
}
