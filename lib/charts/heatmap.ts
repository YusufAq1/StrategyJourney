// The capability heatmap — the ONE chart pipeline (CLAUDE.md §9, §13).
//
// A heatmap must not look different in two places. The single source of truth is
// the LAYOUT + COLOUR model computed here (layoutHeatmap); the portal renders it
// as SVG (heatmapSvg) and the deck renders the SAME model as native, editable
// PPTX shapes (lib/deck/layouts/heatmap-full.ts). Native shapes, not an embedded
// SVG image, so the chart is editable and renders correctly in BOTH PowerPoint
// and Google Slides — see docs/adr/0007. Colours and geometry come from here and
// nowhere else, which is what "identical" actually requires.
//
// Visual design: grouped capability cards (not a strict grid) — each card
// carries a current→target maturity bar and a criticality note, coloured by a
// five-stop green→amber→red ramp. Ported from the "Business capability
// heatmap" Claude Design mock. Every sub-element rect is computed once, here,
// so the two renderers never have to agree on an offset independently.

import type { CapabilityHeatmap } from "../graph/queries/types";

export type Scale = { min: number; max: number; midpoint: number };

export type HmBadge = { x: number; y: number; w: number; h: number; text: string };
export type HmBar = {
  trackX: number;
  trackY: number;
  trackW: number;
  trackH: number;
  fillW: number;
  tickX: number;
  tickY: number;
  tickW: number;
  tickH: number;
  labelY: number;
  label: string;
};
export type HmCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  textColor: string;
  mutedColor: string;
  badgeBg: string;
  trackBg: string;
  fillBg: string;
  label: string;
  nameBoxW: number;
  badge: HmBadge;
  bar: HmBar;
  critLabel: { y: number; text: string };
};
export type HmGroup = { x: number; y: number; w: number; label: string; underlineY: number };
export type HeatmapLayout = {
  width: number;
  height: number;
  groups: HmGroup[];
  cells: HmCell[];
  legend: { x: number; y: number; w: number; h: number; dividerY: number; minLabel: string; maxLabel: string };
};

// ---- card geometry ------------------------------------------------------

const OUTER_PAD = 24;
const COLS = 3;
const CARD_W = 260;
const CARD_H = 118;
const GAPX = 16;
const GAPY = 16;
const GROUP_HEADER_H = 30;
const GROUP_GAP = 18;
const LEGEND_AREA_H = 54;

const PADX = 18;
const PADY = 16;
const BADGE_W = 60;
const BADGE_H = 18;
const TRACK_Y = 50; // relative to card top
const TRACK_H = 6;
const TICK_H = 12;
const BAR_LABEL_Y = 76; // baseline, relative to card top
const CRIT_Y = 100; // baseline, relative to card top

// current/required maturity is scored on a 1-5 scale throughout the prototype.
const MAT_MIN = 1;
const MAT_MAX = 5;
function pct(v: number): number {
  return Math.min(Math.max((v - MAT_MIN) / (MAT_MAX - MAT_MIN), 0), 1);
}

// ---- colour ---------------------------------------------------------------

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, "0");
  return c(r) + c(g) + c(b);
}
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// OKLCH -> sRGB hex (Björn Ottosson's reference matrices). L in 0-100, C the
// OKLCh chroma, H in degrees. Used so the ramp matches the design mock, which
// specifies its stops in OKLCH rather than RGB.
function oklchToHex(lPct: number, c: number, hDeg: number): string {
  const l = lPct / 100;
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const rl = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gl = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const gam = (v: number) => {
    const cv = Math.min(Math.max(v, 0), 1);
    return cv <= 0.0031308 ? 12.92 * cv : 1.055 * Math.pow(cv, 1 / 2.4) - 0.055;
  };
  return rgbToHex(gam(rl) * 255, gam(gl) * 255, gam(bl) * 255);
}

// Five-stop green -> amber -> red ramp, interpolated in OKLCH. t is 0..1
// (worst-to-best already normalised against the caller's scale).
const RAMP = [
  { l: 68, c: 0.15, h: 145 },
  { l: 74, c: 0.15, h: 108 },
  { l: 78, c: 0.15, h: 85 },
  { l: 70, c: 0.18, h: 50 },
  // Severe (gap >= 4, the worst attainable on the 1-5 maturity scale): a
  // clearly red stop, not a continuation of the amber/orange run above it.
  { l: 50, c: 0.24, h: 20 },
];

function rampAt(t: number): { hex: string; l: number } {
  const scaled = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  const l = a.l + (b.l - a.l) * f;
  const c = a.c + (b.c - a.c) * f;
  const h = a.h + (b.h - a.h) * f;
  return { hex: oklchToHex(l, c, h), l };
}

// value → colour (higher = worse = red). Returns 6-hex, no '#'.
export function colorFor(value: number, scale: Scale): string {
  const span = scale.max - scale.min || 1;
  const t = (value - scale.min) / span;
  return rampAt(t).hex;
}

