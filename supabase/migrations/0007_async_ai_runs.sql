-- Step (post-prototype) — async AI derivation runs.
--
-- SWOT derivation and option generation call Sonnet 5 / Opus 5 in one shot and
-- can take well past Netlify's synchronous function limit (10s free / 26s
-- paid). Left as a single request/response, the function is killed mid-call
-- and Netlify returns a bare 502, which breaks the Next.js Server Action
-- response contract and crashes the client. This moves the actual model call
-- into a Netlify Background Function (up to 15 min) and has the app poll
-- ai_run for completion — the same "move to a job runner rather than raising
-- the timeout" call CLAUDE.md already makes for deck rendering.
--
-- Three additions:
--   1. ai_run gets a status column so a run can be polled while in flight.
--   2. start_ai_run / fail_ai_run / get_ai_run_status — anon has no direct
--      ai_run access, so these are SECURITY DEFINER owned by ai_service,
--      mirroring log_ai_run / set_ai_run_accepted (0006).
--   3. derive_swot_apply / generate_options_apply gain an optional p_run_id:
--      when given, they UPDATE the placeholder 'running' row from
--      start_ai_run instead of inserting a new one. p_run_id is optional so
--      the local scripts (scripts/derive-swot.ts etc.), which still call
--      these synchronously with no run to update, are unaffected.

alter table ai_run
  add column status text not null default 'succeeded'
    check (status in ('running', 'succeeded', 'failed')),
  add column error_message text;

