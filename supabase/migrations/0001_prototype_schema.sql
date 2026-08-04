-- Strategy Journey Platform — Prototype v0.1
-- Consultant Workspace vertical slice.
--
-- Three things in here are load-bearing and must not be relaxed:
--   1. Every graph entity has a `node` row (typed tables extend, never replace).
--   2. Intake rules are constraint triggers, not application code.
--   3. The ai_service role cannot write a choice node or a decision_log row.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type node_type as enum (
  'signal',
  'insight',
  'capability',
  'swot_item',
  'option',
  'choice',
  -- reserved for later phases; declared now so the enum never needs altering
  'assumption', 'initiative', 'metric', 'objective', 'problem',
  'segment', 'value_prop', 'risk', 'scenario', 'competitor', 'business_model'
);

create type node_status    as enum ('draft', 'active', 'superseded', 'rejected');
create type origin_kind    as enum ('human', 'ai', 'import');
create type prov_class     as enum ('client_content', 'sp_method', 'derived');
create type edge_type      as enum ('derives_from', 'supports', 'contradicts', 'considered_for');
create type source_kind    as enum ('web', 'document', 'interview', 'dataset');
create type scoring_mode   as enum ('consultant', 'workshop');
create type finding_status as enum ('open', 'accepted', 'resolved');
create type swot_quadrant  as enum ('strength', 'weakness', 'opportunity', 'threat');

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------

create table engagement (
  id              uuid primary key default gen_random_uuid(),
  org_name        text not null,
  name            text not null,
  horizon         text,
  key_questions   jsonb not null default '[]',
  stage_current   text not null default 'A',
  status          text not null default 'active',
  created_at      timestamptz not null default now()
);

create table app_user (
  id           uuid primary key default gen_random_uuid(),
  email        citext unique not null,
  display_name text not null,
  role         text not null default 'sp_strategist'
);

-- ---------------------------------------------------------------------------
-- Graph core
-- ---------------------------------------------------------------------------

create table node (
  id               uuid primary key default gen_random_uuid(),
  engagement_id    uuid not null references engagement(id) on delete cascade,
  type             node_type not null,
  label            text not null,
  payload          jsonb not null default '{}',
  status           node_status not null default 'draft',
  confidence       numeric check (confidence between 0 and 1),
  owner_user_id    uuid references app_user(id),
  stale_since      timestamptz,
  current_version  int not null default 1,
  origin           origin_kind not null default 'human',
  -- Classification must exist from day one: export honours the client-content
  -- vs SP-method distinction contractually, and back-classifying a populated
  -- database is not feasible.
  provenance_class prov_class not null default 'client_content',
  created_at       timestamptz not null default now(),
  created_by       uuid references app_user(id),
  updated_at       timestamptz not null default now()
);

create index node_engagement_type_idx on node (engagement_id, type);
create index node_payload_gin         on node using gin (payload);

create table edge (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagement(id) on delete cascade,
  from_node     uuid not null references node(id) on delete cascade,
  to_node       uuid not null references node(id) on delete cascade,
  type          edge_type not null,
  weight        numeric,
  rationale     text,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_user(id),
  unique (from_node, to_node, type),
  check (from_node <> to_node)
);

create index edge_to_idx   on edge (to_node, type);
create index edge_from_idx on edge (from_node, type);

-- An edge must not span two engagements. This is the cheap structural guard
-- that makes cross-engagement leakage impossible rather than merely absent.
create or replace function assert_edge_same_engagement() returns trigger
language plpgsql as $$
declare a uuid; b uuid;
begin
  select engagement_id into a from node where id = new.from_node;
  select engagement_id into b from node where id = new.to_node;
  if a is distinct from b or a is distinct from new.engagement_id then
    raise exception 'edge spans engagements (from=%, to=%, edge=%)', a, b, new.engagement_id;
  end if;
  return new;
end $$;

create constraint trigger edge_same_engagement
  after insert or update on edge
  deferrable initially deferred
  for each row execute function assert_edge_same_engagement();

-- ---------------------------------------------------------------------------
-- Signal sources — a signal without one of these cannot exist
-- ---------------------------------------------------------------------------

