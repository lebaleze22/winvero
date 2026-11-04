CREATE TABLE telegram_outbox (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  text TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  delivered_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(event_key,chat_id)
);
CREATE INDEX idx_telegram_pending ON telegram_outbox(next_attempt_at) WHERE delivered_at IS NULL;
