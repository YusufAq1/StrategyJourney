-- Step 3 — the human (consultant) access path + atomic intake functions.
--
-- Auth beyond a single hardcoded user is out of scope (CLAUDE.md §4). In the
-- prototype the publishable/anon key stands in for the one consultant, and all
-- app DB access runs server-side (Server Components read, Server Actions write).
--
-- RLS on `node` exists to enforce the ai_service / Rule 3 boundary. It must
-- still let the human path read the graph and create evidence. So:
--   - human_read   : anon may SELECT any node.
--   - human_intake : anon may INSERT signal/insight/capability/swot_item nodes
--                    (origin='human'), but NOT choice or option. Choices are a
--                    deliberate human action wired in Step 6-7; options are
--                    ai_service only. This keeps the publishable key from
--                    fabricating a decision or a machine option.
--
-- KNOWN PROTOTYPE POSTURE (Phase-1 hardening, see docs/adr/0006): RLS is only on
-- `node`; Supabase's defaults leave anon with INSERT on edge/signal_source/
-- decision_log etc. Phase 1 introduces real authenticated users + a service_role
-- server path and enables RLS across the board.

create policy human_read on node
  for select to anon
  using (true);

create policy human_intake on node
  for insert to anon
  with check (origin = 'human' and type not in ('choice', 'option'));

-- ---------------------------------------------------------------------------
-- Atomic intake functions. A signal (node + signal_source) and an insight
-- (node + >=1 supports edge) each span two tables and MUST commit in one
-- transaction, because the intake triggers are DEFERRABLE INITIALLY DEFERRED and
-- validate at commit. PostgREST issues one statement per request, so a two-call
-- insert would commit the node alone and trip the trigger. These functions do
-- the whole intake in a single call/transaction. SECURITY INVOKER: they run as
-- the caller (anon), so the human_intake policy and every trigger still apply —
-- the function bundles the writes, it does not bypass the guarantees.
-- ---------------------------------------------------------------------------

create or replace function create_signal(
  p_engagement_id uuid,
  p_label         text,
  p_dimension     text,
  p_kind          source_kind,
  p_uri           text,
  p_reference     text,
  p_published_at  date,
  p_retrieved_at  date,
  p_credibility   int,
  p_excerpt       text,
  p_created_by    uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  insert into node (engagement_id, type, label, payload, status, origin, provenance_class, created_by)
  values (p_engagement_id, 'signal', p_label,
          jsonb_build_object('dimension', p_dimension),
          'active', 'human', 'client_content', p_created_by)
  returning id into v_id;

  insert into signal_source (node_id, kind, uri, reference, published_at, retrieved_at, credibility, excerpt)
  values (v_id, p_kind, nullif(p_uri, ''), nullif(p_reference, ''), p_published_at,
          coalesce(p_retrieved_at, current_date), p_credibility, p_excerpt);

  return v_id;
end $$;

create or replace function create_insight(
  p_engagement_id uuid,
  p_label         text,
  p_confidence    numeric,
  p_signal_ids    uuid[],
  p_created_by    uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  if p_signal_ids is null or array_length(p_signal_ids, 1) is null then
    raise exception 'an insight must cite at least one signal';
  end if;

  insert into node (engagement_id, type, label, status, origin, provenance_class, confidence, created_by)
  values (p_engagement_id, 'insight', p_label, 'active', 'human', 'client_content', p_confidence, p_created_by)
  returning id into v_id;

  insert into edge (engagement_id, from_node, to_node, type)
  select p_engagement_id, sid, v_id, 'supports'
  from unnest(p_signal_ids) as sid;

  return v_id;
end $$;
