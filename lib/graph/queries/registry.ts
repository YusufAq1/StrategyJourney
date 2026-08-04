// The joint between the deck and the graph (docs/graph-queries.md).
//
// slide_spec.data_binding is a string like "capabilities.heatmap(level=2)".
// It is parsed with a STRICT regex (never a SQL string, never eval), looked up
// in a registry of named, read-only queries, and resolved to a ViewModel. Any
// parse/lookup/args failure throws loudly with context — a silently blank slide
// in a client deck is worse than a failed render.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export type QueryArgs = Record<string, string | number | boolean>;

export interface QueryContext {
  engagementId: string;
  db: SupabaseClient;
}

export interface GraphQuery<T> {
  /** e.g. "engagement.meta" */
  id: string;
  /** Zod schema for args; defaults live here, not in the caller. */
  args: z.ZodType<QueryArgs>;
  /** Read-only. Resolves to a ViewModel. */
  resolve: (ctx: QueryContext, args: QueryArgs) => Promise<T>;
  /** Node ids this ViewModel rests on — powers the provenance affordance. */
  evidenceNodeIds: (vm: T) => string[];
}

export class BindingParseError extends Error {}
export class UnknownBindingError extends Error {}
export class BindingArgsError extends Error {}

// namespace.function(arg=value, arg=value) — namespace/function [a-z_]+,
// values int | true | false | bare [a-z0-9_]+. No nesting, no expressions.
const BINDING_RE = /^([a-z_]+)\.([a-z_]+)\(([^()]*)\)$/;
const ARG_RE = /^([a-z_]+)=([a-z0-9_]+)$/;

export function parseBinding(binding: string): { id: string; rawArgs: QueryArgs } {
  const m = BINDING_RE.exec(binding.trim());
  if (!m) throw new BindingParseError(`unparseable binding: "${binding}"`);
  const [, ns, fn, argStr] = m;
  const rawArgs: QueryArgs = {};
  const inside = argStr.trim();
  if (inside.length > 0) {
    for (const part of inside.split(",")) {
      const am = ARG_RE.exec(part.trim());
      if (!am) throw new BindingParseError(`unparseable argument "${part.trim()}" in "${binding}"`);
      rawArgs[am[1]] = coerce(am[2]);
    }
  }
  return { id: `${ns}.${fn}`, rawArgs };
}

function coerce(v: string): string | number | boolean {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

const _registry: Record<string, GraphQuery<unknown>> = {};

export function register<T>(q: GraphQuery<T>): void {
  if (_registry[q.id]) throw new Error(`duplicate binding registration: ${q.id}`);
  _registry[q.id] = q as GraphQuery<unknown>;
}

export function getQuery(id: string): GraphQuery<unknown> {
  const q = _registry[id];
  if (!q) throw new UnknownBindingError(`no registered binding: "${id}"`);
  return q;
}

export interface ResolvedBinding {
  id: string;
  vm: unknown;
  evidenceNodeIds: string[];
}

export async function resolveBinding(binding: string, ctx: QueryContext): Promise<ResolvedBinding> {
  const { id, rawArgs } = parseBinding(binding);
  const q = getQuery(id);
  let args: QueryArgs;
  try {
    args = q.args.parse(rawArgs);
  } catch (e) {
    throw new BindingArgsError(`bad args for "${id}": ${(e as Error).message}`);
  }
  const vm = await q.resolve(ctx, args);
  return { id, vm, evidenceNodeIds: q.evidenceNodeIds(vm) };
}
