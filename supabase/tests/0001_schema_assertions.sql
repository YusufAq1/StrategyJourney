-- Schema assertions for migration 0001.
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0001_schema_assertions.sql
--
-- No pgTAP dependency. Each assertion either passes silently or raises.
-- Everything runs inside one transaction and is rolled back at the end.
--
-- These are not unit tests of application code. They test the guarantees that
-- the database itself must make, because those are the ones that survive a
-- seed script, an import job, or a developer in a hurry.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not cond then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;

-- Runs `sql`; passes if it raises, fails if it succeeds.
--
-- The intake guards (signal_needs_source, insight_needs_signal,
-- edge_same_engagement) are DEFERRABLE INITIALLY DEFERRED, so a violating write
-- does not raise until the transaction commits — NOT at statement end, and NOT
-- at the boundary of this PL/pgSQL exception block (a subtransaction). Without
-- forcing the check, `execute sql` returns cleanly and these assertions would
-- wrongly report "expected an error, got success". So after the write we issue
-- SET CONSTRAINTS ALL IMMEDIATE to make any pending deferred violation fire here
-- where it can be caught, then restore the migration's default deferred mode so
-- later legitimate two-statement inserts (e.g. 1.2) still work. This observes
-- the guarantee more strictly; it does not weaken it. (Immediate errors — CHECK
-- constraints, RLS, permissions, unique — still raise inside `execute` as before
-- and never reach the SET CONSTRAINTS line.)
create or replace function assert_raises(sql text, msg text) returns void
language plpgsql as $$
begin
  begin
    execute sql;
    set constraints all immediate;
  exception when others then
    set constraints all deferred;
    return;   -- expected
  end;
  set constraints all deferred;
  raise exception 'ASSERTION FAILED (expected an error, got success): %', msg;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into app_user (id, email, display_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'test@sp.local', 'Test Strategist', 'sp_strategist');

insert into engagement (id, org_name, name, horizon) values
  ('22222222-2222-2222-2222-222222222222', 'Test Client Ltd', 'Test Engagement', '3 years');

\set ENG '''22222222-2222-2222-2222-222222222222'''
\set USR '''11111111-1111-1111-1111-111111111111'''

-- ---------------------------------------------------------------------------
-- 1. INTAKE: a signal cannot exist without a source
-- ---------------------------------------------------------------------------

select assert_raises($$
  insert into node (id, engagement_id, type, label)
  values ('33333333-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222', 'signal', 'Unsourced claim');
$$, '1.1 signal without a signal_source row must be rejected');

-- ...and CAN exist with one, in the same transaction
savepoint sp_valid_signal;
insert into node (id, engagement_id, type, label, created_by)
values ('33333333-0000-0000-0000-000000000002', :ENG, 'signal',
        'Freight volumes rose 12% YoY in the GCC', :USR);
insert into signal_source (node_id, kind, uri, published_at, credibility, excerpt)
values ('33333333-0000-0000-0000-000000000002', 'web',
        'https://example.org/gcc-freight-2026', '2026-03-11', 4,
        'Regional freight volumes grew 12 per cent year on year.');
select assert(
  exists (select 1 from node where id = '33333333-0000-0000-0000-000000000002'),
  '1.2 sourced signal must be accepted');

-- ---------------------------------------------------------------------------
-- 2. INTAKE: a signal source must be resolvable
-- ---------------------------------------------------------------------------

select assert_raises($$
  insert into signal_source (node_id, kind, published_at, excerpt)
  values ('33333333-0000-0000-0000-000000000002', 'web', '2026-01-01', 'no uri');
$$, '2.1 a web source without a uri must be rejected');

select assert_raises($$
  insert into signal_source (node_id, kind, uri, published_at, excerpt)
  values ('33333333-0000-0000-0000-000000000002', 'interview',
          'https://x.test', '2026-01-01', 'no reference');
$$, '2.2 an interview source without a reference must be rejected');

-- An interview IS a valid source. "The CFO said this, on this date" qualifies.
insert into node (id, engagement_id, type, label, created_by)
values ('33333333-0000-0000-0000-000000000003', :ENG, 'signal',
        'CFO: clearance delays are the top customer complaint', :USR);
insert into signal_source (node_id, kind, reference, published_at, credibility, excerpt)
values ('33333333-0000-0000-0000-000000000003', 'interview',
        'CFO, Test Client Ltd, executive interview', '2026-02-04', 4,
        'The thing customers complain about is clearance delays, every time.');

