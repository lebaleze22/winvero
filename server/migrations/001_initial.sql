CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 20000 CHECK(balance_cents >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  player_id TEXT NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','settled')),
  stake_cents INTEGER NOT NULL CHECK(stake_cents > 0),
  payout_cents INTEGER NOT NULL DEFAULT 0 CHECK(payout_cents >= 0),
  multiplier REAL NOT NULL DEFAULT 0,
  options_json TEXT NOT NULL,
  state_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_rounds_player_created ON game_rounds(player_id,created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  round_id TEXT REFERENCES game_rounds(id),
  type TEXT NOT NULL CHECK(type IN ('stake','payout','initial_credit')),
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL CHECK(balance_after_cents >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_player_created ON ledger_entries(player_id,created_at DESC);
