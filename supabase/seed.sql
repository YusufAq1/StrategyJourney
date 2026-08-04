-- Seed: one realistic engagement to build and demo against.
--
-- Meridian Logistics — a regional 3PL / freight forwarder in the GCC. Synthetic
-- but plausible: the signal mix, credibility spread and capability gaps are
-- shaped so the SWOT derivation and option generation have something real to
-- chew on, including a couple of deliberate contradictions.
--
-- REPLACE THIS with a real past engagement's signals as soon as the practice
-- lead can supply them. Building derivations against invented evidence tells
-- you the pipeline runs; it does not tell you the output is any good.
--
-- Node UUIDs are derived from short codes (b1, b10, c1, d12, ...) with
--   '00000000-0000-0000-0000-' || lpad(code, 12, '0')
-- The lpad is load-bearing: the original seed concatenated onto a fixed prefix
-- that only had room for a 2-char suffix, so 3-char codes (b10-b18, d10-d12)
-- produced invalid 33-hex-digit UUIDs. lpad right-justifies into the final
-- 12-char segment, so 2-char codes keep their existing values (e.g. insight c1
-- is still ...0000c1) and 3-char codes become valid.

begin;

insert into app_user (id, email, display_name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'strategist@sp.local', 'A. Strategist', 'sp_strategist'),
  ('00000000-0000-0000-0000-0000000000a2', 'analyst@sp.local',    'B. Analyst',    'sp_analyst'),
  ('00000000-0000-0000-0000-0000000000a3', 'ai@sp.local',         'AI Service',    'ai_service');

insert into engagement (id, org_name, name, horizon, key_questions, stage_current) values
  ('00000000-0000-0000-0000-0000000000e1',
   'Meridian Logistics',
   'Meridian Growth Strategy 2027-2030',
   '3 years',
   '["Where should Meridian compete as GCC trade lanes reconfigure?",
     "Can we defend mid-market share against digital-native forwarders?",
     "What must be true for a cross-border express tier to work?"]',
   'C');

-- ---------------------------------------------------------------------------
-- Signals (18) — each with a source. Dimension tags stand in for the full
-- Stage A registers, which are out of scope for the prototype.
-- ---------------------------------------------------------------------------

