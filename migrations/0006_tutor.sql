-- AI tutor chat. A thread is one context: a problem, a learning set or a lesson.
-- context_ref is a problem ID, a set slug or a lesson ID. A set is repository content, so the column has no foreign key.
CREATE TABLE tutor_messages (
  id TEXT PRIMARY KEY,
  context_kind TEXT NOT NULL CHECK (context_kind IN ('problem','set','lesson')),
  context_ref TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('student','assistant')),
  body TEXT NOT NULL, quote TEXT, created_at TEXT NOT NULL
);
CREATE INDEX tutor_messages_thread ON tutor_messages(context_kind, context_ref, created_at);
-- The one ChatGPT connection. access_token and refresh_token are AES-GCM ciphertext. The key is the TUTOR_TOKEN_KEY secret.
-- host_id and client_id stay after a disconnect: the next sign-in reuses them. models is a JSON array of {slug, name}.
CREATE TABLE tutor_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host_id TEXT NOT NULL, client_id TEXT, model TEXT, models TEXT,
  access_token TEXT, refresh_token TEXT, expires_at INTEGER, refresh_after INTEGER, refreshing_until INTEGER,
  pending_state TEXT, pending_verifier TEXT, pending_expires_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1, connected_at TEXT, updated_at TEXT NOT NULL
);
