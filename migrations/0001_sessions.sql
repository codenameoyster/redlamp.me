CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
  credential_fingerprint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
