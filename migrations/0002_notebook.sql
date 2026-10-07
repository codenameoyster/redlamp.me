CREATE TABLE problems (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, number INTEGER,
  title TEXT NOT NULL, difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  topics TEXT NOT NULL CHECK (json_valid(topics)), summary TEXT NOT NULL,
  search_text TEXT NOT NULL,
  understanding TEXT NOT NULL DEFAULT 'needs_practice' CHECK (understanding IN ('needs_practice','with_help','independent')),
  next_review_date TEXT, archived_at TEXT, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY, problem_id TEXT NOT NULL REFERENCES problems(id),
  state TEXT NOT NULL CHECK (state IN ('draft','saved')),
  document TEXT NOT NULL CHECK (json_valid(document) AND length(CAST(document AS BLOB)) <= 256000),
  search_text TEXT NOT NULL,
  acceptance TEXT NOT NULL CHECK (acceptance IN ('not_submitted','not_accepted','accepted')),
  understanding TEXT NOT NULL CHECK (understanding IN ('needs_practice','with_help','independent')),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, saved_at TEXT
);
CREATE UNIQUE INDEX one_draft_per_problem ON attempts(problem_id) WHERE state = 'draft';
CREATE INDEX attempts_problem_state ON attempts(problem_id, state, saved_at);
CREATE TABLE homework (
  id TEXT PRIMARY KEY, problem_id TEXT NOT NULL REFERENCES problems(id),
  instructions TEXT NOT NULL, due_date TEXT,
  state TEXT NOT NULL CHECK (state IN ('assigned','in_progress','submitted','changes_requested','completed','cancelled')),
  current_submission_id TEXT REFERENCES submissions(id),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_active_homework ON homework(problem_id)
  WHERE state IN ('assigned','in_progress','submitted','changes_requested');
CREATE INDEX homework_state_due ON homework(state, due_date);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY, homework_id TEXT NOT NULL REFERENCES homework(id),
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  homework_version INTEGER NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(homework_id, homework_version)
);
CREATE TABLE feedback (
  id TEXT PRIMARY KEY, problem_id TEXT NOT NULL REFERENCES problems(id),
  homework_id TEXT REFERENCES homework(id), submission_id TEXT REFERENCES submissions(id),
  author TEXT NOT NULL CHECK (author IN ('parent','student')),
  kind TEXT NOT NULL CHECK (kind IN ('reply','changes_requested','completed')),
  body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX feedback_problem ON feedback(problem_id, created_at);
CREATE TABLE lessons (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  topics TEXT NOT NULL CHECK (json_valid(topics)), filename TEXT NOT NULL,
  byte_count INTEGER NOT NULL CHECK (byte_count > 0 AND byte_count <= 1000000),
  archived_at TEXT, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE lesson_content (lesson_id TEXT PRIMARY KEY REFERENCES lessons(id), html TEXT NOT NULL);
CREATE TABLE problem_lessons (
  problem_id TEXT NOT NULL REFERENCES problems(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id), PRIMARY KEY(problem_id, lesson_id)
);
CREATE TABLE homework_lessons (
  homework_id TEXT NOT NULL REFERENCES homework(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id), PRIMARY KEY(homework_id, lesson_id)
);
CREATE TABLE reviews (
  id TEXT PRIMARY KEY, problem_id TEXT NOT NULL REFERENCES problems(id),
  result TEXT NOT NULL CHECK (result IN ('needs_practice','with_help','independent')),
  note TEXT NOT NULL, reviewed_on TEXT NOT NULL, next_review_date TEXT, created_at TEXT NOT NULL
);
CREATE INDEX reviews_problem_date ON reviews(problem_id, reviewed_on);