-- ---------------------------------------------------------------------------
-- 3. INTAKE: an insight cannot exist without a supporting signal
-- ---------------------------------------------------------------------------

select assert_raises($$
  insert into node (id, engagement_id, type, label)
  values ('44444444-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222', 'insight', 'Uncited opinion');
$$, '3.1 insight with no supporting signal must be rejected');

insert into node (id, engagement_id, type, label, created_by)
values ('44444444-0000-0000-0000-000000000002', :ENG, 'insight',
        'Clearance speed is the binding constraint on share growth', :USR);
insert into edge (engagement_id, from_node, to_node, type)
values (:ENG, '33333333-0000-0000-0000-000000000002',
              '44444444-0000-0000-0000-000000000002', 'supports'),
       (:ENG, '33333333-0000-0000-0000-000000000003',
              '44444444-0000-0000-0000-000000000002', 'supports');
select assert(
  exists (select 1 from node where id = '44444444-0000-0000-0000-000000000002'),
  '3.2 insight citing two signals must be accepted');

-- ---------------------------------------------------------------------------
-- 4. Edges must not span engagements
-- ---------------------------------------------------------------------------

insert into engagement (id, org_name, name)
values ('22222222-2222-2222-2222-222222222299', 'Other Client', 'Other Engagement');

insert into node (id, engagement_id, type, label)
values ('55555555-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222299', 'insight', 'Other engagement insight');

select assert_raises($$
  insert into edge (engagement_id, from_node, to_node, type)
  values ('22222222-2222-2222-2222-222222222222',
          '33333333-0000-0000-0000-000000000002',
          '55555555-0000-0000-0000-000000000001', 'supports');
$$, '4.1 an edge crossing engagements must be rejected');

-- ---------------------------------------------------------------------------
-- 5. THE WRITE RESTRICTION — the one that matters commercially
-- ---------------------------------------------------------------------------

select assert(
  exists (select 1 from pg_roles where rolname = 'ai_service'),
  '5.0 ai_service role must exist');

savepoint sp_ai;
set local role ai_service;

select assert_raises($$
  insert into node (engagement_id, type, label, origin)
  values ('22222222-2222-2222-2222-222222222222', 'choice', 'AI-made choice', 'ai');
$$, '5.1 ai_service MUST NOT be able to insert a choice node');

select assert_raises($$
  insert into decision_log (engagement_id, title, decision, rationale, decided_by)
  values ('22222222-2222-2222-2222-222222222222', 'x', 'y', 'z',
          '11111111-1111-1111-1111-111111111111');
$$, '5.2 ai_service MUST NOT be able to write decision_log');

select assert_raises($$
  update node set label = 'tampered'
  where type = 'choice';
$$, '5.3 ai_service MUST NOT be able to modify a choice node');

-- ...but it CAN create options. Without this the derivation cannot run at all.
insert into node (id, engagement_id, type, label, origin, provenance_class)
values ('66666666-0000-0000-0000-000000000001', :ENG, 'option',
        'Same-day cross-border clearance tier', 'ai', 'derived');
select assert(
  exists (select 1 from node where id = '66666666-0000-0000-0000-000000000001'),
  '5.4 ai_service MUST be able to insert an option node');

-- ...and it can READ the graph. RLS revokes implicit reads; without a select
-- policy every generation call silently returns zero rows.
select assert(
  (select count(*) from node where type = 'signal') >= 2,
  '5.5 ai_service MUST be able to read the graph');

reset role;
rollback to savepoint sp_ai;

-- ---------------------------------------------------------------------------
-- 6. A choice must be grounded before it goes active
-- ---------------------------------------------------------------------------

insert into node (id, engagement_id, type, label, status, created_by)
values ('77777777-0000-0000-0000-000000000001', :ENG, 'choice',
        'Win on clearance speed', 'draft', :USR);

select assert_raises($$
  update node set status = 'active'
  where id = '77777777-0000-0000-0000-000000000001';
$$, '6.1 a choice with no insight and no decision_log must not go active');

insert into edge (engagement_id, from_node, to_node, type)
values (:ENG, '44444444-0000-0000-0000-000000000002',
              '77777777-0000-0000-0000-000000000001', 'derives_from');
insert into decision_log (engagement_id, choice_node_id, title, decision,
                          alternatives_considered, rationale, decided_by)
values (:ENG, '77777777-0000-0000-0000-000000000001',
        'How to win', 'Compete on clearance speed',
        '[{"label":"Compete on price","whyNot":"Structurally disadvantaged on cost"}]',
        'Clearance speed is the constraint customers actually name.', :USR);

