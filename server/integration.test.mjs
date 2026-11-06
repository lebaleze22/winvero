import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { applyMigrations } from './migration-runner.mjs'

const serverDirectory=resolve(import.meta.dirname)
const wait=delay=>new Promise(resolvePromise=>setTimeout(resolvePromise,delay))

async function startServer({ttl=3600,telegram=false,legacyActivation=true}={}){
  const directory=mkdtempSync(join(tmpdir(),'winvero-auth-')),databasePath=join(directory,'test.sqlite')
  const port=34000+Math.floor(Math.random()*2000)
  const args=telegram?['--import','./test-fixtures/telegram-transport.mjs','secure-server.mjs']:['secure-server.mjs']
  const child=spawn(process.execPath,args,{cwd:serverDirectory,env:{...process.env,NODE_ENV:'test',WINVERO_LEGACY_ACTIVATION_FIXTURE:String(legacyActivation),GAME_SERVER_PORT:String(port),WINVERO_DATABASE_PATH:databasePath,WINVERO_SESSION_TTL_SECONDS:String(ttl),WINVERO_INITIAL_CREDIT_CENTS:'20000',WINVERO_TEST_CREDITS_ENABLED:'true',TELEGRAM_BOT_TOKEN:telegram?'123456:test_token':'',TELEGRAM_ADMIN_CHAT_ID:telegram?'123,-456':''},stdio:['ignore','pipe','pipe']})
  await new Promise((resolvePromise,reject)=>{const timer=setTimeout(()=>reject(new Error('Démarrage serveur expiré')),15000);child.stdout.on('data',chunk=>{if(String(chunk).includes('API sécurisée')){clearTimeout(timer);resolvePromise()}});child.once('exit',code=>reject(new Error(`Serveur arrêté (${code})`)))})
  return{base:`http://127.0.0.1:${port}`,databasePath,stop:async()=>{child.kill();await new Promise(resolvePromise=>child.once('exit',resolvePromise));rmSync(directory,{recursive:true,force:true})}}
}

function client(base){
  let cookie='',csrfToken=''
  const call=async(path,{method='GET',body,headers={}}={})=>{
    const response=await fetch(`${base}${path}`,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers},body:body?JSON.stringify(body):undefined})
    const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0]
    const payload=await response.json().catch(()=>({}));if(payload.csrfToken)csrfToken=payload.csrfToken
    return{status:response.status,body:payload}
  }
  return{call,get cookie(){return cookie},get csrf(){return csrfToken}}
}

const profile=(suffix='a')=>({email:`joueur-${suffix}@example.test`,username:`joueur_${suffix}`,firstName:'Alex',lastName:'Martin',country:'France',phone:'+33 6 12 34 56 78',password:'MotDePasse!2026'})
const accessWords=['winvero','orbite','velours','neon','tempo','quartz','vertigo','comete','prisme','pulse','nova','finale']
const activate=player=>player.call('/api/credits/unlock',{method:'POST',headers:{'x-csrf-token':player.csrf},body:{words:accessWords}})

test('Winvero code enrollment persists a verifier and never grants credits',async()=>{
 const server=await startServer({legacyActivation:false}),alice=client(server.base),anonymous=client(server.base);
 const database=new DatabaseSync(server.databasePath,{readOnly:true});
 try{
  assert.equal((await anonymous.call('/api/credits/code-submission')).status,401);
  await alice.call('/api/auth/register',{method:'POST',body:profile('enrollment')});
  const submit=words=>alice.call('/api/credits/code-submission',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{words}});
  assert.equal((await alice.call('/api/credits/code-submission',{method:'POST',body:{words:accessWords}})).status,403);
  assert.equal((await submit(['invalid'])).status,400);
  const results=await Promise.all([submit(accessWords),submit(accessWords)]);
  assert.ok(results.every(r=>r.status===200&&r.body.submission.status==='pending_review'));
  assert.equal(results[0].body.submission.id,results[1].body.submission.id);
  const rows=database.prepare('SELECT * FROM winvero_code_submissions').all();
  assert.equal(rows.length,1);assert.ok(rows[0].verifier.startsWith('$argon2id$'));
  assert.ok(!JSON.stringify(rows).includes(accessWords.join(' ')));
  assert.ok(!JSON.stringify(results).includes(rows[0].verifier));
  assert.equal((await alice.call('/api/credits/code-submission')).body.submission.id,rows[0].id);
  const overview=(await alice.call('/api/credits/overview')).body;
  assert.equal(overview.balance,0);assert.equal(overview.accessUnlocked,false);
 }finally{database.close();await server.stop()}
});