const DARK_TEXT = oklchToHex(24, 0.02, 60);
const LIGHT_TEXT = oklchToHex(98, 0, 0);
const BLACK = "000000";
const WHITE = "ffffff";

function textOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.5722 * b;
  return lum > 0.6 ? DARK_TEXT : LIGHT_TEXT;
}

// ---- layout -----------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Rough per-character advance widths (em multiples of font size) for bold
// Arial/Helvetica — good enough to decide wrap points without a canvas. A
// flat character-count threshold isn't: "Leadership & Governance" (23 chars)
// and "Financial Management" (21 chars) render at very different pixel
// widths because of how wide '&', 'M' and capitals run versus 'i', 'l', 't'.
const NARROW_CHARS = new Set("iIljtf.,'".split(""));
const WIDE_CHARS = new Set("WMmw&@%GOQ".split(""));

function charWidthEm(ch: string): number {
  if (ch === " ") return 0.28;
  if (NARROW_CHARS.has(ch)) return 0.32;
  if (WIDE_CHARS.has(ch)) return 0.88;
  return 0.58;
}

function textWidthPx(s: string, fontSizePx: number): number {
  let w = 0;
  for (const ch of s) w += charWidthEm(ch);
  return w * fontSizePx;
}

// Wraps to at most 2 lines that fit within maxWidthPx, so the name never
// runs under the gap badge in the card's top-right corner.
function wrap(label: string, maxWidthPx: number, fontSizePx = 13.5): string[] {
  if (textWidthPx(label, fontSizePx) <= maxWidthPx) return [label];
  const words = label.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (cur && textWidthPx(candidate, fontSizePx) > maxWidthPx) {
      lines.push(cur);
      cur = w;
      if (lines.length === 2) break;
    } else {
      cur = candidate;
    }
  }
  if (lines.length < 2 && cur) lines.push(cur);
  return lines.slice(0, 2);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function layoutHeatmap(vm: CapabilityHeatmap): HeatmapLayout {
  // group by parent, worst group first, worst cell first within a group
  const byGroup = new Map<string, CapabilityHeatmap["cells"]>();
  for (const c of vm.cells) {
    const key = c.parentLabel ?? "General";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(c);
  }
  const groupsSorted = [...byGroup.entries()]
    .map(([label, cells]) => ({ label, cells: [...cells].sort((a, b) => b.gapWeighted - a.gapWeighted) }))
    .sort((a, b) => Math.max(...b.cells.map((c) => c.gapWeighted)) - Math.max(...a.cells.map((c) => c.gapWeighted)));

  const contentW = COLS * CARD_W + (COLS - 1) * GAPX;
  const width = OUTER_PAD * 2 + contentW;

  const groups: HmGroup[] = [];
  const cells: HmCell[] = [];
  let cursorY = OUTER_PAD;

  for (const g of groupsSorted) {
    const rows = Math.ceil(g.cells.length / COLS);
    const headerY = cursorY;
    groups.push({
      x: OUTER_PAD,
      y: headerY,
      w: contentW,
      label: g.label,
      underlineY: headerY + GROUP_HEADER_H - 12,
    });

    const gridTop = headerY + GROUP_HEADER_H;
    g.cells.forEach((c, ci) => {
      const col = ci % COLS;
      const row = Math.floor(ci / COLS);
      const x = OUTER_PAD + col * (CARD_W + GAPX);
      const y = gridTop + row * (CARD_H + GAPY);
      const { hex: fill } = rampAt((c.colourValue - vm.scale.min) / (vm.scale.max - vm.scale.min || 1));
      const textColor = textOn(fill);
      const dark = textColor === DARK_TEXT;

      const mutedColor = dark ? mix(fill, DARK_TEXT, 0.68) : mix(fill, LIGHT_TEXT, 0.78);
      const badgeBg = dark ? mix(fill, BLACK, 0.1) : mix(fill, WHITE, 0.22);
      const trackBg = dark ? mix(fill, BLACK, 0.12) : mix(fill, WHITE, 0.28);
      const fillBg = dark ? mix(trackBg, DARK_TEXT, 0.55) : mix(trackBg, WHITE, 0.85);

      const trackX = x + PADX;
      const trackW = CARD_W - PADX * 2;
      const curPct = pct(c.maturityCurrent);
      const tgtPct = pct(c.maturityRequired);
      const curStr = fmt(c.maturityCurrent);

      cells.push({
        x,
        y,
        w: CARD_W,
        h: CARD_H,
        fill,
        textColor,
        mutedColor,
        badgeBg,
        trackBg,
        fillBg,
        label: c.label,
        nameBoxW: CARD_W - PADX * 2 - BADGE_W - 8,
        badge: {
          x: x + CARD_W - PADX - BADGE_W,
          y: y + PADY - 2,
          w: BADGE_W,
          h: BADGE_H,
          text: c.gap === 0 ? "met" : `gap ${fmt(c.gap)}`,
        },
        bar: {
          trackX,
          trackY: y + TRACK_Y,
          trackW,
          trackH: TRACK_H,
          fillW: Math.max(0, trackW * curPct),
          tickX: trackX + trackW * tgtPct - 1,
          tickY: y + TRACK_Y - 3,
          tickW: 2,
          tickH: TICK_H,
          labelY: y + BAR_LABEL_Y,
          label: `now ${curStr} · target ${c.maturityRequired}`,
        },
        critLabel: { y: y + CRIT_Y, text: `priority · crit ${c.criticality}` },
      });
    });

    cursorY = gridTop + rows * (CARD_H + GAPY) - GAPY + GROUP_GAP;
  }

  const height = cursorY - GROUP_GAP + LEGEND_AREA_H + OUTER_PAD;
  const dividerY = cursorY - GROUP_GAP + 20;
  const legend = {
    x: OUTER_PAD,
    y: dividerY + 14,
    w: contentW,
    h: 10,
    dividerY,
    minLabel: "met",
    maxLabel: "large gap",
  };

  return { width, height, groups, cells, legend };
}

