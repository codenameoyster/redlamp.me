-- The own tests of a problem. Both roles add them. The runner runs them after the standard tests.
CREATE TABLE problem_tests (
  id TEXT PRIMARY KEY, problem_id TEXT NOT NULL REFERENCES problems(id),
  input TEXT NOT NULL, expected TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX problem_tests_problem ON problem_tests(problem_id, created_at);