update node set status = 'active' where id = '77777777-0000-0000-0000-000000000001';
select assert(
  (select status from node where id = '77777777-0000-0000-0000-000000000001') = 'active',
  '6.2 a grounded choice must be allowed to go active');

-- ---------------------------------------------------------------------------
-- 7. SWOT deletion requires a reason
-- ---------------------------------------------------------------------------

insert into node (id, engagement_id, type, label, origin, provenance_class)
values ('88888888-0000-0000-0000-000000000001', :ENG, 'swot_item',
        'Clearance times lag benchmark by 26 hours', 'ai', 'derived');
insert into swot_item (node_id, quadrant, rank)
values ('88888888-0000-0000-0000-000000000001', 'weakness', 1);

select assert_raises($$
  update swot_item set deleted_at = now()
  where node_id = '88888888-0000-0000-0000-000000000001';
$$, '7.1 deleting a swot item without a reason must be rejected');

update swot_item
set deleted_at = now(), deletion_reason = 'Superseded by Q1 benchmark refresh'
where node_id = '88888888-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- 8. PROVENANCE — the §1 test, as a function
-- ---------------------------------------------------------------------------

select assert(
  (select count(*) from node_provenance('77777777-0000-0000-0000-000000000001')
   where node_type = 'signal') = 2,
  '8.1 provenance of the choice must reach both underlying signals');

select assert(
  (select count(*) from node_provenance('77777777-0000-0000-0000-000000000001')
   where node_type = 'signal' and published_at is not null) = 2,
  '8.2 every signal in the chain must surface its publication date');

select assert(
  (select count(*) from node_provenance('77777777-0000-0000-0000-000000000001')
   where source_uri is not null or source_ref is not null) = 2,
  '8.3 every signal in the chain must surface a source');

select assert(
  (select max(depth) from node_provenance('77777777-0000-0000-0000-000000000001')) = 2,
  '8.4 chain depth must be choice(0) -> insight(1) -> signal(2)');

-- ---------------------------------------------------------------------------
-- 9. Staleness propagation
-- ---------------------------------------------------------------------------

update node set stale_since = null
where id in ('44444444-0000-0000-0000-000000000002',
             '77777777-0000-0000-0000-000000000001');

update node set payload = '{"revised": true}'
where id = '33333333-0000-0000-0000-000000000002';

select assert(
  (select stale_since from node where id = '44444444-0000-0000-0000-000000000002') is not null,
  '9.1 changing a signal must mark the downstream insight stale');

select assert(
  (select stale_since from node where id = '77777777-0000-0000-0000-000000000001') is not null,
  '9.2 staleness must propagate two hops, to the choice');

select assert(
  (select stale_since from node where id = '33333333-0000-0000-0000-000000000003') is null,
  '9.3 an unrelated signal must NOT be marked stale');

-- ---------------------------------------------------------------------------
-- 10. Capability assessment view
-- ---------------------------------------------------------------------------

insert into node (id, engagement_id, type, label, created_by)
values ('99999999-0000-0000-0000-000000000001', :ENG, 'capability', 'Customs Clearance', :USR);
insert into capability (node_id, level, criticality, maturity_required)
values ('99999999-0000-0000-0000-000000000001', 2, 5, 4);
insert into capability_score (capability_id, respondent_id, maturity)
values ('99999999-0000-0000-0000-000000000001', :USR, 2);

select assert(
  (select gap_weighted from capability_assessment
   where node_id = '99999999-0000-0000-0000-000000000001') = 10,
  '10.1 gap_weighted must be (required 4 - current 2) * criticality 5 = 10');

select assert_raises($$
  insert into capability_score (capability_id, respondent_id, maturity)
  values ('99999999-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 3);
$$, '10.2 duplicate score for the same respondent must be rejected');

-- ---------------------------------------------------------------------------
-- 11. Accepting a coherence finding requires a note AND a decision
-- ---------------------------------------------------------------------------

insert into coherence_run (id, engagement_id, triggered_by, checks_run)
values ('aaaaaaaa-0000-0000-0000-000000000001', :ENG, 'test', array['C1','C2','C3']);

select assert_raises($$
  insert into coherence_finding (run_id, check_id, message, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'C1',
          'Choice traces to no insight', 'accepted');
$$, '11.1 accepting a finding without a note and decision must be rejected');

-- ---------------------------------------------------------------------------

do $$ begin raise notice 'ALL SCHEMA ASSERTIONS PASSED'; end $$;

rollback;
