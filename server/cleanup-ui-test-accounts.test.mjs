import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyMigrations } from './migration-runner.mjs'
import { cleanupUiTestAccounts } from './cleanup-ui-test-accounts.mjs'

test('dev cleanup backs up exact test accounts and preserves nonmatches and ledger',()=>{
  const directory=mkdtempSync(join(tmpdir(),'winvero-ui-cleanup-')),path=join(directory,'test.sqlite')
  let db=new DatabaseSync(path)
  try{
    applyMigrations(db)
    const timestamp=new Date().toISOString()
    const accounts=[['ui.test.123@example.com','uitest123'],['cov.123@example.com','cov123'],['base.123@example.com','base123'],['ui.test.123@other.test','uitestOther'],['real@example.com','real'],['cov.456@example.com','realOther'],['cov@example.com','covNoDot']]
    for(const[index,[email,username]]of accounts.entries()){
      const id=String(index)
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,email,username,'unused-test-hash','Test','User','France','0600000000',timestamp,timestamp)
      db.prepare('INSERT INTO players(id,balance_cents,created_at,updated_at,user_id) VALUES(?,?,?,?,?)').run(id,125000,timestamp,timestamp,id)
      db.prepare(`INSERT INTO ledger_entries(id,player_id,type,amount_cents,balance_after_cents,metadata_json,created_at) VALUES(?,?,'bonus',125000,125000,'{}',?)`).run(id,id,timestamp)
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,NULL)').run(id,id,`token-${id}`,`csrf-${id}`,timestamp,timestamp,timestamp)
    }
    db.close();db=null
    assert.equal(cleanupUiTestAccounts(path).matchedAccounts,3)
    const result=cleanupUiTestAccounts(path,{apply:true,backupDirectory:join(directory,'backups')})
    assert.equal(result.deletedAccounts,3)
    assert.equal(result.deletedLedgerEntries,3)
    assert.equal(result.deletedSessions,3)
    assert.equal(result.unaffectedAccountsPreserved,true)
    const backup=new DatabaseSync(result.backupPath,{readOnly:true})
    try{assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM users').get().n,7)}finally{backup.close()}
    db=new DatabaseSync(path)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,4)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger_entries').get().n,4)
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0)
    db.close();db=null
    assert.equal(cleanupUiTestAccounts(path,{apply:true}).matchedAccounts,0)
  }finally{db?.close();rmSync(directory,{recursive:true,force:true})}
})
