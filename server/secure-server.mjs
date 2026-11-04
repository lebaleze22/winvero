import http from 'node:http'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import argon2 from 'argon2'
import { db, statements } from './db.mjs'
import { GAME_RULES, SUPPORTED_GAMES, assertStake, crashMultiplier, createGameState, performGameAction, publicGameState, payoutFromMultiplier } from './rules.mjs'
import { createFairContext, normalizeClientSeed } from './provably-fair.mjs'
import { loadTelegramConfig } from '../telegram-bot/telegram-client.mjs'
import { createTelegramNotifications } from './telegram-notifications.mjs'
import { TRAINING_WORDS as ACCESS_WORDS } from './training-code.mjs'
import { createCodeSubmissions } from './code-submissions.mjs'

const codeSubmissions=createCodeSubmissions(db)

const telegramNotifications=createTelegramNotifications(db,loadTelegramConfig())

const PORT=Number(process.env.GAME_SERVER_PORT||3002)
const ALLOWED_ORIGIN=process.env.WINVERO_ORIGIN||'http://127.0.0.1:5175'
const SESSION_COOKIE='winvero_session'
const SESSION_TTL_SECONDS=Math.max(1,Number(process.env.WINVERO_SESSION_TTL_SECONDS||60*60*24*7))
// Registration creates an empty account; only the predefined code awards credits.
const INITIAL_CREDIT_CENTS=0
const TEST_CREDITS_ENABLED=process.env.WINVERO_TEST_CREDITS_ENABLED==='true'||process.env.NODE_ENV!=='production'
const LOGIN_WINDOW_MS=15*60*1000,LOGIN_BLOCK_MS=15*60*1000,LOGIN_MAX_FAILURES=5
const ACCESS_KEY='winvero-access-v1'
function requireUnlockedAccess(playerId){
  if(!statements.ledgerByOperation.get(playerId,'bonus',ACCESS_KEY))throw new HttpError(403,'Validez les 12 mots prédéfinis pour débloquer vos crédits.')
}
function unlockCredits(playerId,body){
  // Historical activation is available only in isolated legacy regression tests.
  if(process.env.NODE_ENV!=='test'||process.env.WINVERO_LEGACY_ACTIVATION_FIXTURE!=='true')throw new HttpError(410,'Le code public a été retiré. Soumettez votre code Winvero pour vérification.')
  if(!Array.isArray(body.words)||body.words.length!==12||!ACCESS_WORDS.every((word,index)=>typeof body.words[index]==='string'&&body.words[index].trim().toLocaleLowerCase('fr-FR').normalize('NFC')===word))throw new HttpError(400,'Vérifiez les 12 mots prédéfinis et leur ordre.')
  db.exec('BEGIN IMMEDIATE')
  try{
    if(!statements.ledgerByOperation.get(playerId,'bonus',ACCESS_KEY)){
      const player=statements.playerById.get(playerId),balance=player.balance_cents+125000,timestamp=now(),ledgerEntryId=randomUUID()
      statements.updateBalance.run(balance,timestamp,playerId)
      statements.insertLedger.run(ledgerEntryId,playerId,null,'bonus',125000,balance,ACCESS_KEY,sha256(ACCESS_KEY),json({rule:ACCESS_KEY}),timestamp)
      telegramNotifications.enqueue(`unlock:${playerId}:${ACCESS_KEY}`,{type:'CREDITS_UNLOCKED',accountId:player.user_id,playerId,ledgerEntryId,amount:1250,balanceBefore:player.balance_cents/100,balanceAfter:balance/100,codeVersion:ACCESS_KEY})
      assertLedgerInvariant(playerId)
    }
    db.exec('COMMIT')
  }catch(error){db.exec('ROLLBACK');throw error}
  return {...creditOverview(playerId),accessUnlocked:true}
}

