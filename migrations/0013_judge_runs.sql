-- The seed of each "Отправить". The judge accepts a seed once, so the answer that a wrong verdict shows is for a test that does not come back.
CREATE TABLE judge_runs (
  problem_id TEXT NOT NULL REFERENCES problems(id), seed INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (problem_id, seed)
);
