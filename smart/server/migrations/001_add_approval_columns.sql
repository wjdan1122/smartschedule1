-- Adds approval workflow columns to schedule_versions
-- Safe to run multiple times

BEGIN;

ALTER TABLE IF EXISTS schedule_versions
  ADD COLUMN IF NOT EXISTS scheduler_approved boolean DEFAULT false;

ALTER TABLE IF EXISTS schedule_versions
  ADD COLUMN IF NOT EXISTS committee_approved boolean DEFAULT false;

ALTER TABLE IF EXISTS schedule_versions
  ADD COLUMN IF NOT EXISTS committee_comment text;

-- Backfill defaults for existing rows
UPDATE schedule_versions SET scheduler_approved = false WHERE scheduler_approved IS NULL;
UPDATE schedule_versions SET committee_approved = false WHERE committee_approved IS NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_schedule_versions_active_committee
  ON schedule_versions (level, is_active, committee_approved);

CREATE INDEX IF NOT EXISTS idx_schedule_versions_pending
  ON schedule_versions (scheduler_approved, committee_approved, created_at);

COMMIT;