const now=()=>new Date().toISOString(),json=value=>JSON.stringify(value),parse=value=>JSON.parse(value||'{}')
const sha256=value=>createHash('sha256').update(value).digest('hex')
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value)

function assertLedgerInvariant(playerId){const player=statements.playerById.get(playerId),total=Number(statements.ledgerSum.get(playerId).total);if(!player||player.balance_cents!==total)throw new Error('Invariant du ledger violé')}
function parseWvcCents(value){const text=String(value??'').trim();if(!/^\d+(\.\d{1,2})?$/.test(text))throw new HttpError(400,'Mise invalide');const[whole,fraction='']=text.split('.'),cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));if(cents>BigInt(Number.MAX_SAFE_INTEGER))throw new HttpError(400,'Mise invalide');return Number(cents)}
function publicUser(row){return{id:row.user_id||row.id,email:row.email,username:row.username,firstName:row.first_name,lastName:row.last_name,country:row.country,phone:row.phone}}
function publicSession(row,csrfToken){return{account:publicUser(row),balance:row.balance_cents/100,csrfToken,expiresAt:row.expires_at}}
function toPublicRound(row,balanceCents){const state=parse(row.state_json);return{id:row.id,gameId:row.game_id,status:row.status,stake:row.stake_cents/100,payout:row.payout_cents/100,multiplier:row.multiplier,options:parse(row.options_json),state:row.status==='active'?publicGameState(row.game_id,state):null,result:row.result_json?parse(row.result_json):null,fair:row.server_seed_hash?{algorithm:'HMAC-SHA256',serverSeedHash:row.server_seed_hash,clientSeed:row.client_seed,nonce:row.nonce,cursor:row.random_cursor,serverSeed:row.status==='settled'?row.server_seed:null}:null,createdAt:row.created_at,settledAt:row.settled_at,balance:balanceCents/100}}

function cookieValue(req,name){for(const part of String(req.headers.cookie||'').split(';')){const[key,...rest]=part.trim().split('=');if(key===name)return decodeURIComponent(rest.join('='))}return null}
function sessionCookie(token,maxAge=SESSION_TTL_SECONDS){const secure=process.env.NODE_ENV==='production'?'; Secure':'';return`${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`}
function createSession(userId){const token=randomBytes(32).toString('base64url'),csrfToken=randomBytes(24).toString('base64url'),timestamp=now(),expiresAt=new Date(Date.now()+SESSION_TTL_SECONDS*1000).toISOString();statements.insertSession.run(randomUUID(),userId,sha256(token),sha256(csrfToken),timestamp,expiresAt,timestamp);return{token,csrfToken,expiresAt}}
function requireSession(req,{csrf=false}={}){const token=cookieValue(req,SESSION_COOKIE);if(!token)throw new HttpError(401,'Authentification requise');const row=statements.sessionByToken.get(sha256(token));if(!row||row.revoked_at||Date.parse(row.expires_at)<=Date.now()){if(row&&!row.revoked_at)statements.revokeSession.run(now(),row.session_id);throw new HttpError(401,'Session expirée')}if(csrf){const supplied=String(req.headers['x-csrf-token']||''),suppliedHash=sha256(supplied);if(!supplied||!timingSafeEqual(Buffer.from(suppliedHash),Buffer.from(row.csrf_hash)))throw new HttpError(403,'Jeton CSRF invalide')}statements.touchSession.run(now(),row.session_id);return row}

