-- One quiz attempt answers all cards of one deck. The deck is repository content, so it has no foreign key.
CREATE TABLE quiz_attempts (
  id TEXT PRIMARY KEY, deck TEXT NOT NULL,
  correct INTEGER NOT NULL, total INTEGER NOT NULL CHECK (total > 0 AND correct BETWEEN 0 AND total),
  passed INTEGER NOT NULL CHECK (passed IN (0,1)), created_at TEXT NOT NULL
);
