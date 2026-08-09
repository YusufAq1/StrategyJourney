// THE ONLY place the Anthropic SDK is imported (CLAUDE.md §2 & §4).
// Everything that calls a model goes through here.
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — add it to .env.local to run AI derivations (Steps 5-6).",
    );
  }
  _client ??= new Anthropic();
  return _client;
}

export type ToolTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ToolCallResult<T> = {
  input: T;
  tokensIn: number;
  tokensOut: number;
  model: string;
};

// Occasionally a forced tool call comes back with a top-level property
// double-encoded as a JSON string — e.g. { options: '{"options":[...]}' }
// instead of { options: [...] } — rather than the array/object the schema
// declares. Iterating a string instead of an array silently yields
// character-by-character garbage downstream, so unwrap it here, once, for
// every derivation rather than defensively in each caller.
function coerceToolInput(raw: unknown, schema: Record<string, unknown>): unknown {
  const props = (schema as { properties?: Record<string, { type?: string }> }).properties;
  if (!props || typeof raw !== "object" || raw === null) return raw;
  let result: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const [key, propSchema] of Object.entries(props)) {
    const val = result[key];
    if (typeof val !== "string") continue;
    const expected = propSchema?.type;
    const mismatched =
      (expected === "array" && !Array.isArray(val)) || (expected === "object" && typeof val !== "object");
    if (!mismatched) continue;
    try {
      const parsed = JSON.parse(val) as unknown;
      if (parsed && typeof parsed === "object" && key in (parsed as Record<string, unknown>)) {
        result = { ...result, ...(parsed as Record<string, unknown>) };
      } else {
        result[key] = parsed;
      }
    } catch {
      // leave as-is — downstream validation will reject it with a clear error
    }
  }
  return result;
}

// Structured output via forced tool use. Thinking is disabled: forcing a
// specific tool is incompatible with extended thinking, and the schema is doing
// the structuring here. No sampling params (rejected on Sonnet 5 / Opus 5).
export async function callWithTool<T>(opts: {
  model: string;
  system: string;
  userInput: unknown;
  tool: ToolTool;
  maxTokens?: number;
}): Promise<ToolCallResult<T>> {
  const res = await client().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "disabled" },
    system: opts.system,
    tools: [opts.tool as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: JSON.stringify(opts.userInput) }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("model did not return the expected tool call");
  }
  return {
    input: coerceToolInput(block.input, opts.tool.input_schema) as T,
    tokensIn: res.usage.input_tokens,
    tokensOut: res.usage.output_tokens,
    model: res.model,
  };
}
