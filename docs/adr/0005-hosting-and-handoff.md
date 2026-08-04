# ADR 0005 — Hosted Supabase for build/demo; containerize to AWS me-central-1 for handoff

**Status:** Accepted (Step 1)

## Context
The prototype is built for a GCC client where in-region data residency is contractual, and Phase 1 needs an in-region AWS path (`me-central-1`). "Supabase vs Docker" is a false choice: Postgres is the engine (Rule 3 is an RLS role, intake is constraint triggers, provenance is a recursive SQL function — none of it ports off Postgres); Supabase is how we build fast; Docker/AWS is how we ship.

Managed **Supabase Cloud has no `me-central-1` region** (confirmed: the create-project region list runs us/eu/ap/ca/sa only; existing projects sit in `ap-south-1`). So managed Supabase Cloud cannot be the production dependency.

## Decision
- **Dev/demo:** Supabase — local CLI for dev, a hosted project (`strategy-journey`, ap-south-1) for the demo. Step 1 targets the hosted project via the Supabase MCP.
- **Handoff / Phase 1:** containerize and deploy to AWS `me-central-1` — Next.js on ECS/Fargate (or EKS), Postgres on RDS/Aurora, files on S3. The code is unchanged because we avoid all Vercel-only primitives (Edge Config / KV / Blob) and keep DB access behind supabase-js + `/lib/db` + `/lib/graph/queries`.
- The handoff artifact runs in three modes with only a connection-string change: local (`supabase start`), self-hosted Supabase (Docker Compose), and AWS RDS.

## Consequences
- No lock-in to a proprietary cloud primitive; managed → self-hosted → RDS is config, not a rewrite.
- Treat managed Supabase Cloud strictly as a dev/demo convenience, never the residency-bound production target.
- Storage uses Supabase Storage / S3-compatible APIs, never Vercel Blob.
