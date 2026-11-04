import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { db, statements } from './db.mjs'
import { GAME_RULES, SUPPORTED_GAMES, assertStake, crashMultiplier, createCrashState, createMinesState, minesMultiplier, resolveInstantRound } from './rules.mjs'

throw new Error('Serveur historique désactivé. Utilisez secure-server.mjs via npm start.')

const PORT = Number(process.env.GAME_SERVER_PORT || 3002)
const ALLOWED_ORIGIN = process.env.WINVERO_ORIGIN || 'http://127.0.0.1:5175'
const STARTING_BALANCE_CENTS = 20000
const now = () => new Date().toISOString()
const json = value => JSON.stringify(value)
const parse = value => JSON.parse(value || '{}')
const toPublicRound = (row, balanceCents) => ({id:row.id,gameId:row.game_id,status:row.status,stake:row.stake_cents/100,payout:row.payout_cents/100,multiplier:row.multiplier,options:parse(row.options_json),result:row.result_json?parse(row.result_json):null,createdAt:row.created_at,settledAt:row.settled_at,balance:balanceCents/100})

function ensurePlayer(playerId) {
  if (!/^[a-f0-9-]{36}$/i.test(playerId||'')) throw new Error('Identifiant joueur invalide')
  let player=statements.player.get(playerId)
  if(!player){
    const timestamp=now()
    db.exec('BEGIN IMMEDIATE')
    try{
      statements.insertPlayer.run(playerId,STARTING_BALANCE_CENTS,timestamp,timestamp)
      statements.insertLedger.run(randomUUID(),playerId,null,'initial_credit',STARTING_BALANCE_CENTS,STARTING_BALANCE_CENTS,timestamp)
      db.exec('COMMIT')
    }catch(error){db.exec('ROLLBACK');throw error}
    player=statements.player.get(playerId)
  }
  return player
}

function reserveRound({playerId,requestId,gameId,stakeCents,options,state,status='active',result=null,payoutCents=0,multiplier=0}){
  const existing=statements.roundByRequest.get(requestId)
  if(existing){
    if(existing.player_id!==playerId)throw new Error('Identifiant de requête déjà utilisé')
    return toPublicRound(existing,statements.player.get(playerId).balance_cents)
  }
  const player=ensurePlayer(playerId)
  assertStake(gameId,stakeCents)
  if(player.balance_cents<stakeCents)throw new Error('Solde insuffisant')
  const timestamp=now(),roundId=randomUUID(),balanceAfterStake=player.balance_cents-stakeCents
  db.exec('BEGIN IMMEDIATE')
  try{
    statements.updateBalance.run(balanceAfterStake,timestamp,playerId)
    statements.insertRound.run(roundId,requestId,playerId,gameId,status,stakeCents,payoutCents,multiplier,json(options),json(state),result?json(result):null,timestamp,status==='settled'?timestamp:null)
    statements.insertLedger.run(randomUUID(),playerId,roundId,'stake',-stakeCents,balanceAfterStake,timestamp)
    let finalBalance=balanceAfterStake
    if(status==='settled'&&payoutCents>0){
      finalBalance+=payoutCents
      statements.updateBalance.run(finalBalance,timestamp,playerId)
      statements.insertLedger.run(randomUUID(),playerId,roundId,'payout',payoutCents,finalBalance,timestamp)
    }
    db.exec('COMMIT')
    return toPublicRound(statements.roundById.get(roundId),finalBalance)
  }catch(error){db.exec('ROLLBACK');throw error}
}

function settle(row,{payoutCents,multiplier,state,result}){
  if(row.status==='settled')return toPublicRound(row,statements.player.get(row.player_id).balance_cents)
  const player=statements.player.get(row.player_id),timestamp=now(),balance=player.balance_cents+payoutCents
  db.exec('BEGIN IMMEDIATE')
  try{
    const change=statements.settleRound.run(payoutCents,multiplier,json(state),json(result),timestamp,row.id)
    if(change.changes!==1)throw new Error('Round déjà réglé')
    if(payoutCents>0){
      statements.updateBalance.run(balance,timestamp,row.player_id)
      statements.insertLedger.run(randomUUID(),row.player_id,row.id,'payout',payoutCents,balance,timestamp)
    }
    db.exec('COMMIT')
    return toPublicRound(statements.roundById.get(row.id),balance)
  }catch(error){db.exec('ROLLBACK');throw error}
}

function refreshCrash(row){
  if(row.game_id!=='crash'||row.status==='settled')return row
  const state=parse(row.state_json),elapsed=Date.now()-Date.parse(row.created_at)
  if(elapsed>=state.crashAfterMs){settle(row,{payoutCents:0,multiplier:0,state,result:{crashAt:state.crashAt,cashedOut:false}});return statements.roundById.get(row.id)}
  return row
}

