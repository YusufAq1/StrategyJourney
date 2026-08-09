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

  // /lib/ai/derivations/* load prompts/*.md via fs.readFile at runtime, which
  // Next's output file tracing can't see (it only follows static imports).
  // Without this, the prompts directory is dropped from the deployed
  // serverless function bundle and readFile 404s in production.
  outputFileTracingIncludes: {
    "/**": ["./prompts/**/*.md"],
  },

  // Signal-extraction file upload (PDF/.docx) needs more than the 1MB default
  // Server Action body limit. Parsing itself still caps at 10MB — see
  // lib/files/extract-text.ts.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
