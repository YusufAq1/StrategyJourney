-- Step 6 — option generation (AI) and the choice (human). This is where Rule 3
-- is demonstrated live: options are written by ai_service, the choice is not.

-- The human path may now create a `choice` node (it couldn't before Step 6).
-- Options remain AI-only (excluded here); they are created by ai_service.
drop policy if exists human_intake on node;
create policy human_intake on node
  for insert to anon
  with check (origin = 'human' and type <> 'option');

-- ---------------------------------------------------------------------------
-- AI write path: options via ai_service (SECURITY DEFINER owned by ai_service,
-- so it cannot create a choice — same boundary as derive_swot_apply, ADR 0008).
-- ---------------------------------------------------------------------------
create or replace function generate_options_apply(
  p_engagement_id      uuid,
  p_options            jsonb,
  p_model              text,
  p_prompt_template_id text,
  p_prompt_version     text,
  p_tokens_in          int,
  p_tokens_out         int,
  p_created_by         uuid,
  p_output             jsonb
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

  insert into ai_run (engagement_id, purpose, model, prompt_template_id, prompt_version,
                      tokens_in, tokens_out, output, accepted)
  values (p_engagement_id, 'option_generation', p_model, p_prompt_template_id, p_prompt_version,
          p_tokens_in, p_tokens_out, p_output, null);

  return jsonb_build_object('created', to_jsonb(created));
end $$;

alter function generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb) owner to ai_service;
revoke all on function generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb) from public;
grant execute on function generate_options_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Human path: the choice. SECURITY INVOKER — it runs as the caller (the human),
-- NOT ai_service. anon may write choice + decision_log; ai_service may not. The
-- whole grounded choice commits in one transaction so choice_needs_grounding
-- (needs a linked insight/swot AND a decision_log) is satisfied at commit.
-- ---------------------------------------------------------------------------
create or replace function make_choice(
  p_engagement_id   uuid,
  p_statement       text,
  p_rationale       text,
  p_decided_by      uuid,
  p_revisit_trigger text,
  p_traces_to       uuid[],   -- insight/swot_item ids this choice rests on
  p_selected_option uuid,     -- the option chosen (marked via considered_for)
  p_alternatives    jsonb     -- [{label, whyNot}] of options NOT chosen
) returns uuid
language plpgsql
security invoker
as $$
declare v_choice uuid; t uuid;
begin
  if p_traces_to is null or array_length(p_traces_to, 1) is null then
    raise exception 'a choice must trace to at least one insight or swot item';
  end if;

  insert into node (engagement_id, type, label, status, origin, provenance_class, created_by)
  values (p_engagement_id, 'choice', p_statement, 'active', 'human', 'client_content', p_decided_by)
  returning id into v_choice;

  insert into decision_log (engagement_id, choice_node_id, title, decision,
                            alternatives_considered, rationale, decided_by, revisit_trigger)
  values (p_engagement_id, v_choice, left(p_statement, 80), p_statement,
          coalesce(p_alternatives, '[]'::jsonb), p_rationale, p_decided_by, nullif(p_revisit_trigger, ''));

  foreach t in array p_traces_to loop
    if exists (select 1 from node n where n.id = t and n.engagement_id = p_engagement_id and n.type in ('insight','swot_item')) then
      insert into edge (engagement_id, from_node, to_node, type)
      values (p_engagement_id, t, v_choice, 'derives_from')
      on conflict (from_node, to_node, type) do nothing;
    end if;
  end loop;

  if p_selected_option is not null then
    insert into edge (engagement_id, from_node, to_node, type)
    values (p_engagement_id, p_selected_option, v_choice, 'considered_for')
    on conflict (from_node, to_node, type) do nothing;
  end if;

  return v_choice;
end $$;

revoke all on function make_choice(uuid, text, text, uuid, text, uuid[], uuid, jsonb) from public;
grant execute on function make_choice(uuid, text, text, uuid, text, uuid[], uuid, jsonb) to anon, authenticated;
