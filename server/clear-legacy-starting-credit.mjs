import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const path=process.env.WINVERO_DATABASE_PATH||resolve(import.meta.dirname,'data','winvero.sqlite')
const db=new DatabaseSync(path)
try{
  const candidates=db.prepare(`SELECT p.id,p.balance_cents,l.id AS credit_id,l.amount_cents
    FROM players p JOIN ledger_entries l ON l.player_id=p.id
    WHERE p.user_id IS NOT NULL AND l.type='initial_credit' AND l.amount_cents=20000
    AND NOT EXISTS (SELECT 1 FROM ledger_entries a WHERE a.player_id=p.id
      AND a.type='adjustment' AND a.operation_key='remove-legacy-starting-credit:'||l.id)` ).all()
  console.log(JSON.stringify({eligibleAccounts:candidates.length,balances:candidates.map(row=>row.balance_cents/100)}))
  if(process.argv.includes('--apply')&&candidates.length){
    const backupPath=resolve(import.meta.dirname,'backups',`before-clear-starting-credit-${Date.now()}.sqlite`)
    mkdirSync(dirname(backupPath),{recursive:true})
    db.exec(`VACUUM INTO '${backupPath.replaceAll("'","''")}'`)
    let cleared=0
    db.exec('BEGIN IMMEDIATE')
    try{
      for(const row of candidates){
        const current=db.prepare('SELECT balance_cents FROM players WHERE id=?').get(row.id).balance_cents
        const amount=Math.min(current,row.amount_cents)
        if(!amount)continue
        const next=current-amount,timestamp=new Date().toISOString()
        db.prepare('UPDATE players SET balance_cents=?,updated_at=? WHERE id=?').run(next,timestamp,row.id)
        db.prepare(`INSERT INTO ledger_entries(id,player_id,round_id,type,amount_cents,balance_after_cents,operation_key,payload_hash,metadata_json,created_at)
          VALUES(?,?,NULL,'adjustment',?,?,?,NULL,?,?)`).run(randomUUID(),row.id,-amount,next,`remove-legacy-starting-credit:${row.credit_id}`,JSON.stringify({reason:'Remove obsolete automatic 200 WVC starting credit',originalEntryId:row.credit_id}),timestamp)
        cleared++
      }
      const mismatches=db.prepare(`SELECT COUNT(*) AS n FROM players p WHERE p.balance_cents !=
        COALESCE((SELECT SUM(amount_cents) FROM ledger_entries l WHERE l.player_id=p.id),0)`).get().n
      if(mismatches)throw new Error('Ledger balance mismatch')
      db.exec('COMMIT')
      console.log(JSON.stringify({clearedAccounts:cleared,ledgerMismatches:mismatches,backupPath}))
    }catch(error){db.exec('ROLLBACK');throw error}
  }
}finally{db.close()}
