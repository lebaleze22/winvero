ALTER TABLE game_rounds ADD COLUMN server_seed TEXT;
ALTER TABLE game_rounds ADD COLUMN server_seed_hash TEXT;
ALTER TABLE game_rounds ADD COLUMN client_seed TEXT;
ALTER TABLE game_rounds ADD COLUMN nonce INTEGER;
ALTER TABLE game_rounds ADD COLUMN random_cursor INTEGER NOT NULL DEFAULT 0;

CREATE TABLE player_game_nonces (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  next_nonce INTEGER NOT NULL DEFAULT 0 CHECK(next_nonce >= 0),
  PRIMARY KEY(player_id, game_id)
);

CREATE UNIQUE INDEX idx_rounds_player_game_nonce
  ON game_rounds(player_id, game_id, nonce)
  WHERE nonce IS NOT NULL;