// ---- SVG renderer (portal) --------------------------------------------------

export function heatmapSvg(vm: CapabilityHeatmap): string {
  const L = layoutHeatmap(vm);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.width} ${L.height}" font-family="Arial, Helvetica, sans-serif" width="100%">`,
  );
  parts.push(`<rect x="0" y="0" width="${L.width}" height="${L.height}" fill="#FFFFFF"/>`);

  for (const g of L.groups) {
    parts.push(
      `<text x="${g.x}" y="${g.y + 12}" font-size="12" font-weight="bold" letter-spacing="0.5" fill="#3A4A6B">${esc(g.label.toUpperCase())}</text>`,
    );
    parts.push(`<line x1="${g.x}" y1="${g.underlineY}" x2="${g.x + g.w}" y2="${g.underlineY}" stroke="#E1E4E9" stroke-width="1"/>`);
  }

  for (const c of L.cells) {
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="10" fill="#${c.fill}"/>`);

    const lines = wrap(c.label, c.nameBoxW);
    lines.forEach((ln, i) => {
      parts.push(
        `<text x="${c.x + PADX}" y="${c.y + PADY + 6 + i * 15}" width="${c.nameBoxW}" font-size="13.5" font-weight="bold" fill="#${c.textColor}">${esc(ln)}</text>`,
      );
    });

    const b = c.badge;
    parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9" fill="#${c.badgeBg}"/>`);
    parts.push(
      `<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 4}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#${c.textColor}">${esc(b.text)}</text>`,
    );

    const bar = c.bar;
    parts.push(`<rect x="${bar.trackX}" y="${bar.trackY}" width="${bar.trackW}" height="${bar.trackH}" rx="3" fill="#${c.trackBg}"/>`);
    parts.push(`<rect x="${bar.trackX}" y="${bar.trackY}" width="${bar.fillW}" height="${bar.trackH}" rx="3" fill="#${c.fillBg}"/>`);
    parts.push(`<rect x="${bar.tickX}" y="${bar.tickY}" width="${bar.tickW}" height="${bar.tickH}" rx="1" fill="#${c.textColor}"/>`);
    parts.push(
      `<text x="${bar.trackX}" y="${bar.labelY}" font-size="11" fill="#${c.mutedColor}">${esc(bar.label)}</text>`,
    );

    parts.push(
      `<text x="${c.x + PADX}" y="${c.critLabel.y}" font-size="11" fill="#${c.mutedColor}">${esc(c.critLabel.text)}</text>`,
    );
  }

  parts.push(`<line x1="${L.legend.x}" y1="${L.legend.dividerY}" x2="${L.legend.x + L.legend.w}" y2="${L.legend.dividerY}" stroke="#E1E4E9" stroke-width="1"/>`);

  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => `<stop offset="${t * 100}%" stop-color="#${rampAt(t).hex}"/>`).join("");
  parts.push(`<defs><linearGradient id="hmleg">${stops}</linearGradient></defs>`);
  parts.push(`<rect x="${L.legend.x}" y="${L.legend.y}" width="${L.legend.w}" height="${L.legend.h}" rx="5" fill="url(#hmleg)"/>`);
  parts.push(
    `<text x="${L.legend.x}" y="${L.legend.y + L.legend.h + 16}" font-size="11" fill="#5B6472">${esc(L.legend.minLabel)}</text>`,
  );
  parts.push(
    `<text x="${L.legend.x + L.legend.w}" y="${L.legend.y + L.legend.h + 16}" text-anchor="end" font-size="11" fill="#5B6472">${esc(L.legend.maxLabel)}</text>`,
  );

  parts.push(`</svg>`);
  return parts.join("");
}