with s(id, dim, label, excerpt, kind, uri, ref, pub, cred) as (values
 ('b1','market','GCC freight forwarding market grew 9.4% in 2025 to USD 31bn',
  'The GCC freight forwarding market reached USD 31 billion in 2025, up 9.4 per cent.',
  'web','https://example.org/gcc-logistics-outlook-2026',null,'2026-02-18',4),

 ('b2','market','Mid-market shippers are the fastest-growing segment at 14% CAGR',
  'Shippers turning over USD 5-50m annually represent the fastest-growing customer band.',
  'web','https://example.org/gcc-logistics-outlook-2026',null,'2026-02-18',4),

 ('b3','competitor','Two digital-native forwarders entered the UAE market in 2025',
  'Both launched with instant-quote platforms and no owned assets.',
  'web','https://example.org/forwarding-entrants',null,'2026-01-09',4),

 ('b4','competitor','Incumbent regional forwarder cut mid-market rates 8% in Q4',
  'The rate move was described as a defensive response to platform entrants.',
  'web','https://example.org/rate-pressure-q4',null,'2026-01-22',3),

 ('b5','competitor','Largest competitor has no same-day customs clearance offer',
  'Their published service catalogue lists next-day clearance as the fastest tier.',
  'document',null,'Competitor service catalogue, retrieved Feb 2026','2026-02-02',5),

 ('b6','pestel_legal','UAE unified customs digital filing mandatory from Jan 2027',
  'All declarations must be filed through the unified digital channel from 1 January 2027.',
  'web','https://example.org/customs-digital-mandate',null,'2026-03-04',5),

 ('b7','pestel_technological','API-based rate quoting is now table stakes for shippers under USD 50m',
  'Buyers increasingly disqualify forwarders who cannot return a quote programmatically.',
  'web','https://example.org/shipper-procurement-survey',null,'2026-01-30',3),

 ('b8','pestel_economic','Regional trade volumes forecast to grow 6-8% annually to 2030',
  'Non-oil trade is expected to sustain mid-single-digit growth through the decade.',
  'web','https://example.org/trade-forecast-2030',null,'2026-02-11',4),

 ('b9','pestel_political','New trade corridor agreements expected to shift lane volumes',
  'Corridor agreements signed in 2025 are expected to redistribute volume across lanes.',
  'web','https://example.org/corridor-agreements',null,'2025-11-27',3),

 ('b10','pestel_environmental','Large shippers now require emissions reporting per shipment',
  'Emissions data at shipment level is appearing as a standard tender requirement.',
  'web','https://example.org/scope3-tenders',null,'2026-02-25',4),

 ('b11','pestel_social','Regional logistics talent shortage in customs and compliance roles',
  'Employers report 4-6 month fill times for experienced customs brokerage staff.',
  'web','https://example.org/logistics-talent-2026',null,'2026-01-14',3),

 ('b12','customer','CFO: clearance delays are the single most common customer complaint',
  'It is the thing customers complain about, every single time, without exception.',
  'interview',null,'CFO, Meridian Logistics, executive interview','2026-03-02',5),

 ('b13','customer','Head of Sales: we lose mid-market deals on quote turnaround, not price',
  'We are usually competitive on price. We lose because it takes us two days to quote.',
  'interview',null,'Head of Sales, Meridian Logistics, executive interview','2026-03-02',5),

 ('b14','customer','Top-20 customer churn was 11% in 2025, up from 4% in 2023',
  'Churn among the top twenty accounts nearly tripled over two years.',
  'document',null,'Meridian internal account review, FY2025','2026-01-31',5),

 ('b15','internal','Average quote turnaround is 31 hours against a market norm under 4',
  'Median time from enquiry to quote issued was 31 hours across FY2025.',
  'document',null,'Meridian operations report, FY2025','2026-01-31',5),

 ('b16','internal','Customs brokerage licences held in 6 of 7 GCC markets',
  'Meridian holds in-house brokerage licences in six of the seven GCC markets.',
  'document',null,'Meridian capability register, Feb 2026','2026-02-08',5),

 ('b17','internal','No public API; all quoting is manual through the sales desk',
  'There is no programmatic quoting interface. All enquiries route through the desk.',
  'document',null,'Meridian systems inventory, Feb 2026','2026-02-08',5),

 -- Deliberate contradiction with b12/b15: the derivation should surface both.
 ('b18','customer','COO: our clearance times are among the best in the region',
  'On clearance we are genuinely strong — better than most of the people we compete with.',
  'interview',null,'COO, Meridian Logistics, executive interview','2026-03-03',4)
)
, ins_node as (
  insert into node (id, engagement_id, type, label, payload, status, created_by)
  select ('00000000-0000-0000-0000-' || lpad(s.id, 12, '0'))::uuid,
         '00000000-0000-0000-0000-0000000000e1',
         'signal', s.label,
         jsonb_build_object('dimension', s.dim),
         'active',
         '00000000-0000-0000-0000-0000000000a2'
  from s
  returning id
)
insert into signal_source (node_id, kind, uri, reference, published_at, retrieved_at, credibility, excerpt)
select ('00000000-0000-0000-0000-' || lpad(s.id, 12, '0'))::uuid,
       s.kind::source_kind, s.uri, s.ref, s.pub::date, '2026-03-10'::date, s.cred, s.excerpt
from s;

-- ---------------------------------------------------------------------------
-- Insights (4) — each citing signals
-- ---------------------------------------------------------------------------

insert into node (id, engagement_id, type, label, status, confidence, created_by) values
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1','insight',
  'Quote turnaround, not price, is the binding constraint on mid-market win rate','active',0.8,
  '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000e1','insight',
  'Multi-market brokerage licensing is a defensible asset the platform entrants cannot replicate quickly','active',0.7,
  '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000e1','insight',
  'Internal and customer views of clearance performance directly contradict each other','active',0.9,
  '00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000e1','insight',
  'The 2027 digital customs mandate converts a compliance cost into an entry barrier','active',0.6,
  '00000000-0000-0000-0000-0000000000a1');