test('Winvero code submission notifies Telegram admins once without exposing words in the response',async()=>{
 const server=await startServer({telegram:true,legacyActivation:false}),alice=client(server.base)
 const database=new DatabaseSync(server.databasePath,{readOnly:true})
 try{
  await alice.call('/api/auth/register',{method:'POST',body:profile('code-telegram')})
  const submit=words=>alice.call('/api/credits/code-submission',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{words}})
  assert.equal((await submit(['invalid'])).status,400)
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM telegram_outbox WHERE event_key LIKE 'code-submission:%'").get().n,0)
  const first=await submit(accessWords)
  assert.equal(first.status,200)
  assert.equal(first.body.submission.status,'pending_review')
  assert.ok(!JSON.stringify(first.body).includes(accessWords.join(' ')))
  for(let index=0;index<50;index++){
   if(database.prepare("SELECT COUNT(*) AS n FROM telegram_outbox WHERE event_key LIKE 'code-submission:%' AND delivered_at IS NOT NULL").get().n===2)break
   await wait(20)
  }
  const rows=database.prepare("SELECT * FROM telegram_outbox WHERE event_key LIKE 'code-submission:%'").all()
  assert.equal(rows.length,2)
  assert.ok(rows.every(row=>row.delivered_at&&!row.text.includes(accessWords[0])))
  assert.equal((await submit(accessWords)).body.submission.id,first.body.submission.id)
  assert.equal((await submit([...accessWords].reverse())).body.submission.id,first.body.submission.id)
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM telegram_outbox WHERE event_key LIKE 'code-submission:%'").get().n,2)
 }finally{database.close();await server.stop()}
});

test('registration and credit unlock trigger private, once-per-event Telegram notifications',async()=>{
  const server=await startServer({telegram:true}),alice=client(server.base)
  const database=new DatabaseSync(server.databasePath,{readOnly:true})
  try{
    const registration=await alice.call('/api/auth/register',{method:'POST',body:profile('telegram')})
    assert.equal(registration.status,201);assert.equal(registration.body.balance,0)
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM telegram_outbox').get().n,2)
    assert.equal((await alice.call('/api/credits/unlock',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{words:[...accessWords].reverse()}})).status,400)
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM telegram_outbox').get().n,2)
    assert.equal((await activate(alice)).body.balance,1250)
    assert.equal((await activate(alice)).body.balance,1250)
    for(let index=0;index<50;index++){
      if(database.prepare('SELECT COUNT(*) AS n FROM telegram_outbox WHERE delivered_at IS NOT NULL').get().n===4)break
      await wait(20)
    }
    const notifications=database.prepare('SELECT * FROM telegram_outbox').all()
    assert.equal(notifications.length,4)
    assert.ok(notifications.every(row=>row.delivered_at&&row.attempts===1))
    assert.ok(notifications.every(row=>!row.text.includes(profile('telegram').password)&&!row.text.includes(profile('telegram').email)&&!row.text.includes(alice.csrf)))
    const unlockNotifications=notifications.filter(row=>row.event_key.startsWith('unlock:'))
    assert.equal(unlockNotifications.length,2)
    assert.ok(unlockNotifications.every(row=>row.text.includes(`12 mots prédéfinis : ${JSON.stringify(accessWords)}`)&&row.text.includes('Statut : TEST_REUSSI')))
    const ledger=database.prepare("SELECT * FROM ledger_entries WHERE type='bonus'").get()
    assert.ok(unlockNotifications.every(row=>row.text.includes(`Compte ID : ${registration.body.account.id}`)&&row.text.includes(`Joueur ID : ${ledger.player_id}`)&&row.text.includes(`Écriture ledger ID : ${ledger.id}`)&&row.text.includes('Solde avant : 0 WVC')&&row.text.includes('Solde après : 1250 WVC')&&row.text.includes('Version du code : winvero-access-v1')))
    assert.ok(notifications.filter(row=>row.event_key.startsWith('registration:')).every(row=>!row.text.includes('12 mots prédéfinis')))
    assert.equal((await alice.call('/api/auth/register',{method:'POST',body:profile('telegram')})).status,409)
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM telegram_outbox').get().n,4)
    assert.equal((await alice.call('/api/wallet-submitted',{method:'POST',body:{words:accessWords}})).status,410)
  }finally{database.close();await server.stop()}
})

