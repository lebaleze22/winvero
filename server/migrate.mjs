import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { applyMigrations } from './migration-runner.mjs'

const here=dirname(fileURLToPath(import.meta.url))
const databasePath=process.env.WINVERO_DATABASE_PATH||resolve(here,'data','winvero.sqlite')

if(existsSync(databasePath)){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')
  const backupDirectory=resolve(here,'backups',`migration-${stamp}`)
  mkdirSync(backupDirectory,{recursive:true})
  for(const suffix of ['','-wal','-shm']){
    const source=`${databasePath}${suffix}`
    if(existsSync(source))copyFileSync(source,resolve(backupDirectory,basename(source)))
  }
  console.log(`Sauvegarde créée : ${backupDirectory}`)
}

mkdirSync(dirname(databasePath),{recursive:true})
const db=new DatabaseSync(databasePath)
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;')
const applied=applyMigrations(db)
const integrity=db.prepare(`SELECT COUNT(*) AS mismatches FROM players p
  WHERE p.balance_cents != COALESCE((SELECT SUM(l.amount_cents) FROM ledger_entries l WHERE l.player_id=p.id),0)`).get()
db.close()
if(integrity.mismatches)throw new Error(`${integrity.mismatches} solde(s) ne concordent pas avec le ledger`)
console.log(applied.length?`Migrations appliquées : ${applied.join(', ')}`:'Schéma déjà à jour.')
console.log('Invariant solde/ledger vérifié.')