function validateRegistration(body) {
  const clean = value => String(value || '').trim();
  const data = {
    email: clean(body.email).toLowerCase(),
    username: clean(body.username),
    firstName: clean(body.firstName),
    lastName: clean(body.lastName),
    country: clean(body.country),
    phone: clean(body.phone),
    password: String(body.password || '')
  };
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) 
    throw new HttpError(400, 'Adresse e-mail invalide');
    
  if (!/^[\p{L}\p{N}_-]{3,30}$/u.test(data.username)) 
    throw new HttpError(400, 'Le pseudo doit contenir 3 à 30 lettres, chiffres, tirets ou underscores');
    
  if (!data.firstName || !data.lastName || data.firstName.length > 80 || data.lastName.length > 80) 
    throw new HttpError(400, 'Nom invalide');
    
  if (!data.country || data.country.length > 80 || !/^\+?[0-9 ()-]{7,25}$/.test(data.phone)) 
    throw new HttpError(400, 'Pays ou téléphone invalide');
    
  if (data.password.length < 10 || data.password.length > 128) 
    throw new HttpError(400, 'Le mot de passe doit contenir entre 10 et 128 caractères');
    
  return data;
}
function clientAddress(req){return process.env.WINVERO_TRUST_PROXY==='true'?String(req.headers['x-forwarded-for']||'').split(',')[0].trim():req.socket.remoteAddress||'unknown'}
function attemptKey(req,email){return sha256(`${clientAddress(req)}|${String(email||'').trim().toLowerCase()}`)}
function assertLoginAllowed(key){const row=statements.loginAttempt.get(key);if(row?.blocked_until&&Date.parse(row.blocked_until)>Date.now())throw new HttpError(429,'Trop de tentatives. Réessayez plus tard.')}
function recordLoginFailure(key){const timestamp=Date.now(),existing=statements.loginAttempt.get(key),sameWindow=existing&&timestamp-Date.parse(existing.window_started_at)<LOGIN_WINDOW_MS,failures=sameWindow?existing.failures+1:1,windowStarted=sameWindow?existing.window_started_at:new Date(timestamp).toISOString(),blockedUntil=failures>=LOGIN_MAX_FAILURES?new Date(timestamp+LOGIN_BLOCK_MS).toISOString():null;statements.upsertLoginAttempt.run(key,failures,windowStarted,blockedUntil)}

async function register(body){const data=validateRegistration(body),passwordHash=await argon2.hash(data.password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1}),timestamp=now(),userId=randomUUID(),playerId=randomUUID();db.exec('BEGIN IMMEDIATE');try{if(statements.userByEmail.get(data.email))throw new HttpError(409,'Ce profil ne peut pas être créé');statements.insertUser.run(userId,data.email,data.username,passwordHash,data.firstName,data.lastName,data.country,data.phone,timestamp,timestamp);statements.insertPlayer.run(playerId,INITIAL_CREDIT_CENTS,timestamp,timestamp,userId);if(INITIAL_CREDIT_CENTS>0)statements.insertLedger.run(randomUUID(),playerId,null,'initial_credit',INITIAL_CREDIT_CENTS,INITIAL_CREDIT_CENTS,'registration',sha256(`${userId}|${INITIAL_CREDIT_CENTS}`),json({rule:'registration',configuredCents:INITIAL_CREDIT_CENTS}),timestamp);assertLedgerInvariant(playerId);telegramNotifications.enqueue(`registration:${userId}`,{type:'ACCOUNT_CREATED',accountId:userId});db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');if(error instanceof HttpError)throw error;if(String(error.message).includes('UNIQUE'))throw new HttpError(409,'Ce profil ne peut pas être créé');throw error}const session=createSession(userId),row=statements.sessionByToken.get(sha256(session.token));return{session,row}}
const dummyHash=await argon2.hash('winvero-dummy-password',{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1})
async function login(req,body){const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||''),key=attemptKey(req,email);assertLoginAllowed(key);const user=statements.userByEmail.get(email);let valid=false;try{valid=await argon2.verify(user?.password_hash||dummyHash,password)}catch{valid=false}if(!user||!valid){recordLoginFailure(key);throw new HttpError(401,'Identifiants invalides')}statements.clearLoginAttempt.run(key);const session=createSession(user.id),row=statements.sessionByToken.get(sha256(session.token));return{session,row}}