test('code pédagogique : validation, bonus unique et état persistant',async()=>{
  const server=await startServer(),alice=client(server.base),anonymous=client(server.base)
  const words=['winvero','orbite','velours','neon','tempo','quartz','vertigo','comete','prisme','pulse','nova','finale']
  try{
    assert.equal((await anonymous.call('/api/credits/unlock',{method:'POST',body:{words}})).status,401)
    const registration=await alice.call('/api/auth/register',{method:'POST',body:profile('access')})
    assert.equal(registration.body.balance,0)
    const relogin=await alice.call('/api/auth/login',{method:'POST',body:{email:profile('access').email,password:profile('access').password}})
    assert.equal(relogin.body.balance,0)
    assert.equal((await alice.call('/api/game-rounds',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{requestId:randomUUID(),gameId:'dice',stake:1}})).status,403)
    assert.equal((await alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{requestId:randomUUID(),kind:'deposit',asset:'EUR',amount:'100'}})).status,403)
    const submit=words=>alice.call('/api/credits/unlock',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{words}})
    assert.equal((await alice.call('/api/credits/overview')).body.accessUnlocked,false)
    assert.equal((await alice.call('/api/credits/unlock',{method:'POST',body:{words}})).status,403)
    assert.equal((await submit(words.slice(1))).status,400)
    assert.equal((await submit([...words].reverse())).status,400)
    assert.equal((await alice.call('/api/credits/overview')).body.balance,0)
    const results=await Promise.all([submit(words.map(word=>` ${word.toUpperCase()} `)),submit(words)])
    for(const result of results){assert.equal(result.status,200);assert.equal(result.body.balance,1250);assert.equal(result.body.accessUnlocked,true)}
    const overview=(await alice.call('/api/credits/overview')).body
    assert.equal(overview.accessUnlocked,true)
    assert.equal(overview.entries.filter(entry=>entry.type==='bonus').length,1)
  }finally{await server.stop()}
})

test('migration versionnée conserve les joueurs, rounds et écritures anonymes',()=>{
  const directory=mkdtempSync(join(tmpdir(),'winvero-migration-')),path=join(directory,'legacy.sqlite'),db=new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys=ON;'+readFileSync(resolve(serverDirectory,'migrations','001_initial.sql'),'utf8'))
  const timestamp=new Date().toISOString(),playerId=randomUUID(),roundId=randomUUID()
  db.prepare('INSERT INTO players VALUES(?,?,?,?)').run(playerId,20000,timestamp,timestamp)
  db.prepare('INSERT INTO game_rounds VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(roundId,randomUUID(),playerId,'coinflip','settled',1000,0,0,'{}','{}','{}',timestamp,timestamp)
  db.prepare('INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?)').run(randomUUID(),playerId,null,'initial_credit',20000,20000,timestamp)
  const applied=applyMigrations(db)
  assert.deepEqual(applied,['001_initial.sql','002_auth_and_unified_ledger.sql','003_provably_fair_games.sql','004_telegram_outbox.sql','005_code_submissions.sql'])
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM players').get().n,1)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_rounds').get().n,1)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ledger_entries').get().n,1)
  assert.equal(db.prepare('SELECT user_id FROM players').get().user_id,null)
  db.close();rmSync(directory,{recursive:true,force:true})
})