-- ---------------------------------------------------------------------------
-- start_ai_run — the placeholder 'running' row the UI polls, created before
-- the background function is even invoked.
-- ---------------------------------------------------------------------------
create or replace function start_ai_run(
  p_engagement_id      uuid,
  p_purpose            text,
  p_model              text,
  p_prompt_template_id text,
  p_prompt_version     text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into ai_run (engagement_id, purpose, model, prompt_template_id, prompt_version, status)
  values (p_engagement_id, p_purpose, p_model, p_prompt_template_id, p_prompt_version, 'running')
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- fail_ai_run — flips a running row to failed so the poller doesn't spin
-- forever if the background function throws (bad model output, Anthropic
-- error, validation failure).
-- ---------------------------------------------------------------------------
create or replace function fail_ai_run(
  p_run_id uuid,
  p_error  text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_run
  set status = 'failed', error_message = left(coalesce(p_error, 'unknown error'), 2000)
  where id = p_run_id;
end $$;

-- ---------------------------------------------------------------------------
-- get_ai_run_status — the only read path onto ai_run for anon, scoped to a
-- single run by its (unguessable) id rather than a general SELECT grant.
-- ---------------------------------------------------------------------------
create or replace function get_ai_run_status(
  p_run_id uuid
) returns table (status text, error_message text, purpose text, engagement_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select status, error_message, purpose, engagement_id from ai_run where id = p_run_id;
$$;

alter function start_ai_run(uuid, text, text, text, text) owner to ai_service;
alter function fail_ai_run(uuid, text) owner to ai_service;
alter function get_ai_run_status(uuid) owner to ai_service;

revoke all on function start_ai_run(uuid, text, text, text, text) from public;
revoke all on function fail_ai_run(uuid, text) from public;
revoke all on function get_ai_run_status(uuid) from public;

grant execute on function start_ai_run(uuid, text, text, text, text) to anon, authenticated;
grant execute on function fail_ai_run(uuid, text) to anon, authenticated;
grant execute on function get_ai_run_status(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- derive_swot_apply — add optional p_run_id. Old 9-arg signature is dropped
-- and replaced (Postgres treats a changed parameter list as a new function
-- identity, so a plain create-or-replace would leave both around).
-- ---------------------------------------------------------------------------
drop function if exists derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb);

create or replace function derive_swot_apply(
  p_engagement_id      uuid,
  p_items              jsonb,
  p_model              text,
  p_prompt_template_id text,
  p_prompt_version     text,
  p_tokens_in          int,
  p_tokens_out         int,
  p_created_by         uuid,
  p_output             jsonb,
  p_run_id             uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it       jsonb;
  ev       text;
  v_node   uuid;
  created  uuid[] := '{}';
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a json array';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into node (engagement_id, type, label, status, origin, provenance_class, payload, created_by)
    values (p_engagement_id, 'swot_item', it->>'statement', 'active', 'ai', 'derived',
            jsonb_build_object('rationale', it->>'rationale'), p_created_by)
    returning id into v_node;

    insert into swot_item (node_id, quadrant, rank)
    values (v_node, (it->>'quadrant')::swot_quadrant, nullif(it->>'rank','')::int);

    for ev in select jsonb_array_elements_text(it->'evidence_node_ids') loop
      if exists (select 1 from node n where n.id = ev::uuid and n.engagement_id = p_engagement_id) then
        insert into edge (engagement_id, from_node, to_node, type)
        values (p_engagement_id, ev::uuid, v_node, 'derives_from')
        on conflict (from_node, to_node, type) do nothing;
      end if;
    end loop;

    created := created || v_node;
  end loop;

  if p_run_id is not null then
    update ai_run
    set status = 'succeeded', model = p_model, prompt_template_id = p_prompt_template_id,
        prompt_version = p_prompt_version, tokens_in = p_tokens_in, tokens_out = p_tokens_out,
        output = p_output
    where id = p_run_id;
  else
    insert into ai_run (engagement_id, purpose, model, prompt_template_id, prompt_version,
                        tokens_in, tokens_out, output, accepted)
    values (p_engagement_id, 'swot_derivation', p_model, p_prompt_template_id, p_prompt_version,
            p_tokens_in, p_tokens_out, p_output, null);
  end if;

  return jsonb_build_object('created', to_jsonb(created));
end $$;

grant create on schema public to ai_service;
alter function derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb, uuid) owner to ai_service;
revoke all on function derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb, uuid) from public;
grant execute on function derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- generate_options_apply — same p_run_id addition.
-- ---------------------------------------------------------------------------
drop function if exists generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb);

create or replace function generate_options_apply(
  p_engagement_id      uuid,
  p_options            jsonb,
  p_model              text,
  p_prompt_template_id text,
  p_prompt_version     text,
  p_tokens_in          int,
  p_tokens_out         int,
  p_created_by         uuid,
  p_output             jsonb,
  p_run_id             uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  op      jsonb;
  ev      text;
  v_node  uuid;
  created uuid[] := '{}';
begin
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'p_options must be a json array';
  end if;

  for op in select * from jsonb_array_elements(p_options) loop
    insert into node (engagement_id, type, label, status, origin, provenance_class, payload, created_by)
    values (p_engagement_id, 'option', op->>'label', 'active', 'ai', 'derived',
            jsonb_build_object('vector', op->>'vector'), p_created_by)
    returning id into v_node;

    insert into option_detail (node_id, the_bet, prerequisite_capabilities, what_must_be_true,
                               strongest_argument_against, open_questions, requires_new_capability)
    values (v_node, op->>'the_bet', coalesce(op->'prerequisite_capabilities', '[]'::jsonb),
            op->>'what_must_be_true', op->>'strongest_argument_against',
            nullif(op->>'open_questions',''), coalesce((op->>'requires_new_capability')::boolean, false));

    for ev in select jsonb_array_elements_text(op->'evidence_node_ids') loop
      if exists (select 1 from node n where n.id = ev::uuid and n.engagement_id = p_engagement_id) then
        insert into edge (engagement_id, from_node, to_node, type)
        values (p_engagement_id, ev::uuid, v_node, 'derives_from')
        on conflict (from_node, to_node, type) do nothing;
      end if;
    end loop;

    created := created || v_node;
  end loop;

  if p_run_id is not null then
    update ai_run
    set status = 'succeeded', model = p_model, prompt_template_id = p_prompt_template_id,
        prompt_version = p_prompt_version, tokens_in = p_tokens_in, tokens_out = p_tokens_out,
        output = p_output
    where id = p_run_id;
  else
    insert into ai_run (engagement_id, purpose, model, prompt_template_id, prompt_version,
                        tokens_in, tokens_out, output, accepted)
    values (p_engagement_id, 'option_generation', p_model, p_prompt_template_id, p_prompt_version,
            p_tokens_in, p_tokens_out, p_output, null);
  end if;

  return jsonb_build_object('created', to_jsonb(created));
end $$;

alter function generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb, uuid) owner to ai_service;
revoke all on function generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb, uuid) from public;
grant execute on function generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb, uuid) to anon, authenticated;
