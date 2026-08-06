import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Prototype v0.1. Kept intentionally minimal — no Vercel-only primitives
  // (Edge Config / KV / Blob) so the app stays portable to AWS me-central-1.

  // Pin the workspace root to this project. A stray package-lock.json in the
  // home directory otherwise makes Next infer the wrong root (and warn about
  // "multiple lockfiles") and trace files from there.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
