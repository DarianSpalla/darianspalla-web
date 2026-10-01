CREATE TABLE IF NOT EXISTS portal_accounts (
 email TEXT PRIMARY KEY,
 password_hash TEXT,
 role TEXT NOT NULL CHECK(role IN ('admin','vendedor')),
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portal_records (
 kind TEXT NOT NULL,
 owner TEXT NOT NULL DEFAULT '',
 data TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(kind,owner)
);
CREATE TABLE IF NOT EXISTS portal_sessions (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL REFERENCES portal_accounts(email) ON DELETE CASCADE,
 csrf TEXT NOT NULL,
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_activation (
 token_hash TEXT PRIMARY KEY,
 email TEXT NOT NULL REFERENCES portal_accounts(email) ON DELETE CASCADE,
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_limits (
 bucket TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 started INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_assert (
 ok INTEGER NOT NULL CONSTRAINT portal_conflict CHECK(ok=1)
);
CREATE TABLE IF NOT EXISTS portal_contacts (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 interest TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 handled INTEGER NOT NULL DEFAULT 0
);
