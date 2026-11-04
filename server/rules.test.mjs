import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { FairRng, createFairContext, fairFloat, verifyFairEvent } from './provably-fair.mjs'
import { GAME_RULES, SUPPORTED_GAMES, createGameState, crashMultiplier, minesMultiplier, payoutFromMultiplier, performGameAction, resolveInstantRound } from './rules.mjs'

const SEED='0123456789abcdef'.repeat(4),CLIENT='winvero-test',STAKE=1000
class FastRng{constructor(seed=123456789){this.value=seed>>>0}float(){this.value=(1664525*this.value+1013904223)>>>0;return this.value/0x100000000}int(max){return Math.floor(this.float()*max)}pick(values){return values[this.int(values.length)]}shuffle(values){const out=[...values];for(let i=out.length-1;i>0;i--){const j=this.int(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}}
const options={coinflip:{choice:'face'},dice:{chance:50},roulette:{bet:{type:'red'}},jackpot:{},plinko:{risk:'balanced'},limbo:{target:2},hilo:{direction:'high'},keno:{selected:[1,2,3,4,5]},baccarat:{bet:'banker'},bigwheel:{choice:1},sicbo:{bet:{type:'small'}},tower:{risk:'medium'},penalty:{series:1}}

function terminalVector(gameId){
 const rng=new FairRng(SEED,CLIENT,7),state=createGameState(gameId,STAKE,options[gameId]||{},rng)
 if(state.kind==='instant')return state.outcome
 if(gameId==='crash')return{payoutCents:state.crashAt>=2?2000:0,result:{crashAt:state.crashAt}}
 if(gameId==='mines'){const cell=Array.from({length:25},(_,i)=>i).find(i=>!state.mines.includes(i));performGameAction(gameId,STAKE,state,{action:'reveal',cell});return performGameAction(gameId,STAKE,state,{action:'cashout'})}
 if(gameId==='hilo')return performGameAction(gameId,STAKE,state,{action:state.current===14?'low':'high'})
 if(gameId==='blackjack')return performGameAction(gameId,STAKE,state,{action:'stand'})
 if(gameId==='war')return performGameAction(gameId,STAKE,state,{action:state.tie?'surrender':'resolve'})
 if(gameId==='scratch'){let result;for(let cell=0;cell<9;cell++)result=performGameAction(gameId,STAKE,state,{action:'reveal',cell});return result}
 if(gameId==='videopoker')return performGameAction(gameId,STAKE,state,{action:'draw',holds:[]})
 if(gameId==='tower'){const tile=[0,1,2,3].find(v=>!state.traps[0].includes(v));performGameAction(gameId,STAKE,state,{action:'reveal',tile});return performGameAction(gameId,STAKE,state,{action:'cashout'})}
 if(gameId==='penalty'){const zone=[0,1,2].find(v=>v!==state.keepers[0]);return performGameAction(gameId,STAKE,state,{action:'kick',zone})}
 if(gameId==='threecardpoker')return performGameAction(gameId,STAKE,state,{action:'fold'})
 throw Error(gameId)
}

test('les vingt jeux ont des règles, limites et RTP documentés',()=>{assert.equal(SUPPORTED_GAMES.length,20);assert.equal(Object.keys(GAME_RULES).length,20);for(const game of SUPPORTED_GAMES){const r=GAME_RULES[game];assert.equal(r.minStake,1);assert.equal(r.maxStake,1000);assert.ok(r.rtp>0&&r.rtp<=1)}})
test('mise hors limites refusée',()=>{const rng=new FairRng(SEED,CLIENT,0);assert.throws(()=>resolveInstantRound('coinflip',99,{choice:'face'},rng),/Mise invalide/);assert.throws(()=>resolveInstantRound('coinflip',100001,{choice:'face'},rng),/Mise invalide/)})
test('payout monétaire arrondi en centimes par half-up',()=>assert.equal(payoutFromMultiplier(1001,1.25),1251))
test('Crash et Mines suivent leurs courbes',()=>{assert.ok(crashMultiplier(1000)>crashMultiplier(100));assert.ok(minesMultiplier(5)>minesMultiplier(1))})

test('provably fair: hash, HMAC et valeur sont recalculables',()=>{const fair=createFairContext(CLIENT,4,SEED),value=fair.rng.float();assert.equal(fair.serverSeedHash,createHash('sha256').update(SEED).digest('hex'));assert.equal(value,fairFloat(SEED,CLIENT,4,0));assert.ok(verifyFairEvent({serverSeed:SEED,serverSeedHash:fair.serverSeedHash,clientSeed:CLIENT,nonce:4,cursor:0,value}))})

for(const gameId of SUPPORTED_GAMES)test(`vecteur déterministe ${gameId}`,()=>{const first=terminalVector(gameId),second=terminalVector(gameId);assert.deepEqual(first,second);assert.ok(Number.isSafeInteger(first.payoutCents));assert.ok(first.payoutCents>=0);const fingerprint=createHash('sha256').update(JSON.stringify(first)).digest('hex');assert.equal(fingerprint.length,64)})

test('Monte-Carlo des jeux instantanés converge vers la table déclarée',()=>{
 const cases=[['coinflip',{choice:'face'},.99],['dice',{chance:50},.99],['roulette',{bet:{type:'red'}},36/37],['jackpot',{},.92],['plinko',{risk:'balanced'},.97],['limbo',{target:2},.99],['keno',{selected:[1,2,3,4,5]},GAME_RULES.keno.rtp],['baccarat',{bet:'banker'},GAME_RULES.baccarat.rtpByBet.banker],['bigwheel',{choice:1},1200/1295],['sicbo',{bet:{type:'small'}},210/216]]
 for(const[gameId,opts,expected]of cases){const rng=new FastRng(gameId.length*7919);let returned=0;const count=500000;for(let i=0;i<count;i++)returned+=resolveInstantRound(gameId,100,opts,rng).payoutCents;const observed=returned/(count*100);assert.ok(Math.abs(observed-expected)<=.005,`${gameId}: ${observed} vs ${expected}`)}
})

test('Monte-Carlo des jeux progressifs à cote mathématique converge à ±0,5 %',()=>{
 const cases=['crash','mines','hilo','scratch','tower','penalty']
 for(const gameId of cases){const rng=new FastRng(gameId.length*104729);let returned=0;const count=250000,stake=10000;for(let i=0;i<count;i++){const state=createGameState(gameId,stake,options[gameId]||{},rng);if(gameId==='crash')returned+=state.crashAt>=2?stake*2:0;else if(gameId==='mines'){if(state.mines.includes(0))continue;performGameAction(gameId,stake,state,{action:'reveal',cell:0});returned+=performGameAction(gameId,stake,state,{action:'cashout'}).payoutCents}else if(gameId==='hilo'){const action=state.current===14?'low':state.current===2?'high':state.current>=8?'low':'high';returned+=performGameAction(gameId,stake,state,{action}).payoutCents}else if(gameId==='scratch'){let outcome;for(let cell=0;cell<9;cell++)outcome=performGameAction(gameId,stake,state,{action:'reveal',cell});returned+=outcome.payoutCents}else if(gameId==='tower'){if(state.traps[0].includes(0))continue;performGameAction(gameId,stake,state,{action:'reveal',tile:0});returned+=performGameAction(gameId,stake,state,{action:'cashout'}).payoutCents}else returned+=performGameAction(gameId,stake,state,{action:'kick',zone:0}).payoutCents}const observed=returned/(count*stake);assert.ok(Math.abs(observed-GAME_RULES[gameId].rtp)<=.005,`${gameId}: ${observed} vs ${GAME_RULES[gameId].rtp}`)}
})
