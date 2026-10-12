-- "Сила Бомжа": the student moves the due date of a homework by one day. The primary key allows one postponement for each homework.
CREATE TABLE postponements (
  homework_id TEXT PRIMARY KEY REFERENCES homework(id), from_date TEXT NOT NULL, to_date TEXT NOT NULL, created_at TEXT NOT NULL
);