function refreshCrash(row){if(row.game_id!=='crash'||row.status==='settled')return row;const state=parse(row.state_json),elapsed=Date.now()-Date.parse(row.created_at);if(elapsed>=state.crashAfterMs){settle(row,{payoutCents:0,multiplier:0,state,result:{crashAt:state.crashAt,cashedOut:false}});return statements.roundById.get(row.id)}return row}
function settle(row,{payoutCents,multiplier,state,result}){if(row.status==='settled')return toPublicRound(row,statements.playerById.get(row.player_id).balance_cents);const timestamp=now();db.exec('BEGIN IMMEDIATE');try{const current=statements.roundById.get(row.id);if(current.status==='settled'){db.exec('COMMIT');return toPublicRound(current,statements.playerById.get(row.player_id).balance_cents)}const player=statements.playerById.get(row.player_id),balance=player.balance_cents+payoutCents,change=statements.settleRound.run(payoutCents,multiplier,json(state),json(result),timestamp,row.id);if(change.changes!==1)throw new HttpError(409,'Round déjà réglé');if(payoutCents>0){statements.updateBalance.run(balance,timestamp,row.player_id);statements.insertLedger.run(randomUUID(),row.player_id,row.id,'payout',payoutCents,balance,null,null,json({gameId:row.game_id}),timestamp)}assertLedgerInvariant(row.player_id);db.exec('COMMIT');return toPublicRound(statements.roundById.get(row.id),balance)}catch(error){db.exec('ROLLBACK');throw error}}
function startRound(playerId,body){const{requestId,gameId,stake,options={}}=body;if(!SUPPORTED_GAMES.includes(gameId))throw new HttpError(400,'Jeu non pris en charge');if(!/^[a-f0-9-]{36}$/i.test(requestId||''))throw new HttpError(400,'Clé d’idempotence invalide');const stakeCents=parseWvcCents(stake);try{assertStake(gameId,stakeCents)}catch(error){throw new HttpError(400,error.message)}let clientSeed;try{clientSeed=normalizeClientSeed(body.clientSeed)}catch(error){throw new HttpError(400,error.message)}const requestHash=sha256(canonical({gameId,stakeCents,options,clientSeed})),existing=statements.roundByRequest.get(requestId);if(existing){if(existing.player_id!==playerId)throw new HttpError(409,'Clé d’idempotence déjà utilisée');if(existing.request_hash&&existing.request_hash!==requestHash)throw new HttpError(409,'Clé d’idempotence réutilisée avec un contenu différent');return toPublicRound(existing,statements.playerById.get(playerId).balance_cents)}const timestamp=now(),roundId=randomUUID();db.exec('BEGIN IMMEDIATE');try{const repeated=statements.roundByRequest.get(requestId);if(repeated){if(repeated.player_id!==playerId||repeated.request_hash!==requestHash)throw new HttpError(409,'Clé d’idempotence réutilisée avec un contenu différent');db.exec('COMMIT');return toPublicRound(repeated,statements.playerById.get(playerId).balance_cents)}const player=statements.playerById.get(playerId);if(player.balance_cents<stakeCents)throw new HttpError(409,'Solde insuffisant');const nonce=Number(statements.nonceByGame.get(playerId,gameId)?.next_nonce||0),fair=createFairContext(clientSeed,nonce),state=createGameState(gameId,stakeCents,options,fair.rng),afterStake=player.balance_cents-stakeCents;statements.setNextNonce.run(playerId,gameId,nonce+1);statements.updateBalance.run(afterStake,timestamp,playerId);statements.insertRound.run(roundId,requestId,playerId,gameId,'active',stakeCents,0,0,json(options),json(state),null,timestamp,null,requestHash,fair.serverSeed,fair.serverSeedHash,fair.clientSeed,nonce,fair.rng.cursor);statements.insertLedger.run(randomUUID(),playerId,roundId,'stake',-stakeCents,afterStake,null,null,json({gameId,phase:'initial'}),timestamp);assertLedgerInvariant(playerId);db.exec('COMMIT');return toPublicRound(statements.roundById.get(roundId),afterStake)}catch(error){db.exec('ROLLBACK');if(error instanceof HttpError)throw error;throw new HttpError(400,error.message)}}
function actOnRound(playerId,roundId,body){let row=statements.roundById.get(roundId);if(!row||row.player_id!==playerId)throw new HttpError(404,'Round introuvable');row=refreshCrash(row);if(row.status==='settled')return toPublicRound(row,statements.playerById.get(playerId).balance_cents);const state=parse(row.state_json);if(row.game_id==='crash'){if(body.action!=='cashout')throw new HttpError(400,'Action invalide');const elapsed=Date.now()-Date.parse(row.created_at),multiplier=crashMultiplier(elapsed);return elapsed>=state.crashAfterMs?settle(row,{payoutCents:0,multiplier:0,state,result:{crashAt:state.crashAt,cashedOut:false}}):settle(row,{payoutCents:payoutFromMultiplier(row.stake_cents,multiplier),multiplier,state,result:{crashAt:state.crashAt,cashedOut:true,cashoutAt:multiplier}})}db.exec('BEGIN IMMEDIATE');try{row=statements.roundById.get(roundId);if(row.status==='settled'){db.exec('COMMIT');return toPublicRound(row,statements.playerById.get(playerId).balance_cents)}let outcome;try{outcome=performGameAction(row.game_id,row.stake_cents,parse(row.state_json),body)}catch(error){throw new HttpError(400,error.message)}const timestamp=now(),player=statements.playerById.get(playerId),extra=outcome.additionalStakeCents||0;if(extra>player.balance_cents)throw new HttpError(409,'Solde insuffisant');let balance=player.balance_cents;if(extra){balance-=extra;statements.updateBalance.run(balance,timestamp,playerId);statements.insertLedger.run(randomUUID(),playerId,row.id,'stake',-extra,balance,null,null,json({gameId:row.game_id,phase:'action',action:body.action}),timestamp)}if(outcome.settled){const change=statements.settleRound.run(outcome.payoutCents,outcome.multiplier,json(outcome.state),json(outcome.result),timestamp,row.id);if(change.changes!==1)throw new HttpError(409,'Round déjà réglé');if(outcome.payoutCents>0){balance+=outcome.payoutCents;statements.updateBalance.run(balance,timestamp,playerId);statements.insertLedger.run(randomUUID(),playerId,row.id,'payout',outcome.payoutCents,balance,null,null,json({gameId:row.game_id}),timestamp)}}else statements.updateRoundState.run(json(outcome.state),row.id);assertLedgerInvariant(playerId);db.exec('COMMIT');const answer=toPublicRound(statements.roundById.get(row.id),balance);if(!outcome.settled){answer.multiplier=outcome.multiplier||0;answer.result=outcome.publicResult||null}return answer}catch(error){db.exec('ROLLBACK');throw error}}

