-- The test runs of the student. The latest run of an approach gives the "Тесты пройдены" mark. All runs give the test XP of /game.
-- code_hash is the SHA-256 (hex) of the code of the run. run_on is the local date of the student.
CREATE TABLE test_runs (
  id TEXT PRIMARY KEY, problem_id TEXT NOT NULL REFERENCES problems(id), attempt_id TEXT NOT NULL REFERENCES attempts(id),
  approach_id TEXT NOT NULL, code_hash TEXT NOT NULL, passed INTEGER NOT NULL, total INTEGER NOT NULL,
  run_on TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX test_runs_problem ON test_runs(problem_id, run_on);
