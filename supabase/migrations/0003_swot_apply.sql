-- Step 5 — the AI write path for derived SWOT.
--
-- SWOT items are AI-generated: they must be written by the ai_service role
-- (origin='ai'), which the app runtime cannot assume over PostgREST. So this is
-- a SECURITY DEFINER function OWNED BY ai_service: calling it (as anon, from a
-- Server Action) executes with ai_service's privileges. Crucially this PRESERVES
-- Rule 3 — because it runs as ai_service, the ai_cannot_create_choice RLS policy
-- and the revoked decision_log grant still apply: this path can create swot_item
-- nodes and derives_from edges, and cannot fabricate a choice or a decision_log
-- row. (Owning it as postgres would bypass RLS and break that guarantee — see
-- docs/adr/0008.)
--
-- Atomic: swot_item node + swot_item row + one derives_from edge per verified
-- evidence id + one ai_run log row, in one transaction. Unknown evidence ids are
-- dropped here as a backstop to the code-side post-processing.

create or replace function derive_swot_apply(
  p_engagement_id      uuid,
  p_items              jsonb,
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

  insert into ai_run (engagement_id, purpose, model, prompt_template_id, prompt_version,
                      tokens_in, tokens_out, output, accepted)
  values (p_engagement_id, 'swot_derivation', p_model, p_prompt_template_id, p_prompt_version,
          p_tokens_in, p_tokens_out, p_output, null);

  return jsonb_build_object('created', to_jsonb(created));
end $$;

-- ai_service must be able to own an object in `public` to be the definer.
-- This does not widen Rule 3: RLS + the revoked decision_log grant still bind it.
grant create on schema public to ai_service;
alter function derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb) owner to ai_service;
revoke all on function derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb) from public;
grant execute on function derive_swot_apply(uuid, jsonb, text, text, text, int, int, uuid, jsonb) to anon, authenticated;