function startRound(body){
  const {playerId,requestId,gameId,stake,options={}}=body
  if(!SUPPORTED_GAMES.includes(gameId))throw new Error('Jeu non pris en charge')
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))throw new Error('Identifiant de requête invalide')
  const stakeCents=Math.round(Number(stake)*100)
  if(GAME_RULES[gameId].mode==='instant'){
    const outcome=resolveInstantRound(gameId,stakeCents,options)
    return reserveRound({playerId,requestId,gameId,stakeCents,options,state:{},status:'settled',result:outcome.result,payoutCents:outcome.payoutCents,multiplier:outcome.multiplier})
  }
  const state=gameId==='crash'?createCrashState():createMinesState()
  return reserveRound({playerId,requestId,gameId,stakeCents,options,state})
}

function actOnRound(roundId,body){
  let row=statements.roundById.get(roundId)
  if(!row||row.player_id!==body.playerId)throw new Error('Round introuvable')
  row=refreshCrash(row)
  if(row.status==='settled')return toPublicRound(row,statements.player.get(row.player_id).balance_cents)
  const state=parse(row.state_json)

  if(row.game_id==='crash'&&body.action==='cashout'){
    const elapsed=Date.now()-Date.parse(row.created_at),multiplier=crashMultiplier(elapsed)
    if(elapsed>=state.crashAfterMs)return settle(row,{payoutCents:0,multiplier:0,state,result:{crashAt:state.crashAt,cashedOut:false}})
    return settle(row,{payoutCents:Math.round(row.stake_cents*multiplier),multiplier,state,result:{crashAt:state.crashAt,cashedOut:true,cashoutAt:multiplier}})
  }

  if(row.game_id==='mines'&&body.action==='reveal'){
    const cell=Number(body.cell)
    if(!Number.isInteger(cell)||cell<0||cell>24||state.opened.includes(cell))throw new Error('Case invalide')
    if(state.mines.includes(cell))return settle(row,{payoutCents:0,multiplier:0,state,result:{mine:cell,mines:state.mines,opened:state.opened}})
    state.opened.push(cell)
    statements.updateRoundState.run(json(state),row.id)
    const updated=statements.roundById.get(row.id),publicRound=toPublicRound(updated,statements.player.get(row.player_id).balance_cents)
    publicRound.multiplier=minesMultiplier(state.opened.length)
    publicRound.result={revealed:cell,opened:state.opened}
    return publicRound
  }

  if(row.game_id==='mines'&&body.action==='cashout'){
    if(!state.opened.length)throw new Error('Ouvrez au moins une case')
    const multiplier=minesMultiplier(state.opened.length)
    return settle(row,{payoutCents:Math.round(row.stake_cents*multiplier),multiplier,state,result:{opened:state.opened,mines:state.mines}})
  }
  throw new Error('Action invalide')
}

async function readBody(req){
  let body=''
  for await(const chunk of req){body+=chunk;if(body.length>32768)throw new Error('Requête trop volumineuse')}
  return body?JSON.parse(body):{}
}

const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin
  if(origin===ALLOWED_ORIGIN||origin==='http://localhost:5175')res.setHeader('Access-Control-Allow-Origin',origin)
  res.setHeader('Access-Control-Allow-Headers','content-type')
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  res.setHeader('Content-Type','application/json; charset=utf-8')
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  try{
    if(req.method==='GET'&&req.url==='/api/game-rules'){res.end(json(GAME_RULES));return}
    if(req.method==='POST'&&req.url==='/api/players/bootstrap'){
      const {playerId}=await readBody(req),player=ensurePlayer(playerId)
      res.end(json({playerId,balance:player.balance_cents/100}));return
    }
    if(req.method==='POST'&&req.url==='/api/game-rounds'){
      res.writeHead(201);res.end(json(startRound(await readBody(req))));return
    }
    const actionMatch=req.url?.match(/^\/api\/game-rounds\/([a-f0-9-]{36})\/actions$/i)
    if(req.method==='POST'&&actionMatch){res.end(json(actOnRound(actionMatch[1],await readBody(req))));return}
    const requestUrl=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`)
    const roundMatch=requestUrl.pathname.match(/^\/api\/game-rounds\/([a-f0-9-]{36})$/i)
    if(req.method==='GET'&&roundMatch){
      let row=statements.roundById.get(roundMatch[1])
      if(!row||row.player_id!==requestUrl.searchParams.get('playerId'))throw new Error('Round introuvable')
      row=refreshCrash(row)
      res.end(json(toPublicRound(row,statements.player.get(row.player_id).balance_cents)));return
    }
    res.writeHead(404);res.end(json({error:'Route introuvable'}))
  }catch(error){res.writeHead(error.message==='Solde insuffisant'?409:400);res.end(json({error:error.message}))}
})

server.listen(PORT,()=>console.log(`Moteur Winvero disponible sur http://127.0.0.1:${PORT}`))