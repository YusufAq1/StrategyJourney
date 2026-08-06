import { readFile } from "node:fs/promises";
import type { ToolTool } from "./service";

// Shared loader for versioned prompt files (CLAUDE.md §13). A prompt .md holds
// the tool's input_schema in a ```json fence (matched by its "name") and the
// system prompt in an unlabelled fence (matched by a unique sentinel string).
// Mirrors the inline loaders in derivations/swot.ts and options.ts.
export function extractFences(md: string): { lang: string; body: string }[] {
  const out: { lang: string; body: string }[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push({ lang: m[1], body: m[2] });
  return out;
}

export async function loadPrompt(
  promptPath: string,
  toolName: string,
  systemSentinel: string,
): Promise<{ system: string; tool: ToolTool }> {
  const md = await readFile(promptPath, "utf8");
  const fences = extractFences(md);
  let tool: ToolTool | null = null;
  for (const f of fences) {
    if (f.lang === "json") {
      try {
        const o = JSON.parse(f.body) as { name?: string };
        if (o.name === toolName) tool = o as unknown as ToolTool;
      } catch {
        /* not the tool block */
      }
    }
  }
  const system = fences.find((f) => f.lang === "" && f.body.includes(systemSentinel))?.body.trim();
  if (!tool || !system) throw new Error(`could not load ${toolName} tool / system prompt from ${promptPath}`);
  return { system, tool };
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
