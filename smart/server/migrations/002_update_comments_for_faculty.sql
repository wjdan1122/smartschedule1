-- Reuse 'comments' table for faculty by adding optional user_id
-- Safe to run multiple times

BEGIN;

ALTER TABLE IF EXISTS comments
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;

-- Allow comments without student_id (for faculty entries)
DO $$
BEGIN
  -- if column exists then drop NOT NULL; if not exists, do nothing
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='comments' AND column_name='student_id' AND is_nullable='NO'
  ) THEN
    EXECUTE 'ALTER TABLE comments ALTER COLUMN student_id DROP NOT NULL';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_comments_version ON comments(schedule_version_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

COMMIT;

