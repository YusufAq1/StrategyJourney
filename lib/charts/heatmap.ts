// The capability heatmap — the ONE chart pipeline (CLAUDE.md §9, §13).
//
// A heatmap must not look different in two places. The single source of truth is
// the LAYOUT + COLOUR model computed here (layoutHeatmap); the portal renders it
// as SVG (heatmapSvg) and the deck renders the SAME model as native, editable
// PPTX shapes (lib/deck/layouts/heatmap-full.ts). Native shapes, not an embedded
// SVG image, so the chart is editable and renders correctly in BOTH PowerPoint
// and Google Slides — see docs/adr/0007. Colours and geometry come from here and
// nowhere else, which is what "identical" actually requires.

import type { CapabilityHeatmap } from "../graph/queries/types";

export type Scale = { min: number; max: number; midpoint: number };

export type HmCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  textColor: string;
  label: string;
  sub: string;
  badge: string;
};
export type HmGroup = { x: number; y: number; w: number; h: number; label: string };
export type HeatmapLayout = {
  width: number;
  height: number;
  groups: HmGroup[];
  cells: HmCell[];
  legend: { x: number; y: number; w: number; h: number; minLabel: string; maxLabel: string };
};

const PAD = 18;
const LABELW = 128;
const CELLW = 150;
const CELLH = 64;
const GAPX = 12;
const GAPY = 14;
const LEGENDH = 26;

// ---- colour -----------------------------------------------------------------

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

const GREEN = "2E7D32";
const AMBER = "E1A100";
const RED = "C0392B";

// value → colour (higher = worse = red). Returns 6-hex, no '#'.
export function colorFor(value: number, scale: Scale): string {
  const span = scale.max - scale.min || 1;
  const t = Math.min(Math.max((value - scale.min) / span, 0), 1);
  return t <= 0.5 ? mix(GREEN, AMBER, t / 0.5) : mix(AMBER, RED, (t - 0.5) / 0.5);
}

export function textOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.5722 * b; // approx relative luminance
  return lum > 0.6 ? "1A2230" : "FFFFFF";
}

// ---- layout -----------------------------------------------------------------

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

  const maxCols = Math.max(1, ...groupsSorted.map((g) => g.cells.length));
  const width = PAD + LABELW + 8 + maxCols * (CELLW + GAPX) - GAPX + PAD;
  const gridH = groupsSorted.length * (CELLH + GAPY) - GAPY;
  const height = PAD + gridH + 18 + LEGENDH + PAD;

  const groups: HmGroup[] = [];
  const cells: HmCell[] = [];

  groupsSorted.forEach((g, gi) => {
    const y = PAD + gi * (CELLH + GAPY);
    groups.push({ x: PAD, y, w: LABELW, h: CELLH, label: g.label });
    g.cells.forEach((c, ci) => {
      const x = PAD + LABELW + 8 + ci * (CELLW + GAPX);
      const fill = colorFor(c.colourValue, vm.scale);
      const curStr = Number.isInteger(c.maturityCurrent) ? String(c.maturityCurrent) : c.maturityCurrent.toFixed(1);
      cells.push({
        x,
        y,
        w: CELLW,
        h: CELLH,
        fill,
        textColor: textOn(fill),
        label: c.label,
        sub: `${curStr} → ${c.maturityRequired}  ·  crit ${c.criticality}`,
        badge: c.gap === 0 ? "met" : `gap ${Number.isInteger(c.gap) ? c.gap : c.gap.toFixed(1)}`,
      });
    });
  });

  const legend = {
    x: PAD + LABELW + 8,
    y: height - PAD - LEGENDH + 6,
    w: 180,
    h: 10,
    minLabel: "met",
    maxLabel: "large gap",
  };

  return { width, height, groups, cells, legend };
}

// ---- SVG renderer (portal) --------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(label: string, max = 18): string[] {
  if (label.length <= max) return [label];
  const words = label.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length === 1 && cur.length > max) break;
  }
  if (cur) lines.push(cur.trim());
  return lines.slice(0, 2);
}

export function heatmapSvg(vm: CapabilityHeatmap): string {
  const L = layoutHeatmap(vm);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.width} ${L.height}" font-family="Arial, Helvetica, sans-serif" width="100%">`,
  );
  parts.push(`<rect x="0" y="0" width="${L.width}" height="${L.height}" fill="#FFFFFF"/>`);

  for (const g of L.groups) {
    parts.push(
      `<text x="${g.x}" y="${g.y + g.h / 2}" dominant-baseline="middle" font-size="12" font-weight="bold" fill="#13294B">${esc(g.label)}</text>`,
    );
  }

  for (const c of L.cells) {
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="4" fill="#${c.fill}"/>`);
    const lines = wrap(c.label);
    lines.forEach((ln, i) => {
      parts.push(
        `<text x="${c.x + 10}" y="${c.y + 18 + i * 14}" font-size="12" font-weight="bold" fill="#${c.textColor}">${esc(ln)}</text>`,
      );
    });
    parts.push(
      `<text x="${c.x + 10}" y="${c.y + c.h - 10}" font-size="10" fill="#${c.textColor}">${esc(c.sub)}</text>`,
    );
    parts.push(
      `<text x="${c.x + c.w - 10}" y="${c.y + 18}" text-anchor="end" font-size="10" font-weight="bold" fill="#${c.textColor}">${esc(c.badge)}</text>`,
    );
  }

  // legend gradient
  const stops = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => `<stop offset="${t * 100}%" stop-color="#${colorFor(vm.scale.min + t * (vm.scale.max - vm.scale.min), vm.scale)}"/>`)
    .join("");
  parts.push(`<defs><linearGradient id="hmleg">${stops}</linearGradient></defs>`);
  parts.push(`<rect x="${L.legend.x}" y="${L.legend.y}" width="${L.legend.w}" height="${L.legend.h}" rx="2" fill="url(#hmleg)"/>`);
  parts.push(
    `<text x="${L.legend.x}" y="${L.legend.y + L.legend.h + 12}" font-size="10" fill="#5B6472">${esc(L.legend.minLabel)}</text>`,
  );
  parts.push(
    `<text x="${L.legend.x + L.legend.w}" y="${L.legend.y + L.legend.h + 12}" text-anchor="end" font-size="10" fill="#5B6472">${esc(L.legend.maxLabel)}</text>`,
  );

  parts.push(`</svg>`);
  return parts.join("");
}