-- Edges built from short codes via the same lpad rule, so there are no literal
-- UUIDs to keep in sync (the original had invalid 3-char literals here).
insert into edge (engagement_id, from_node, to_node, type)
select '00000000-0000-0000-0000-0000000000e1'::uuid,
       ('00000000-0000-0000-0000-' || lpad(e.f, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad(e.t, 12, '0'))::uuid,
       e.et::edge_type
from (values
 ('b13','c1','supports'),
 ('b15','c1','supports'),
 ('b7', 'c1','supports'),
 ('b14','c1','supports'),

 ('b16','c2','supports'),
 ('b3', 'c2','supports'),
 ('b11','c2','supports'),

 ('b12','c3','supports'),
 ('b18','c3','contradicts'),
 ('b5', 'c3','supports'),

 ('b6', 'c4','supports'),
 ('b16','c4','supports')
) as e(f, t, et);

-- ---------------------------------------------------------------------------
-- Capabilities (12) — two levels, with scores
-- ---------------------------------------------------------------------------

with c(id, label, parent, lvl, crit, req, cur) as (values
 ('d1','Commercial',            null,1,5,4,3),
 ('d2','Quote & Pricing',       'd1',2,5,4,1),
 ('d3','Key Account Management','d1',2,4,4,3),
 ('d4','Digital Channel',       'd1',2,4,4,1),

 ('d5','Operations',            null,1,5,4,3),
 ('d6','Customs Clearance',     'd5',2,5,4,3),
 ('d7','Freight Execution',     'd5',2,4,3,4),
 ('d8','Network & Partner Mgmt','d5',2,3,3,3),

 ('d9','Technology',            null,1,4,4,2),
 ('d10','Integration & APIs',   'd9',2,5,4,1),
 ('d11','Data & Reporting',     'd9',2,4,4,2),

 ('d12','Compliance & Licensing',null,1,5,4,5)
)
, ins as (
  insert into node (id, engagement_id, type, label, status, created_by)
  select ('00000000-0000-0000-0000-' || lpad(c.id, 12, '0'))::uuid,
         '00000000-0000-0000-0000-0000000000e1','capability', c.label,'active',
         '00000000-0000-0000-0000-0000000000a2'
  from c returning id
)
insert into capability (node_id, parent_id, level, criticality, maturity_required, owner_role)
select ('00000000-0000-0000-0000-' || lpad(c.id, 12, '0'))::uuid,
       case when c.parent is null then null
            else ('00000000-0000-0000-0000-' || lpad(c.parent, 12, '0'))::uuid end,
       c.lvl, c.crit, c.req,
       case when c.lvl = 1 then 'Executive' else 'Function head' end
from c
order by c.lvl;   -- parents before children

insert into capability_score (capability_id, respondent_id, mode, maturity)
select ('00000000-0000-0000-0000-' || lpad(c.id, 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000a1','consultant', c.cur
from (values
 ('d1',3),('d2',1),('d3',3),('d4',1),('d5',3),('d6',3),
 ('d7',4),('d8',3),('d9',2),('d10',1),('d11',2),('d12',5)
) as c(id, cur);

-- ---------------------------------------------------------------------------
-- Deck template
-- ---------------------------------------------------------------------------

insert into deck_template (id, engagement_id, name, theme_ref, version) values
  ('00000000-0000-0000-0000-0000000000f1', null, 'SP House Deck v0.1', 'sp-default', 1);

insert into slide_spec (deck_template_id, ordinal, layout_id, title_binding, data_binding, narrative_field) values
 ('00000000-0000-0000-0000-0000000000f1',1,'cover',            'static:Strategy on a page',        'engagement.meta()',                              'static'),
 ('00000000-0000-0000-0000-0000000000f1',2,'evidence_summary', 'static:The evidence base',         'signals.summary(by=dimension)',                   'generated'),
 ('00000000-0000-0000-0000-0000000000f1',3,'heatmap_full',     'static:Business capability heatmap','capabilities.heatmap(level=2, colour_by=gap)',   'generated'),
 ('00000000-0000-0000-0000-0000000000f1',4,'ranked_list',      'static:Priority capability gaps',  'capabilities.gaps(top=8)',                        'generated'),
 ('00000000-0000-0000-0000-0000000000f1',5,'quad_grid',        'static:SWOT',                      'swot.derived()',                                  'generated'),
 ('00000000-0000-0000-0000-0000000000f1',6,'option_cards',     'static:Options considered',        'options.all()',                                   'generated'),
 ('00000000-0000-0000-0000-0000000000f1',7,'choice_rationale', 'static:Our choice, and why',       'choice.selected()',                               'generated');

commit;

-- Not seeded, deliberately: swot_item, option, choice, decision_log.
-- Those are produced by the derivations and by a human, and watching them
-- appear is how you verify the pipeline actually works.
