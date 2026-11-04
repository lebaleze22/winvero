import { useCallback, useMemo, useRef, useState } from 'react'
import type { GameDefinition } from '../data/games'
import { actOnGameRound, getGameRound, startGameRound, type ServerRound } from '../services/gameApi'
import { getCreditOverview } from '../services/creditApi'
import { useWinveroStore } from '../store/useWinveroStore'
import { money } from '../lib/format'
import { recordSettledRound } from './RoundHistory'

export const validStake = (stake:string,balance:number) => { const value=Number(stake); return value>0&&value<=balance?value:0 }
export const pause = (delay:number) => new Promise((resolve)=>window.setTimeout(resolve,delay))

export function useServerGame(game:GameDefinition) {
  const sync=useWinveroStore((state)=>state.syncServerBalance)
  const setOverview=useWinveroStore((state)=>state.setCreditOverview)
  const [error,setError]=useState('')
  const commit=useCallback((round:ServerRound)=>{
    sync(round.balance)
    recordSettledRound(round)
    if(round.status==='settled')void getCreditOverview().then(setOverview).catch(()=>undefined)
    return round
  },[setOverview,sync])
  const execute=useCallback(async(task:()=>Promise<ServerRound>)=>{
    setError('')
    try{return commit(await task())}catch(reason){setError(reason instanceof Error?reason.message:'Action impossible');return null}
  },[commit])
  const start=useCallback((stake:number,options:Record<string,unknown>={})=>execute(()=>startGameRound(game.id,stake,options)),[execute,game.id])
  const act=useCallback((roundId:string,action:string,extra:Record<string,unknown>={})=>execute(()=>actOnGameRound(roundId,action,extra)),[execute])
  const read=useCallback((roundId:string)=>execute(()=>getGameRound(roundId)),[execute])
  return useMemo(()=>({error,start,act,read}),[act,error,read,start])
}

export const signedMoney=(value:number)=>value>0?`+${money(value)}`:value<0?`−${money(Math.abs(value))}`:money(0)

/** Cycle de vie commun d'une partie : démarrage, actions, solde avant/après pour afficher le gain net. */
export function useRoundGame(game:GameDefinition){
 const balance=useWinveroStore((s)=>s.balance),engine=useServerGame(game)
 const [round,setRound]=useState<ServerRound|null>(null),[busy,setBusy]=useState(false)
 const before=useRef(0)
 const start=useCallback(async(stake:number,options:Record<string,unknown>={})=>{
  if(busy)return null
  setBusy(true);before.current=useWinveroStore.getState().balance
  const next=await engine.start(stake,options);if(next)setRound(next);setBusy(false);return next
 },[busy,engine])
 const act=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
  if(!round||busy)return null
  setBusy(true);const next=await engine.act(round.id,action,extra);if(next)setRound(next);setBusy(false);return next
 },[busy,engine,round])
 const settled=round?.status==='settled'
 const net=settled&&round?Number((round.balance-before.current).toFixed(2)):0
 return {balance,engine,round,busy,start,act,settled,net,live:round?.status==='active'?round:null,reset:()=>setRound(null)}
}

export function netTone(settled:boolean,net:number):'win'|'loss'|''{return settled?(net>0?'win':net<0?'loss':''):''}
export function netHeadline(net:number){return net===0?'ÉGALITÉ':signedMoney(net)}
