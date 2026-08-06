-- Step 9 (post-prototype) — multi-client workspace.
--
-- The prototype ran on one seeded engagement (Meridian). To use the workspace
-- for many clients we need (a) a couple of descriptive columns on engagement so
-- the "New client" form can capture company context, and (b) two atomic
-- create-functions on the human path: one to stand up a new engagement (with a
-- starter capability inventory so its Capabilities page is never blank), and one
-- to add a capability by hand.
--
-- Both functions are SECURITY INVOKER, exactly like create_signal/create_insight
-- in 0002 — they bundle multi-table writes into one transaction but run as the
-- caller (anon), so the human_intake RLS policy on `node` and every intake
-- trigger still apply. A capability node has type 'capability', which the
-- human_intake policy (0004: origin='human' and type <> 'option') permits.
--
-- RLS lives only on `node` (see docs/adr/0006). The other tables
-- (engagement, capability, capability_score) rely on table GRANTs. We grant the
-- needed privileges to anon EXPLICITLY here rather than depend on Supabase's
-- implicit defaults, so the create path is self-documenting and portable.

-- ---------------------------------------------------------------------------
-- 1. Descriptive columns for the client / engagement
-- ---------------------------------------------------------------------------
alter table engagement
  add column if not exists industry    text,
  add column if not exists description text;

-- ---------------------------------------------------------------------------
-- 2. Grants for the human (anon) create path
-- ---------------------------------------------------------------------------
grant insert on engagement       to anon;
grant insert on capability       to anon;
grant insert on capability_score to anon;

-- ---------------------------------------------------------------------------
-- 3. create_capability — one capability (node + typed row + initial score)
-- ---------------------------------------------------------------------------
-- p_parent_id is the level-1 domain a level-2 capability sits under (null for a
-- level-1 domain). p_current is the starting current-maturity score; the
-- consultant refines it with the maturity control afterwards.
create or replace function create_capability(
  p_engagement_id     uuid,
  p_label             text,
  p_level             int,
  p_parent_id         uuid,
  p_criticality       int,
  p_maturity_required int,
  p_current           int  default 1,
  p_created_by        uuid default null
) returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  insert into node (engagement_id, type, label, status, origin, provenance_class, created_by)
  values (p_engagement_id, 'capability', p_label, 'active', 'human', 'client_content', p_created_by)
  returning id into v_id;

  insert into capability (node_id, parent_id, level, criticality, maturity_required, owner_role)
  values (v_id, p_parent_id, p_level, p_criticality, p_maturity_required,
          case when p_level = 1 then 'Executive' else 'Function head' end);

  insert into capability_score (capability_id, respondent_id, mode, maturity)
  values (v_id, p_created_by, 'consultant', greatest(1, least(5, coalesce(p_current, 1))));

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. create_engagement — new client, optionally with a starter inventory
-- ---------------------------------------------------------------------------
-- The starter template is a generic, cross-industry capability map so a brand
-- new client's heatmap and gaps view work immediately. Everything is editable:
-- current maturities default low (1 = "not yet assessed") and the consultant
-- scores them, adds, or removes capabilities from the Capabilities page.
create or replace function create_engagement(
  p_org_name      text,
  p_name          text,
  p_industry      text,
  p_description   text,
  p_horizon       text,
  p_key_questions jsonb,
  p_created_by    uuid    default null,
  p_seed_starter  boolean default true
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_eng uuid;
  d record;
  v_parent uuid;
begin
  insert into engagement (org_name, name, industry, description, horizon, key_questions)
  values (p_org_name, p_name, nullif(p_industry, ''), nullif(p_description, ''),
          nullif(p_horizon, ''), coalesce(p_key_questions, '[]'::jsonb))
  returning id into v_eng;

  if p_seed_starter then
    -- level-1 domain -> its level-2 capabilities, each (label, criticality, required)
    for d in
      select * from (values
        ('Commercial & Go-to-Market', 5, 4, jsonb_build_array(
            jsonb_build_object('l','Sales & Business Development','c',5,'r',4),
            jsonb_build_object('l','Marketing & Brand','c',4,'r',4),
            jsonb_build_object('l','Pricing & Revenue','c',4,'r',4))),
        ('Operations & Delivery', 5, 4, jsonb_build_array(
            jsonb_build_object('l','Service Delivery','c',5,'r',4),
            jsonb_build_object('l','Supply Chain & Fulfilment','c',4,'r',4))),
        ('Technology & Data', 4, 4, jsonb_build_array(
            jsonb_build_object('l','Core Systems & Integration','c',5,'r',4),
            jsonb_build_object('l','Data & Analytics','c',4,'r',4))),
        ('People & Organisation', 4, 3, jsonb_build_array(
            jsonb_build_object('l','Talent & Capability','c',4,'r',3),
            jsonb_build_object('l','Leadership & Governance','c',4,'r',4))),
        ('Finance & Risk', 5, 4, jsonb_build_array(
            jsonb_build_object('l','Financial Management','c',4,'r',4),
            jsonb_build_object('l','Compliance & Risk','c',5,'r',4)))
      ) as t(domain, crit, req, children)
    loop
      v_parent := create_capability(v_eng, d.domain, 1, null, d.crit::int, d.req::int, 1, p_created_by);
      perform create_capability(
        v_eng,
        (child->>'l'),
        2,
        v_parent,
        (child->>'c')::int,
        (child->>'r')::int,
        1,
        p_created_by
      )
      from jsonb_array_elements(d.children) as child;
    end loop;
  end if;

  return v_eng;
end $$;
