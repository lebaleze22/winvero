import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyMigrations } from './migration-runner.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.WINVERO_DATABASE_PATH || resolve(here,'data','winvero.sqlite')
mkdirSync(dirname(databasePath),{recursive:true})

export const db = new DatabaseSync(databasePath)
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
applyMigrations(db)

export const statements = {
  userByEmail:db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE'),
  userById:db.prepare('SELECT id,email,username,first_name,last_name,country,phone,created_at FROM users WHERE id=?'),
  insertUser:db.prepare('INSERT INTO users(id,email,username,password_hash,first_name,last_name,country,phone,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'),
  insertPlayer:db.prepare('INSERT INTO players(id,balance_cents,created_at,updated_at,user_id) VALUES(?,?,?,?,?)'),
  playerById:db.prepare('SELECT * FROM players WHERE id=?'),
  playerByUser:db.prepare('SELECT * FROM players WHERE user_id=?'),
  updateBalance:db.prepare('UPDATE players SET balance_cents=?,updated_at=? WHERE id=?'),
  insertSession:db.prepare('INSERT INTO sessions(id,user_id,token_hash,csrf_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?,?)'),
  sessionByToken:db.prepare(`SELECT s.id AS session_id,s.user_id,s.csrf_hash,s.expires_at,s.revoked_at,
    u.email,u.username,u.first_name,u.last_name,u.country,u.phone,u.created_at AS user_created_at,
    p.id AS player_id,p.balance_cents FROM sessions s JOIN users u ON u.id=s.user_id JOIN players p ON p.user_id=u.id
    WHERE s.token_hash=?`),
  touchSession:db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?'),
  updateSessionCsrf:db.prepare('UPDATE sessions SET csrf_hash=?,last_seen_at=? WHERE id=? AND revoked_at IS NULL'),
  revokeSession:db.prepare('UPDATE sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL'),
  revokeExpiredSessions:db.prepare('UPDATE sessions SET revoked_at=? WHERE revoked_at IS NULL AND expires_at<=?'),
  loginAttempt:db.prepare('SELECT * FROM login_attempts WHERE attempt_key=?'),
  upsertLoginAttempt:db.prepare(`INSERT INTO login_attempts(attempt_key,failures,window_started_at,blocked_until) VALUES(?,?,?,?)
    ON CONFLICT(attempt_key) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until`),
  clearLoginAttempt:db.prepare('DELETE FROM login_attempts WHERE attempt_key=?'),
  roundById:db.prepare('SELECT * FROM game_rounds WHERE id=?'),
  roundByRequest:db.prepare('SELECT * FROM game_rounds WHERE request_id=?'),
  insertRound:db.prepare('INSERT INTO game_rounds(id,request_id,player_id,game_id,status,stake_cents,payout_cents,multiplier,options_json,state_json,result_json,created_at,settled_at,request_hash,server_seed,server_seed_hash,client_seed,nonce,random_cursor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
  settleRound:db.prepare("UPDATE game_rounds SET status='settled',payout_cents=?,multiplier=?,state_json=?,result_json=?,settled_at=? WHERE id=? AND status='active'"),
  updateRoundState:db.prepare("UPDATE game_rounds SET state_json=? WHERE id=? AND status='active'"),
  insertLedger:db.prepare('INSERT INTO ledger_entries(id,player_id,round_id,type,amount_cents,balance_after_cents,operation_key,payload_hash,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)'),
  ledgerByOperation:db.prepare('SELECT * FROM ledger_entries WHERE player_id=? AND type=? AND operation_key=?'),
  ledgerSum:db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS total FROM ledger_entries WHERE player_id=?'),
  recentLedger:db.prepare(`SELECT l.*,r.game_id FROM ledger_entries l LEFT JOIN game_rounds r ON r.id=l.round_id
    WHERE l.player_id=? ORDER BY l.created_at DESC,l.id DESC LIMIT ?`),
  allBalanceMismatches:db.prepare(`SELECT p.id,p.balance_cents,COALESCE(SUM(l.amount_cents),0) AS ledger_cents
    FROM players p LEFT JOIN ledger_entries l ON l.player_id=p.id GROUP BY p.id HAVING p.balance_cents!=ledger_cents`),
  nonceByGame:db.prepare('SELECT next_nonce FROM player_game_nonces WHERE player_id=? AND game_id=?'),
  setNextNonce:db.prepare(`INSERT INTO player_game_nonces(player_id,game_id,next_nonce) VALUES(?,?,?)
    ON CONFLICT(player_id,game_id) DO UPDATE SET next_nonce=excluded.next_nonce`),
}
