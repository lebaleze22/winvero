CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE players ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE UNIQUE INDEX idx_players_user_id ON players(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_sessions_user_active ON sessions(user_id,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE login_attempts (
  attempt_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT
);

ALTER TABLE game_rounds ADD COLUMN request_hash TEXT;

ALTER TABLE ledger_entries RENAME TO ledger_entries_legacy;
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  round_id TEXT REFERENCES game_rounds(id),
  type TEXT NOT NULL CHECK(type IN ('stake','payout','initial_credit','test_deposit','test_withdrawal','bonus','adjustment')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents != 0),
  balance_after_cents INTEGER NOT NULL CHECK(balance_after_cents >= 0),
  operation_key TEXT,
  payload_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
INSERT INTO ledger_entries(id,player_id,round_id,type,amount_cents,balance_after_cents,created_at)
SELECT id,player_id,round_id,type,amount_cents,balance_after_cents,created_at FROM ledger_entries_legacy;
DROP TABLE ledger_entries_legacy;
CREATE INDEX idx_ledger_player_created ON ledger_entries(player_id,created_at DESC);
CREATE UNIQUE INDEX idx_ledger_operation ON ledger_entries(player_id,type,operation_key) WHERE operation_key IS NOT NULL;