create table signal_source (
  id           uuid primary key default gen_random_uuid(),
  node_id      uuid not null references node(id) on delete cascade,
  kind         source_kind not null,
  uri          text,                    -- required for web; optional otherwise
  reference    text,                    -- required for interview; e.g. "CFO, Acme Ltd, exec interview"
  published_at date not null,
  retrieved_at date not null default current_date,
  credibility  int  not null default 3 check (credibility between 1 and 5),
  excerpt      text not null,
  -- A web source must carry a resolvable uri.
  constraint signal_source_web_needs_uri check (kind <> 'web' or uri is not null),
  -- An interview must name its source (person/role + date) in `reference`.
  constraint signal_source_interview_needs_ref check (kind <> 'interview' or reference is not null),
  -- Every source must be resolvable by at least one pointer. Documents and
  -- datasets are commonly reference-only — internal reports, retrieved
  -- catalogues — so they carry a `reference` rather than a `uri`. This matches
  -- seed.sql (b5, b14-b17) and CLAUDE.md §6's "resolvable uri-or-interview
  -- reference". The earlier `kind='interview' or uri is not null` wrongly forced
  -- a uri on every non-interview source and rejected those documents.
  constraint signal_source_resolvable check (uri is not null or reference is not null)
);

create index signal_source_node_idx on signal_source (node_id);

-- ---------------------------------------------------------------------------
-- Typed extensions. Note: each is keyed on node_id. They EXTEND the graph,
-- they do not sit beside it — otherwise edges cannot reference them and the
-- provenance chain breaks the moment it crosses one.
-- ---------------------------------------------------------------------------

create table capability (
  node_id           uuid primary key references node(id) on delete cascade,
  parent_id         uuid references capability(node_id),
  level             int not null default 1 check (level between 1 and 3),
  criticality       int not null check (criticality between 1 and 5),
  maturity_required int not null check (maturity_required between 1 and 5),
  owner_role        text
);

-- Keyed on (capability, respondent) even though the prototype has exactly one
-- respondent. Workshop Mode then becomes a new input path, not a migration.
create table capability_score (
  id            uuid primary key default gen_random_uuid(),
  capability_id uuid not null references capability(node_id) on delete cascade,
  respondent_id uuid references app_user(id),
  mode          scoring_mode not null default 'consultant',
  maturity      int not null check (maturity between 1 and 5),
  note          text,
  scored_at     timestamptz not null default now(),
  -- NULLS NOT DISTINCT (PG15+): without it, a null respondent_id would allow
  -- unlimited duplicate scores for the same capability.
  unique nulls not distinct (capability_id, respondent_id, mode)
);

create view capability_assessment as
select
  c.node_id,
  n.label,
  c.criticality,
  c.maturity_required,
  avg(s.maturity)::numeric(3,2)                     as maturity_current,
  count(s.id)                                       as respondents,
  coalesce(stddev_pop(s.maturity), 0)::numeric(3,2) as spread,
  greatest(c.maturity_required - avg(s.maturity), 0) * c.criticality as gap_weighted
from capability c
join node n on n.id = c.node_id
left join capability_score s on s.capability_id = c.node_id
group by c.node_id, n.label, c.criticality, c.maturity_required;

create table swot_item (
  node_id        uuid primary key references node(id) on delete cascade,
  quadrant       swot_quadrant not null,
  rank           int,
  -- Deletion requires a reason, so evidence is never silently discarded.
  deleted_at     timestamptz,
  deleted_by     uuid references app_user(id),
  deletion_reason text,
  check (deleted_at is null or deletion_reason is not null)
);

