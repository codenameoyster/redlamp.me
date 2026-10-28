-- Game reads and edits record existing awards. The level badge follows the current XP.
CREATE TABLE earned_badges (id TEXT PRIMARY KEY CHECK (id <> 'level-five'));