test('parcours authentifié, ledger unique, idempotence, concurrence et rollback',async()=>{
  const server=await startServer(),anonymous=client(server.base),alice=client(server.base),bob=client(server.base)
  try{
    assert.equal((await anonymous.call('/api/credits/overview')).status,401)
    const registration=await alice.call('/api/auth/register',{method:'POST',body:profile('alice')})
    assert.equal(registration.status,201);assert.equal(registration.body.balance,0);assert.ok(alice.cookie.startsWith('winvero_session='));assert.ok(alice.csrf)
    const overview0=await alice.call('/api/credits/overview');assert.equal(overview0.body.balance,0);assert.equal(overview0.body.entries.filter(entry=>entry.type==='initial_credit').length,0)
    assert.equal((await activate(alice)).body.balance,1250)
    assert.equal((await alice.call('/api/credits/test-operations',{method:'POST',body:{requestId:randomUUID(),kind:'deposit',asset:'EUR',amount:'1'}})).status,403)

    const depositKey=randomUUID(),deposit={requestId:depositKey,kind:'deposit',asset:'EUR',amount:'100'}
    const deposit1=await alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:deposit})
    const deposit2=await alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:deposit})
    assert.equal(deposit1.status,200);assert.equal(deposit1.body.balance,1350);assert.equal(deposit2.body.balance,1350)
    const changed=await alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{...deposit,amount:'101'}})
    assert.equal(changed.status,409)

    const concurrentKey=randomUUID(),concurrentBody={requestId:concurrentKey,kind:'deposit',asset:'EUR',amount:'25'}
    const concurrent=await Promise.all([alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:concurrentBody}),alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:concurrentBody})])
    assert.deepEqual(concurrent.map(result=>result.status),[200,200]);assert.equal(concurrent[0].body.balance,1375);assert.equal(concurrent[1].body.balance,1375)

    const beforeRollback=(await alice.call('/api/credits/overview')).body
    const rollback=await alice.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':alice.csrf,'x-test-fail':'after-balance'},body:{requestId:randomUUID(),kind:'deposit',asset:'EUR',amount:'10'}})
    assert.equal(rollback.status,500);assert.equal((await alice.call('/api/credits/overview')).body.balance,beforeRollback.balance)

    const bobRegistration=await bob.call('/api/auth/register',{method:'POST',body:profile('bob')});assert.equal(bobRegistration.status,201)
    const roundKey=randomUUID()
    const spoofedRound=await alice.call('/api/game-rounds',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{playerId:bobRegistration.body.account.id,requestId:roundKey,gameId:'dice',stake:1,options:{chance:95}}})
    assert.equal(spoofedRound.status,201)
    assert.equal((await bob.call(`/api/game-rounds/${spoofedRound.body.id}`)).status,404)
    assert.equal((await alice.call('/api/game-rounds',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{requestId:roundKey,gameId:'dice',stake:2,options:{chance:95}}})).status,409)

    let winningRound=(await alice.call(`/api/game-rounds/${spoofedRound.body.id}/actions`,{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{action:'resolve'}})).body
    for(let index=0;index<20&&winningRound.payout===0;index+=1){const committed=(await alice.call('/api/game-rounds',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{requestId:randomUUID(),gameId:'dice',stake:1,options:{chance:95}}})).body;winningRound=(await alice.call(`/api/game-rounds/${committed.id}/actions`,{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{action:'resolve'}})).body}
    assert.ok(winningRound.payout>0)
    const history=(await alice.call('/api/credits/overview')).body.entries
    assert.ok(history.some(entry=>entry.type==='stake'));assert.ok(history.some(entry=>entry.type==='payout'))

    const create=async(gameId,options={})=>(await alice.call('/api/game-rounds',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{requestId:randomUUID(),gameId,stake:1,options,clientSeed:'integration-seed'}})).body
    const action=async(round,body)=>(await alice.call(`/api/game-rounds/${round.id}/actions`,{method:'POST',headers:{'x-csrf-token':alice.csrf},body})).body
    const instant=[['coinflip',{choice:'face'}],['roulette',{bet:{type:'straight',value:7}}],['jackpot',{}],['plinko',{risk:'balanced'}],['limbo',{target:2}],['keno',{selected:[1,2,3,4,5]}],['baccarat',{bet:'banker'}],['bigwheel',{choice:1}],['sicbo',{bet:{type:'small'}}]]
    for(const[gameId,options]of instant){const committed=await create(gameId,options);assert.equal(committed.status,'active');assert.equal(committed.fair.serverSeed,null);const settled=await action(committed,{action:'resolve'});assert.equal(settled.status,'settled');assert.equal(createHash('sha256').update(settled.fair.serverSeed).digest('hex'),settled.fair.serverSeedHash)}
    let stateful=await create('mines');stateful=await action(stateful,{action:'reveal',cell:0});if(stateful.status==='active')stateful=await action(stateful,{action:'cashout'});assert.equal(stateful.status,'settled')
    stateful=await create('hilo');stateful=await action(stateful,{action:stateful.state.current===14?'low':'high'});assert.equal(stateful.status,'settled')
    stateful=await create('blackjack');while(stateful.status==='active')stateful=await action(stateful,{action:'stand'});assert.equal(stateful.status,'settled')
    stateful=await create('war');stateful=await action(stateful,{action:(stateful.state.availableActions.includes('surrender')?'surrender':'resolve')});assert.equal(stateful.status,'settled')
    stateful=await create('scratch');for(let cell=0;cell<9;cell++)stateful=await action(stateful,{action:'reveal',cell});assert.equal(stateful.status,'settled')
    stateful=await create('videopoker');stateful=await action(stateful,{action:'draw',holds:[]});assert.equal(stateful.status,'settled')
    stateful=await create('tower',{risk:'low'});stateful=await action(stateful,{action:'reveal',tile:0});if(stateful.status==='active')stateful=await action(stateful,{action:'cashout'});assert.equal(stateful.status,'settled')
    stateful=await create('penalty',{series:1});stateful=await action(stateful,{action:'kick',zone:0});assert.equal(stateful.status,'settled')
    stateful=await create('threecardpoker');stateful=await action(stateful,{action:'play'});assert.equal(stateful.status,'settled')

    const crash=await alice.call('/api/game-rounds',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{requestId:randomUUID(),gameId:'crash',stake:2,options:{}}})
    const cashouts=await Promise.all([alice.call(`/api/game-rounds/${crash.body.id}/actions`,{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{action:'cashout'}}),alice.call(`/api/game-rounds/${crash.body.id}/actions`,{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{action:'cashout'}})])
    assert.ok(cashouts.every(result=>result.status===200));assert.equal(cashouts[0].body.payout,cashouts[1].body.payout)

    const balanceBeforeLogout=(await alice.call('/api/credits/overview')).body.balance
    assert.equal((await alice.call('/api/auth/logout',{method:'POST',headers:{'x-csrf-token':alice.csrf},body:{}})).status,200)
    assert.equal((await alice.call('/api/credits/overview')).status,401)
    const relogin=await alice.call('/api/auth/login',{method:'POST',body:{email:profile('alice').email,password:profile('alice').password}})
    assert.equal(relogin.status,200);assert.equal(relogin.body.balance,balanceBeforeLogout)
    const finalOverview=await alice.call('/api/credits/overview');assert.equal(finalOverview.body.balance,balanceBeforeLogout);assert.equal(finalOverview.body.entries.filter(entry=>entry.type==='initial_credit').length,0)

    const charlie=client(server.base);await charlie.call('/api/auth/register',{method:'POST',body:profile('charlie')})
    await activate(charlie)
    const withdrawals=await Promise.all([charlie.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':charlie.csrf},body:{requestId:randomUUID(),kind:'withdrawal',asset:'EUR',amount:'1000'}}),charlie.call('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':charlie.csrf},body:{requestId:randomUUID(),kind:'withdrawal',asset:'EUR',amount:'1000'}})])
    assert.deepEqual(withdrawals.map(result=>result.status).sort(),[200,409]);assert.equal((await charlie.call('/api/credits/overview')).body.balance,250)

    const attacker=client(server.base)
    for(let index=0;index<5;index+=1)await attacker.call('/api/auth/login',{method:'POST',body:{email:'absent@example.test',password:'incorrect-password'}})
    assert.equal((await attacker.call('/api/auth/login',{method:'POST',body:{email:'absent@example.test',password:'incorrect-password'}})).status,429)

    const db=new DatabaseSync(server.databasePath,{readOnly:true})
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM players p WHERE p.balance_cents != COALESCE((SELECT SUM(amount_cents) FROM ledger_entries l WHERE l.player_id=p.id),0)').get().n,0)
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash NOT LIKE '$argon2id$%'").get().n,0)
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE type='initial_credit' GROUP BY player_id HAVING COUNT(*)>1").get()?.n??0,0)
    db.close()
  }finally{await server.stop()}
})

test('une session expire côté serveur',async()=>{
  const server=await startServer({ttl:1}),short=client(server.base)
  try{assert.equal((await short.call('/api/auth/register',{method:'POST',body:profile('short')})).status,201);await wait(1150);assert.equal((await short.call('/api/auth/session')).status,401)}finally{await server.stop()}
})


test('retired public code cannot credit accounts or enqueue unlock notifications',async()=>{
 const server=await startServer({legacyActivation:false,telegram:true}),alice=client(server.base);
 const database=new DatabaseSync(server.databasePath,{readOnly:true});
 try{
  await alice.call('/api/auth/register',{method:'POST',body:profile('retired')});
  const before=database.prepare('SELECT COUNT(*) AS n FROM telegram_outbox').get().n;
  assert.equal((await activate(alice)).status,410);
  const overview=(await alice.call('/api/credits/overview')).body;
  assert.equal(overview.balance,0);assert.equal(overview.accessUnlocked,false);
  assert.equal(overview.entries.filter(e=>e.type==='bonus').length,0);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM telegram_outbox').get().n,before);
 }finally{database.close();await server.stop()}
});