create table option_detail (
  node_id                 uuid primary key references node(id) on delete cascade,
  the_bet                 text not null,
  prerequisite_capabilities jsonb not null default '[]',
  what_must_be_true       text not null,
  strongest_argument_against text not null,
  open_questions          text,
  -- Deliberately no rank/score column. Options are never ranked by the system.
  requires_new_capability boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Decisions
-- ---------------------------------------------------------------------------

create table decision_log (
  id                      uuid primary key default gen_random_uuid(),
  engagement_id           uuid not null references engagement(id) on delete cascade,
  choice_node_id          uuid references node(id) on delete set null,
  title                   text not null,
  decision                text not null,
  alternatives_considered jsonb not null default '[]',
  rationale               text not null,
  decided_by              uuid not null references app_user(id),
  decided_at              timestamptz not null default now(),
  revisit_trigger         text
);

-- Join table, not an array column: arrays cannot carry foreign keys, so nothing
-- would stop them referencing deleted or cross-engagement nodes.
create table decision_node (
  decision_id uuid not null references decision_log(id) on delete cascade,
  node_id     uuid not null references node(id) on delete cascade,
  relation    text not null default 'relates_to',
  primary key (decision_id, node_id, relation)
);

-- ---------------------------------------------------------------------------
-- Coherence
-- ---------------------------------------------------------------------------

create table coherence_run (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagement(id) on delete cascade,
  triggered_by  text not null,
  ran_at        timestamptz not null default now(),
  checks_run    text[] not null,
  findings_count int not null default 0
);

create table coherence_finding (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references coherence_run(id) on delete cascade,
  check_id        text not null,          -- 'C1' | 'C2' | 'C3'
  is_deterministic boolean not null default true,
  severity        text not null default 'warning',
  message         text not null,
  status          finding_status not null default 'open',
  resolved_by     uuid references app_user(id),
  resolution_note text,
  decision_id     uuid references decision_log(id),
  -- Accepting a finding requires a note and a decision log entry: a strategy
  -- may legitimately contain a known incoherence, but as a recorded choice.
  check (status <> 'accepted' or (resolution_note is not null and decision_id is not null))
);

create table finding_node (
  finding_id uuid not null references coherence_finding(id) on delete cascade,
  node_id    uuid not null references node(id) on delete cascade,
  primary key (finding_id, node_id)
);

-- ---------------------------------------------------------------------------
-- Deck
-- ---------------------------------------------------------------------------

create table deck_template (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid references engagement(id) on delete cascade,  -- null = house
  name          text not null,
  theme_ref     text not null default 'sp-default',
  version       int not null default 1
);

create table slide_spec (
  id               uuid primary key default gen_random_uuid(),
  deck_template_id uuid not null references deck_template(id) on delete cascade,
  ordinal          int not null,
  layout_id        text not null,
  title_binding    text not null,
  data_binding     text,          -- resolves against /lib/graph/queries registry
  narrative_field  text not null default 'generated',
  notes            text,
  locked           boolean not null default false,
  -- Set true for locked or manually added slides. Principle 2 says the deck is
  -- never the source; locked slides are needed in practice. This makes the
  -- resulting graph drift measured rather than silent.
  unbacked         boolean not null default false,
  unique (deck_template_id, ordinal)
);

create table deck_render (
  id                   uuid primary key default gen_random_uuid(),
  deck_template_id     uuid not null references deck_template(id),
  engagement_id        uuid not null references engagement(id) on delete cascade,
  rendered_at          timestamptz not null default now(),
  rendered_by          uuid references app_user(id),
  pptx_ref             text,
  slides_changed       jsonb not null default '[]',
  unbacked_slide_count int not null default 0,
  slides_edited_after  int,      -- instrumentation: must fall over time
  duration_ms          int
);

-- ---------------------------------------------------------------------------
-- AI provenance
-- ---------------------------------------------------------------------------

create table ai_run (
  id                 uuid primary key default gen_random_uuid(),
  engagement_id      uuid not null references engagement(id) on delete cascade,
  purpose            text not null,
  model              text not null,
  prompt_template_id text not null,
  prompt_version     text not null,
  tokens_in          int,
  tokens_out         int,
  cost_usd           numeric(10,4),
  output             jsonb,
  -- The proportion accepted is the only honest measure of whether the AI layer
  -- earns its place. Check this before adding more of it.
  accepted           boolean,
  ran_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INTAKE ENFORCEMENT
-- Deferred constraint triggers so a node and its evidence commit in one tx.
-- The API validates too (better messages), but this is the backstop that
-- survives seed scripts, migrations and imports.
-- ---------------------------------------------------------------------------

create or replace function assert_signal_has_source() returns trigger
language plpgsql as $$
begin
  if new.type = 'signal'
     and not exists (select 1 from signal_source where node_id = new.id) then
    raise exception
      'signal % has no source: every signal needs a resolvable source and a date', new.id;
  end if;
  return new;
end $$;

create constraint trigger signal_needs_source
  after insert or update on node
  deferrable initially deferred
  for each row execute function assert_signal_has_source();

create or replace function assert_insight_has_signal() returns trigger
language plpgsql as $$
begin
  if new.type = 'insight' and not exists (
    select 1 from edge e join node s on s.id = e.from_node
    where e.to_node = new.id and e.type = 'supports' and s.type = 'signal'
  ) then
    raise exception
      'insight % cites no signal: an insight with no evidence is an opinion', new.id;
  end if;
  return new;
end $$;

create constraint trigger insight_needs_signal
  after insert or update on node
  deferrable initially deferred
  for each row execute function assert_insight_has_signal();

create or replace function assert_choice_is_grounded() returns trigger
language plpgsql as $$
begin
  if new.type = 'choice' and new.status = 'active' then
    if not exists (
      select 1 from edge e join node u on u.id = e.from_node
      where e.to_node = new.id and u.type in ('insight', 'swot_item')
    ) then
      raise exception 'choice % traces to no insight or swot item', new.id;
    end if;
    if not exists (select 1 from decision_log where choice_node_id = new.id) then
      raise exception 'choice % has no decision_log entry with alternatives', new.id;
    end if;
  end if;
  return new;
end $$;

create constraint trigger choice_needs_grounding
  after insert or update on node
  deferrable initially deferred
  for each row execute function assert_choice_is_grounded();

-- ---------------------------------------------------------------------------
-- THE WRITE RESTRICTION
-- Principle 5, enforced structurally. A prompt saying "do not decide" will
-- eventually be circumvented by a well-meaning feature, and the circumvention
-- will be invisible in the output. A permission boundary fails loudly.
-- ---------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'ai_service') then
    create role ai_service nologin;
  end if;
end $$;

grant usage on schema public to ai_service;
grant select on all tables in schema public to ai_service;

grant insert on node, edge, option_detail, swot_item, ai_run to ai_service;
grant update on option_detail, swot_item to ai_service;

revoke insert, update, delete on decision_log  from ai_service;
revoke insert, update, delete on decision_node from ai_service;
revoke insert, update, delete on engagement    from ai_service;

-- Managed/hosted Postgres (Supabase, RDS) connects as a NON-superuser `postgres`
-- role, which cannot SET ROLE into a role it is not a member of. Grant the
-- membership so the assertion suite and the AI service seam can switch into
-- ai_service. This does NOT relax Rule 3: once assumed, ai_service is still
-- bound by its own GRANTs and by RLS (it is not a table owner and has no
-- BYPASSRLS), so its writes to choice/decision_log still fail loudly. On a
-- local superuser postgres this grant is simply a harmless no-op-in-effect.
grant ai_service to postgres;

alter table node enable row level security;

-- Enabling RLS revokes implicit read access, so ai_service needs an explicit
-- SELECT policy or every generation call returns zero rows. It reads the whole
-- graph (it must, to generate options); the restriction is on writes.
create policy ai_can_read on node
  for select to ai_service
  using (true);

create policy ai_cannot_create_choice on node
  for insert to ai_service
  with check (type <> 'choice' and origin = 'ai');

create policy ai_cannot_modify_choice on node
  for update to ai_service
  using (type <> 'choice')
  with check (type <> 'choice');

-- Authenticated humans: full access within their engagement.
create policy human_node_access on node
  for all to authenticated
  using (true) with check (true);   -- tighten to engagement membership in Phase 1

-- ---------------------------------------------------------------------------
-- Provenance — THE query. Section 1 of CLAUDE.md is this function working.
-- ---------------------------------------------------------------------------

create or replace function node_provenance(target uuid)
returns table (
  depth        int,
  node_id      uuid,
  node_type    node_type,
  label        text,
  via          edge_type,
  source_uri   text,
  source_ref   text,
  published_at date
)
language sql stable as $$
  with recursive chain as (
    select 0 as depth, n.id, n.type, n.label, null::edge_type as via
    from node n where n.id = target
    union all
    select c.depth + 1, up.id, up.type, up.label, e.type
    from chain c
    join edge e  on e.to_node  = c.id
    join node up on up.id      = e.from_node
    where c.depth < 12
  )
  select c.depth, c.id, c.type, c.label, c.via,
         s.uri, s.reference, s.published_at
  from chain c
  left join signal_source s on s.node_id = c.id
  order by c.depth, c.label;
$$;

-- ---------------------------------------------------------------------------
-- Staleness propagation: change a signal, everything downstream is flagged.
-- ---------------------------------------------------------------------------

create or replace function propagate_staleness() returns trigger
language plpgsql as $$
begin
  if new.payload is distinct from old.payload or new.status is distinct from old.status then
    with recursive downstream as (
      select new.id as id, 0 as depth
      union all
      select e.to_node, d.depth + 1
      from downstream d join edge e on e.from_node = d.id
      where d.depth < 12
    )
    update node set stale_since = now()
    where id in (select id from downstream where depth > 0)
      and stale_since is null;
  end if;
  return new;
end $$;

create trigger node_staleness
  after update on node
  for each row execute function propagate_staleness();
