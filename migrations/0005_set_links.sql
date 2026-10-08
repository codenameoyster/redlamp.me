-- Links from problems and homework to learning sets. A set is repository content, so set_slug has no foreign key.
CREATE TABLE problem_sets (
  problem_id TEXT NOT NULL REFERENCES problems(id), set_slug TEXT NOT NULL, PRIMARY KEY(problem_id, set_slug)
);
CREATE TABLE homework_sets (
  homework_id TEXT NOT NULL REFERENCES homework(id), set_slug TEXT NOT NULL, PRIMARY KEY(homework_id, set_slug)
);