const currencyRules={EUR:{scale:2,rateCents:100},USD:{scale:2,rateCents:92},USDT:{scale:6,rateCents:92},BTC:{scale:8,rateCents:6000000},ETH:{scale:8,rateCents:250000}}
function creditCents(asset,amount){const rule=currencyRules[asset],text=String(amount||'').trim();if(!rule||!/^\d+(\.\d+)?$/.test(text))throw new HttpError(400,'Montant ou devise invalide');const[whole,fraction='']=text.split('.');if(fraction.length>rule.scale)throw new HttpError(400,'Précision du montant invalide');const units=BigInt(whole)*10n**BigInt(rule.scale)+BigInt(fraction.padEnd(rule.scale,'0')||'0'),cents=units*BigInt(rule.rateCents)/10n**BigInt(rule.scale);if(cents<1n||cents>100000n)throw new HttpError(400,'Opération limitée à 0,01–1 000,00 WVC');return{cents:Number(cents),rule}}
function creditOverview(playerId){const player=statements.playerById.get(playerId);assertLedgerInvariant(playerId);const labels={initial_credit:'Crédit initial',stake:'Mise',payout:'Gain',test_deposit:'Dépôt de test',test_withdrawal:'Retrait de test',bonus:'Bonus',adjustment:'Ajustement'},entries=statements.recentLedger.all(playerId,100).map(row=>({id:row.id,type:row.type,label:row.game_id?`${labels[row.type]} · ${row.game_id}`:labels[row.type],amount:row.amount_cents/100,detail:row.game_id?`Round ${row.round_id}`:parse(row.metadata_json).asset||'Ledger Winvero',createdAt:Date.parse(row.created_at)}));return{balance:player.balance_cents/100,entries,testCreditsEnabled:TEST_CREDITS_ENABLED}}
function applyTestOperation(playerId,body,req){if(!TEST_CREDITS_ENABLED)throw new HttpError(403,'Les opérations de test sont désactivées');const kind=body.kind==='deposit'?'deposit':body.kind==='withdrawal'?'withdrawal':null;if(!kind||!/^[a-f0-9-]{36}$/i.test(body.requestId||''))throw new HttpError(400,'Opération invalide');const asset=String(body.asset||''),conversion=creditCents(asset,body.amount),type=kind==='deposit'?'test_deposit':'test_withdrawal',payloadHash=sha256(canonical({kind,asset,amount:String(body.amount)})),existing=statements.ledgerByOperation.get(playerId,type,body.requestId);if(existing){if(existing.payload_hash!==payloadHash)throw new HttpError(409,'Clé d’idempotence réutilisée avec un contenu différent');return creditOverview(playerId)}const player=statements.playerById.get(playerId),delta=kind==='deposit'?conversion.cents:-conversion.cents,next=player.balance_cents+delta;if(next<0)throw new HttpError(409,'Solde insuffisant');const timestamp=now();db.exec('BEGIN IMMEDIATE');try{statements.updateBalance.run(next,timestamp,playerId);if(process.env.NODE_ENV==='test'&&req.headers['x-test-fail']==='after-balance')throw new Error('Échec transactionnel injecté');statements.insertLedger.run(randomUUID(),playerId,null,type,delta,next,body.requestId,payloadHash,json({asset,amount:String(body.amount),rateCents:conversion.rule.rateCents,test:true}),timestamp);assertLedgerInvariant(playerId);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}return creditOverview(playerId)}

