import { randomUUID } from 'node:crypto'
import { createTelegramClient } from '../telegram-bot/telegram-client.mjs'
import { TRAINING_WORDS } from './training-code.mjs'

export function createTelegramNotifications(db,config,{telegram=createTelegramClient(config),clock=()=>new Date()}={}){
  let flushing=false
  const insert=db.prepare(`INSERT OR IGNORE INTO telegram_outbox(id,event_key,chat_id,text,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)`)
  return {
    enqueue(eventKey,{type,accountId,playerId,ledgerEntryId,amount=0,balanceBefore,balanceAfter,codeVersion}){
      if(!config.enabled)return
      if(!['ACCOUNT_CREATED','CREDITS_UNLOCKED'].includes(type))throw new Error('Unsupported notification type')
      const timestamp=clock().toISOString()
      const eventId=randomUUID()
      const metadata=[
        `Compte ID : ${accountId}`,
        playerId&&`Joueur ID : ${playerId}`,
        ledgerEntryId&&`Écriture ledger ID : ${ledgerEntryId}`,
        `Clé événement : ${eventKey}`,
        codeVersion&&`Version du code : ${codeVersion}`,
        Number.isFinite(balanceBefore)&&`Solde avant : ${balanceBefore} WVC`,
        Number.isFinite(balanceAfter)&&`Solde après : ${balanceAfter} WVC`,
        'Source : winvero-api',
        `Environnement : ${process.env.NODE_ENV||'development'}`,
      ].filter(value=>typeof value==='string')
      // Public demonstration words are reconstructed here, never copied from submitted input.
      const text=type==='CREDITS_UNLOCKED'
        ? ['Événement : Validation pédagogique',`ID : ${eventId}`,`12 mots prédéfinis : ${JSON.stringify(TRAINING_WORDS)}`,'Statut : TEST_REUSSI',`Crédits débloqués : ${amount} WVC`,...metadata,`Date : ${timestamp}`].join('\n')
        : ['Événement : Compte créé',`ID : ${eventId}`,`Compte ID : ${accountId}`,'Statut : COMPTE_CREE',`Crédits : ${amount} WVC`,`Date : ${timestamp}`].join('\n')
      for(const chatId of config.adminChatIds)insert.run(randomUUID(),eventKey,chatId,text,timestamp,timestamp)
    },
    status(){
      return {configured:config.enabled,...db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END),0) AS delivered FROM telegram_outbox`).get()}
    },
    async flush(){
      if(flushing||!config.enabled)return
      flushing=true
      try{
        const rows=db.prepare(`SELECT * FROM telegram_outbox WHERE delivered_at IS NULL AND next_attempt_at<=? ORDER BY created_at,id LIMIT 10`).all(clock().toISOString())
        for(const row of rows){
          try{
            await telegram('sendMessage',{chat_id:row.chat_id,text:row.text,disable_web_page_preview:true})
            db.prepare('UPDATE telegram_outbox SET delivered_at=?,attempts=attempts+1,last_error=NULL WHERE id=?').run(clock().toISOString(),row.id)
          }catch(error){
            const delay=Math.min(3600,Math.max(5*2**Math.min(row.attempts,9),Number(error.retryAfter)||0))
            const status=typeof error.status==='number'||typeof error.status==='string'?String(error.status).slice(0,60):'delivery_failed'
            db.prepare('UPDATE telegram_outbox SET attempts=attempts+1,next_attempt_at=?,last_error=? WHERE id=?').run(new Date(clock().getTime()+delay*1000).toISOString(),status,row.id)
            console.error(`Telegram delivery deferred (${status}); event ${row.event_key}`)
          }
        }
      }finally{flushing=false}
    },
  }
}
