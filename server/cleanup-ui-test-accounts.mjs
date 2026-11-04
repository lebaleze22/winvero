import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function cleanupUiTestAccounts(databasePath,{apply=false,backupDirectory=resolve(import.meta.dirname,'backups')}={}){
  if(process.env.NODE_ENV==='production')throw new Error('Development cleanup is forbidden in production')
  const db=new DatabaseSync(databasePath,{readOnly:!apply})
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
  try{
    const candidates=db.prepare('SELECT id,email,username FROM users ORDER BY id').all().filter(user=>
      /^(?:ui\.test\..+|cov\..+|base\..+)@example\.com$/i.test(user.email)&&
      /^(?:uitest|cov|base)/i.test(user.username))
    const summary={matchedAccounts:candidates.length,accounts:candidates.map(({email,username})=>({email,username}))}
    if(!apply||!candidates.length)return summary
    const backupPath=resolve(backupDirectory,`before-ui-test-cleanup-${Date.now()}.sqlite`)
    mkdirSync(dirname(backupPath),{recursive:true})
    db.exec(`VACUUM INTO '${backupPath.replaceAll("'","''")}'`)
    const backup=new DatabaseSync(backupPath,{readOnly:true})
    try{
      if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup integrity check failed')
    }finally{backup.close()}
    db.exec('BEGIN IMMEDIATE')
    try{
      // Retain a complete snapshot of every non-target user and player.
      const ids=new Set(candidates.map(user=>user.id))
      const unaffected=()=>JSON.stringify({
        users:db.prepare('SELECT * FROM users ORDER BY id').all().filter(user=>!ids.has(user.id)),
        players:db.prepare('SELECT * FROM players ORDER BY id').all().filter(player=>!ids.has(player.user_id)),
      })
      const before=unaffected()
      let deletedLedgerEntries=0,deletedRounds=0,deletedPlayers=0,deletedSessions=0
      for(const user of candidates){
        for(const player of db.prepare('SELECT id FROM players WHERE user_id=?').all(user.id)){
          // Only disposable test-account data is deleted. The full history is in the backup.
          deletedLedgerEntries+=Number(db.prepare('DELETE FROM ledger_entries WHERE player_id=?').run(player.id).changes)
          deletedRounds+=Number(db.prepare('DELETE FROM game_rounds WHERE player_id=?').run(player.id).changes)
          db.prepare('DELETE FROM player_game_nonces WHERE player_id=?').run(player.id)
          deletedPlayers+=Number(db.prepare('DELETE FROM players WHERE id=?').run(player.id).changes)
        }
        deletedSessions+=Number(db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id).changes)
        db.prepare('DELETE FROM users WHERE id=?').run(user.id)
      }
      if(unaffected()!==before)throw new Error('Non-target account data changed')
      if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Foreign key check failed')
      const mismatches=db.prepare(`SELECT COUNT(*) AS n FROM players p WHERE p.balance_cents != COALESCE((SELECT SUM(amount_cents) FROM ledger_entries l WHERE l.player_id=p.id),0)`).get().n
      if(mismatches)throw new Error('Ledger invariant failed')
      db.exec('COMMIT')
      return {...summary,deletedAccounts:candidates.length,deletedPlayers,deletedSessions,deletedRounds,deletedLedgerEntries,backupPath,ledgerMismatches:mismatches,unaffectedAccountsPreserved:true}
    }catch(error){db.exec('ROLLBACK');throw error}
  }finally{db.close()}
}

if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  const path=process.env.WINVERO_DATABASE_PATH||resolve(import.meta.dirname,'data','winvero.sqlite')
  console.log(JSON.stringify(cleanupUiTestAccounts(path,{apply:process.argv.includes('--apply')}),null,2))
}
