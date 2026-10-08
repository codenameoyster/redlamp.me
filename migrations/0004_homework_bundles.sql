-- Homework becomes a titled bundle. Each problem in a bundle is a task with its own review state.
-- Each existing homework row becomes one bundle and one task with the same ID.
-- The rename moves the submission and feedback references to homework_tasks. The rebuild inserts the rows
-- under the final table name, which clears the deferred foreign key violations from the drop.
-- https://developers.cloudflare.com/d1/sql-api/foreign-keys/#defer-foreign-key-constraints
PRAGMA defer_foreign_keys = true;
ALTER TABLE homework RENAME TO homework_tasks;
CREATE TABLE homework (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, instructions TEXT NOT NULL, due_date TEXT,
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO homework SELECT t.id,p.title,t.instructions,t.due_date,1,t.created_at,t.updated_at FROM homework_tasks t JOIN problems p ON p.id=t.problem_id;
CREATE TABLE tasks_copy AS SELECT id,problem_id,state,current_submission_id,version,created_at,updated_at FROM homework_tasks;
DROP TABLE homework_tasks;
CREATE TABLE homework_tasks (
  id TEXT PRIMARY KEY, homework_id TEXT NOT NULL REFERENCES homework(id), problem_id TEXT NOT NULL REFERENCES problems(id),
  state TEXT NOT NULL CHECK (state IN ('assigned','in_progress','submitted','changes_requested','completed','cancelled')),
  current_submission_id TEXT REFERENCES submissions(id),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO homework_tasks SELECT id,id,problem_id,state,current_submission_id,version,created_at,updated_at FROM tasks_copy;
DROP TABLE tasks_copy;
CREATE UNIQUE INDEX one_active_task ON homework_tasks(problem_id) WHERE state IN ('assigned','in_progress','submitted','changes_requested');
CREATE INDEX homework_tasks_homework ON homework_tasks(homework_id);
ALTER TABLE submissions RENAME COLUMN homework_id TO task_id;
ALTER TABLE submissions RENAME COLUMN homework_version TO task_version;
ALTER TABLE feedback RENAME COLUMN homework_id TO task_id;
CREATE TABLE lessons_new (
  homework_id TEXT NOT NULL REFERENCES homework(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id), PRIMARY KEY(homework_id, lesson_id)
);
INSERT INTO lessons_new SELECT homework_id,lesson_id FROM homework_lessons;
DROP TABLE homework_lessons;
ALTER TABLE lessons_new RENAME TO homework_lessons;
CREATE TABLE discussion_reads (
  role TEXT NOT NULL CHECK (role IN ('parent','student')), problem_id TEXT NOT NULL REFERENCES problems(id),
  read_at TEXT NOT NULL, PRIMARY KEY(role, problem_id)
);
