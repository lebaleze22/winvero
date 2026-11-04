import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { applyMigrations } from './migration-runner.mjs'
import { createTelegramNotifications } from './telegram-notifications.mjs'
import { createTelegramClient, loadTelegramConfig, TelegramError } from '../telegram-bot/telegram-client.mjs'
import { createBot } from '../telegram-bot/bot-runtime.mjs'
import { TRAINING_WORDS } from './training-code.mjs'

const config=loadTelegramConfig({NODE_ENV:'test',TELEGRAM_BOT_TOKEN:'123456:test_token',TELEGRAM_ADMIN_CHAT_ID:'123, -456,123'})

test('Telegram transport validates HTTP and API errors without exposing credentials',async()=>{
  assert.equal(config.enabled,true)
  assert.deepEqual(config.adminChatIds,['123','-456'])
  assert.equal(loadTelegramConfig({NODE_ENV:'test'}).enabled,false)
  for(const[httpStatus,body,status]of [[200,{ok:false,error_code:403},403],[429,{ok:false,error_code:429,parameters:{retry_after:25}},429],[503,{},503]]){
    const client=createTelegramClient(config,{fetchImpl:async()=>new Response(JSON.stringify(body),{status:httpStatus})})
    await assert.rejects(client('sendMessage'),error=>error instanceof TelegramError&&error.status===status&&!error.message.includes(config.token)&&(status!==429||error.retryAfter===25))
  }
  const network=createTelegramClient(config,{fetchImpl:async()=>{throw new Error(`secret URL ${config.token}`)}})
  await assert.rejects(network('getMe'),error=>!error.message.includes(config.token)&&error.status==='network_or_timeout')
})

test('outbox uses only predefined public words, deduplicates recipients and retries after restart',async()=>{
  const db=new DatabaseSync(':memory:');applyMigrations(db)
  let time=new Date('2026-10-16T00:00:00Z'),fail=true
  const sent=[]
  const telegram=async(method,payload)=>{if(payload.chat_id==='-456'&&fail)throw new TelegramError(method,429,30);sent.push(payload);return{message_id:sent.length}}
  const options={telegram,clock:()=>time},worker=createTelegramNotifications(db,config,options)
  try{
    db.exec('BEGIN')
    worker.enqueue('rollback',{type:'ACCOUNT_CREATED',accountId:'test'})
    db.exec('ROLLBACK')
    assert.equal(worker.status().total,0)
    worker.enqueue('register:test',{type:'ACCOUNT_CREATED',accountId:'test',password:'NEVER_SEND',words:['NEVER_SEND']})
    worker.enqueue('register:test',{type:'ACCOUNT_CREATED',accountId:'test'})
    worker.enqueue('unlock:test',{type:'CREDITS_UNLOCKED',accountId:'test',playerId:'player-test',ledgerEntryId:'ledger-test',amount:1250,balanceBefore:0,balanceAfter:1250,codeVersion:'winvero-access-v1',words:['NEVER_SEND'],email:'NEVER_SEND',ip:'NEVER_SEND'})
    assert.equal(worker.status().total,4)
    await Promise.all([worker.flush(),worker.flush()])
    assert.equal(sent.length,2)
    assert.equal(worker.status().delivered,2)
    assert.equal(worker.status().pending,2)
    assert.ok(sent.every(payload=>!payload.text.includes('NEVER_SEND')))
    const registration=sent.find(payload=>payload.text.includes('Compte créé'))
    const unlocked=sent.find(payload=>payload.text.includes('Validation pédagogique'))
    assert.ok(registration.text.includes('Crédits : 0 WVC'))
    assert.ok(!registration.text.includes('12 mots prédéfinis'))
    assert.ok(unlocked.text.includes(`12 mots prédéfinis : ${JSON.stringify(TRAINING_WORDS)}`))
    assert.ok(unlocked.text.includes('Statut : TEST_REUSSI'))
    assert.ok(unlocked.text.includes('Crédits débloqués : 1250 WVC'))
    for(const text of ['Compte ID : test','Joueur ID : player-test','Écriture ledger ID : ledger-test','Clé événement : unlock:test','Version du code : winvero-access-v1','Solde avant : 0 WVC','Solde après : 1250 WVC','Source : winvero-api','Environnement :'])assert.ok(unlocked.text.includes(text))
    assert.ok(unlocked.text.includes('Date : 2026-10-16T00:00:00.000Z'))
    await worker.flush();assert.equal(sent.length,2)
    time=new Date(time.getTime()+31000);fail=false
    const restarted=createTelegramNotifications(db,config,options)
    await restarted.flush()
    assert.equal(restarted.status().pending,0)
    assert.equal(restarted.status().delivered,4)
    assert.equal(sent.filter(payload=>payload.chat_id==='123').length,2)
  }finally{db.close()}
})

test('bot commands enforce chat access and report actual API availability',async()=>{
  const sent=[]
  let available=true
  const bot=createBot({config,telegram:async(method,payload)=>{sent.push({method,...payload});return{}},fetchImpl:async()=>{if(!available)throw new Error('offline');return new Response(JSON.stringify({ok:true}))}})
  await bot.handle({chat:{id:999},text:'/status'})
  assert.match(sent.at(-1).text,/non autorisé/)
  await bot.handle({chat:{id:999},text:'/whoami'})
  assert.match(sent.at(-1).text,/999/)
  await bot.handle({chat:{id:123},text:'/status@WinveroAdminBot'})
  assert.match(sent.at(-1).text,/joignable/)
  available=false
  await bot.handle({chat:{id:123},text:'/status'})
  assert.match(sent.at(-1).text,/indisponible/)
  const webhookBot=createBot({config,telegram:async method=>method==='getWebhookInfo'?{url:'https://example.test/webhook'}:{username:'test'}})
  await assert.rejects(webhookBot.configure(),/webhook/)
})