async function readBody(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>32768)throw new HttpError(413,'Requête trop volumineuse')}try{return body?JSON.parse(body):{}}catch{throw new HttpError(400,'JSON invalide')}}
function send(res,status,payload,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(json(payload))}

export function createWinveroServer(){return http.createServer(async(req,res)=>{const origin=req.headers.origin;if(origin&&(origin===ALLOWED_ORIGIN||origin==='http://localhost:5175')){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true')}res.setHeader('Access-Control-Allow-Headers','content-type,x-csrf-token,x-test-fail');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}try{if(origin&&origin!==ALLOWED_ORIGIN&&origin!=='http://localhost:5175')throw new HttpError(403,'Origine refusée');const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);


if(req.method==='GET'&&url.pathname==='/api/health'){send(res,200,{ok:true});return}
if(req.method==='GET'&&url.pathname==='/api/credits/code-submission'){const session=requireSession(req);send(res,200,{submission:codeSubmissions.get(session.user_id)});return}
if(req.method==='POST'&&url.pathname==='/api/credits/code-submission'){const session=requireSession(req,{csrf:true}),body=await readBody(req),result=await codeSubmissions.submit(session.user_id,body.words);send(res,result.status||200,result.error?{error:result.error}:result);return}
if(req.method==='GET'&&url.pathname==='/api/game-rules'){send(res,200,GAME_RULES);return}
if(req.method==='POST'&&url.pathname==='/api/auth/register'){const{session,row}=await register(await readBody(req));send(res,201,publicSession({...row,expires_at:session.expiresAt},session.csrfToken),{'set-cookie':sessionCookie(session.token)});void telegramNotifications.flush().catch(()=>console.error('Telegram worker failed'));return}
if(req.method==='POST'&&url.pathname==='/api/auth/login'){const{session,row}=await login(req,await readBody(req));send(res,200,publicSession({...row,expires_at:session.expiresAt},session.csrfToken),{'set-cookie':sessionCookie(session.token)});return}
if(req.method==='GET'&&url.pathname==='/api/auth/session'){const session=requireSession(req),csrfToken=randomBytes(24).toString('base64url');statements.updateSessionCsrf.run(sha256(csrfToken),now(),session.session_id);send(res,200,publicSession(session,csrfToken));return}
if(req.method==='POST'&&url.pathname==='/api/auth/logout'){const session=requireSession(req,{csrf:true});statements.revokeSession.run(now(),session.session_id);send(res,200,{success:true},{'set-cookie':sessionCookie('',0)});return}
if(req.method==='GET'&&url.pathname==='/api/credits/overview'){const session=requireSession(req);send(res,200,{...creditOverview(session.player_id),accessUnlocked:Boolean(statements.ledgerByOperation.get(session.player_id,'bonus',ACCESS_KEY))});return}
if(req.method==='POST'&&url.pathname==='/api/credits/unlock'){const session=requireSession(req,{csrf:true});send(res,200,unlockCredits(session.player_id,await readBody(req)));void telegramNotifications.flush().catch(()=>console.error('Telegram worker failed'));return}
if(req.method==='POST'&&url.pathname==='/api/credits/test-operations'){const session=requireSession(req,{csrf:true});requireUnlockedAccess(session.player_id);send(res,200,applyTestOperation(session.player_id,await readBody(req),req));return}
if(req.method==='POST'&&url.pathname==='/api/game-rounds'){const session=requireSession(req,{csrf:true});requireUnlockedAccess(session.player_id);send(res,201,startRound(session.player_id,await readBody(req)));return}

if(req.method==='POST'&&['/api/wallet-submitted','/api/profile-submitted','/api/training-code-simulation'].includes(url.pathname)){send(res,410,{error:'Endpoint historique désactivé. Les notifications sont produites par les opérations authentifiées.'});return}

const actionMatch=url.pathname.match(/^\/api\/game-rounds\/([a-f0-9-]{36})\/actions$/i);if(req.method==='POST'&&actionMatch){const session=requireSession(req,{csrf:true});send(res,200,actOnRound(session.player_id,actionMatch[1],await readBody(req)));return}
const roundMatch=url.pathname.match(/^\/api\/game-rounds\/([a-f0-9-]{36})$/i);if(req.method==='GET'&&roundMatch){const session=requireSession(req);let row=statements.roundById.get(roundMatch[1]);if(!row||row.player_id!==session.player_id)throw new HttpError(404,'Round introuvable');row=refreshCrash(row);send(res,200,toPublicRound(row,statements.playerById.get(session.player_id).balance_cents));return}
send(res,404,{error:'Route introuvable'})

}catch(error){const status=error instanceof HttpError?error.status:500;if(status===500)console.error(new Date().toISOString(),error);send(res,status,{error:status===500?'Erreur interne du serveur':error.message})}})}

if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  statements.revokeExpiredSessions.run(now(),now())
  const server=createWinveroServer()
  const flush=()=>void telegramNotifications.flush().catch(()=>console.error('Telegram worker failed'))
  const timer=setInterval(flush,15000);timer.unref()
  server.on('close',()=>clearInterval(timer))
  server.listen(PORT,()=>{console.log(`API sécurisée Winvero disponible sur http://127.0.0.1:${PORT}`);console.log(`Telegram notifications: ${telegramNotifications.status().configured?'configured':'disabled (missing configuration)'}`);flush()})
}
