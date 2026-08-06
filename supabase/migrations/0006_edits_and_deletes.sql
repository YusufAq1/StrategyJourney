-- Step 10 (post-prototype) — edits & deletes, manual SWOT, and propose-only AI logging.
--
-- Three additions, all consistent with the existing boundaries:
--   1. A human DELETE path for signal/insight/capability nodes. `node` has RLS
--      but no DELETE policy, so anon deletes currently match zero rows silently.
--      This adds a scoped delete policy (never choice/option → Rule 3 intact).
--   2. create_swot — the human, manual "add a SWOT item" path (mirrors
--      create_capability). Evidence edges are optional for the human variant.
--   3. log_ai_run / set_ai_run_accepted — so the propose-only AI assist (signal
--      extraction, insight suggestion) can log each call to ai_run (CLAUDE.md §7)
--      even though it never runs an *_apply RPC. anon cannot write ai_run, so
--      these are SECURITY DEFINER owned by ai_service (which holds the grant).

-- ---------------------------------------------------------------------------
-- 1. Human DELETE path on node
-- ---------------------------------------------------------------------------
-- Scoped to the three types the consultant may remove. choice/option are
-- excluded so the AI/decision boundary (Rule 3) is untouched. Cascades handle
-- the child rows (signal_source, capability, capability_score, swot_item, edge).
create policy human_delete on node
  for delete to anon
  using (type in ('signal', 'insight', 'capability'));

grant delete on node to anon;

-- ---------------------------------------------------------------------------
-- 2. create_swot — manual, human-authored SWOT item
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (runs as anon) so the human_intake policy applies. A
-- swot_item node has type <> 'option', so it is permitted. No intake trigger
-- requires evidence for a swot_item, so a human item may carry zero evidence
-- edges — the UI flags those as unsupported. Optional evidence ids become
-- derives_from edges (same-engagement is enforced by the edge trigger).
create or replace function create_swot(
  p_engagement_id uuid,
  p_quadrant      swot_quadrant,
  p_statement     text,
  p_rationale     text,
  p_evidence_ids  uuid[]  default null,
  p_created_by    uuid    default null
) returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  insert into node (engagement_id, type, label, payload, status, origin, provenance_class, created_by)
  values (p_engagement_id, 'swot_item', p_statement,
          jsonb_build_object('rationale', coalesce(nullif(p_rationale, ''), null)),
          'active', 'human', 'client_content', p_created_by)
  returning id into v_id;

  insert into swot_item (node_id, quadrant, rank)
  values (v_id, p_quadrant, null);

  if p_evidence_ids is not null then
    insert into edge (engagement_id, from_node, to_node, type)
    select p_engagement_id, e, v_id, 'derives_from'
    from unnest(p_evidence_ids) as e
    where e is not null
    on conflict do nothing;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. AI-run logging for the propose-only assist
-- ---------------------------------------------------------------------------
grant update on ai_run to ai_service;

create or replace function log_ai_run(
  p_engagement_id      uuid,
  p_purpose            text,
  p_model              text,
  p_prompt_template_id text,
  p_prompt_version     text,
  p_tokens_in          int,
  p_tokens_out         int,
  p_output             jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into ai_run (engagement_id, purpose, model, prompt_template_id, prompt_version,
                      tokens_in, tokens_out, output, accepted)
  values (p_engagement_id, p_purpose, p_model, p_prompt_template_id, p_prompt_version,
          p_tokens_in, p_tokens_out, p_output, null)
  returning id into v_id;
  return v_id;
end $$;

-- Set once a strategist accepts ≥1 proposal from a run — the honest measure of
-- whether the AI layer earns its place (CLAUDE.md §7).
create or replace function set_ai_run_accepted(
  p_run_id   uuid,
  p_accepted boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_run set accepted = p_accepted where id = p_run_id;
end $$;

-- These run as ai_service (which holds insert/update on ai_run) so the anon
-- human path can log without being granted ai_run access directly.
alter function log_ai_run(uuid, text, text, text, text, int, int, jsonb) owner to ai_service;
alter function set_ai_run_accepted(uuid, boolean) owner to ai_service;

grant execute on function create_swot(uuid, swot_quadrant, text, text, uuid[], uuid) to anon, authenticated;
grant execute on function log_ai_run(uuid, text, text, text, text, int, int, jsonb) to anon, authenticated;
grant execute on function set_ai_run_accepted(uuid, boolean) to anon, authenticated;
