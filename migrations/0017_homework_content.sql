-- Keep task IDs and their submission and feedback references during the rebuild.
-- https://developers.cloudflare.com/d1/sql-api/foreign-keys/#defer-foreign-key-constraints
PRAGMA defer_foreign_keys = true;
CREATE TABLE tasks_copy AS SELECT * FROM homework_tasks;
DROP TABLE homework_tasks;
CREATE TABLE homework_tasks (
  id TEXT PRIMARY KEY, homework_id TEXT NOT NULL REFERENCES homework(id), problem_id TEXT REFERENCES problems(id),
  state TEXT NOT NULL CHECK (state IN ('assigned','in_progress','submitted','changes_requested','completed','cancelled')),
  current_submission_id TEXT REFERENCES submissions(id),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'problem' CHECK (kind IN ('problem','chapter','quiz')),
  set_slug TEXT, chapter INTEGER, completed_at TEXT,
  CHECK ((kind='problem' AND problem_id IS NOT NULL AND set_slug IS NULL AND chapter IS NULL)
    OR (kind IN ('chapter','quiz') AND problem_id IS NULL AND set_slug IS NOT NULL AND chapter IS NOT NULL AND chapter>0 AND current_submission_id IS NULL AND state IN ('assigned','in_progress','completed','cancelled')))
);
INSERT INTO homework_tasks (id,homework_id,problem_id,state,current_submission_id,version,created_at,updated_at) SELECT * FROM tasks_copy;
DROP TABLE tasks_copy;
CREATE UNIQUE INDEX one_active_task ON homework_tasks(problem_id) WHERE state IN ('assigned','in_progress','submitted','changes_requested');
CREATE UNIQUE INDEX one_active_content ON homework_tasks(kind,set_slug,chapter) WHERE state IN ('assigned','in_progress');
CREATE INDEX homework_tasks_homework ON homework_tasks(homework_id);
