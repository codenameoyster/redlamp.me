-- Quiz answers. A card is repository content (src/leetcode/sets/*/cards.ts), so card_id has no foreign key.
-- The newest row per card is the schedule. interval_days is the interval that produced next_date.
-- One row per card per day: a repeated answer on the same day is a no-op.
CREATE TABLE card_answers (
  id TEXT PRIMARY KEY, card_id TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0,1)),
  interval_days INTEGER NOT NULL CHECK (interval_days IN (1,3,7,14,30)),
  answered_on TEXT NOT NULL, next_date TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE (card_id, answered_on)
);
