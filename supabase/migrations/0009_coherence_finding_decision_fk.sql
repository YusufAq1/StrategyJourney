-- Fix engagement deletion: coherence_finding.decision_id had no ON DELETE
-- action (0001), so it defaulted to NO ACTION/RESTRICT. decision_log rows
-- cascade from engagement directly, while coherence_finding rows cascade
-- from engagement via coherence_run — two independent cascade paths off the
-- same delete. Whenever Postgres happened to delete a decision_log row
-- before the coherence_finding row that still pointed at it via decision_id,
-- the delete failed with "update or delete on table decision_log violates
-- foreign key constraint coherence_finding_decision_id_fkey", even though
-- the coherence_finding row was itself about to be cascade-deleted in the
-- same statement.
--
-- decision_id is already nullable (only required when status = 'accepted',
-- per the check constraint below it), so ON DELETE SET NULL is safe and
-- matches the choice_node_id pattern on decision_log itself. It also makes
-- deletion order-independent, which is the actual fix — not a client vs.
-- engagement naming issue.
alter table coherence_finding
  drop constraint coherence_finding_decision_id_fkey,
  add constraint coherence_finding_decision_id_fkey
    foreign key (decision_id) references decision_log(id) on delete set null;
