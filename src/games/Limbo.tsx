import { useEffect, useRef, useState } from 'react'
import { Gauge } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { money } from '../lib/format'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, GameFrame, ResultBanner, Stat, toneOf } from './kit'

const MIN=1.1,MAX=50,SCALE_MAX=100
const pos=(value:number)=>Math.min(100,Math.log(Math.max(1,value))/Math.log(SCALE_MAX)*100)
const clampTarget=(value:number)=>Math.min(MAX,Math.max(MIN,value))

export function LimboGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[target,setTarget]=useState('2.00'),[rolling,setRolling]=useState(false),[outcome,setOutcome]=useState<number|null>(null)
 const readout=useRef<HTMLElement>(null),fill=useRef<HTMLDivElement>(null),stop=useRef<()=>void>(()=>undefined)
 useEffect(()=>()=>stop.current(),[])
 const goal=Number(target),valid=goal>=MIN&&goal<=MAX
 const chance=valid?99/goal:0

 const play=async()=>{
  const bet=validStake(stake,balance);if(!bet||!valid||busy||rolling)return
  setRolling(true);setOutcome(null)
  const next=await start(bet,{target:clampTarget(goal)})
  if(!next){setRolling(false);return}
  const result=Math.max(1,Number(next.result?.outcome))
  // Le compteur grimpe jusqu'au résultat du serveur sur une échelle logarithmique.
  stop.current=animate(900+Math.log10(result)*650,(t)=>{
   const e=1-Math.pow(1-t,3),value=Math.exp(Math.log(result)*e)
   if(readout.current)readout.current.textContent=`${value.toFixed(2)}×`
   if(fill.current)fill.current.style.width=`${pos(value)}%`
  },()=>{setOutcome(result);setRolling(false)})
 }
 const done=!rolling&&outcome!==null&&settled
 const win=done&&net>0
 return (
  <GameFrame game={game} tone={rolling?'live':done?toneOf(true,net):'idle'} status={rolling?'Tirage en cours':done?(win?'Gagné':'Perdu'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||rolling}
    cta={<Cta disabled={busy||rolling||!valid||!validStake(stake,balance)} onClick={()=>void play()}><Gauge size={19} aria-hidden="true"/>{rolling?'Tirage…':'Défier la limite'}</Cta>}
    note="Le serveur tire un multiplicateur : si il atteint votre cible, vous gagnez mise × cible.">
    <div className="gx-field">
     <div className="gx-field-head"><label htmlFor="limbo-target">Multiplicateur cible</label><span className="gx-balance">1,10 – 50</span></div>
     <div className="gx-stake">
      <input id="limbo-target" type="number" min={MIN} max={MAX} step="0.1" value={target} disabled={busy||rolling} onChange={(event)=>setTarget(event.target.value)} aria-invalid={!valid}/>
      <span className="gx-unit">×</span>
      <button type="button" disabled={busy||rolling} aria-label="Diminuer la cible" onClick={()=>setTarget(clampTarget(Math.round((goal-.5)*100)/100).toFixed(2))}>−</button>
      <button type="button" disabled={busy||rolling} aria-label="Augmenter la cible" onClick={()=>setTarget(clampTarget(Math.round((goal+.5)*100)/100).toFixed(2))}>+</button>
     </div>
     <div className="gx-chips" role="group" aria-label="Cibles rapides">{[1.5,2,3,5,10].map((value)=><button key={value} type="button" disabled={busy||rolling} className={goal===value?'on':''} onClick={()=>setTarget(value.toFixed(2))}>{value}×</button>)}</div>
    </div>
   </BetPanel>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`Résultat ${outcome!.toFixed(2)}× · cible ${goal.toFixed(2)}×`}/>}
   <div className={`lb-readout${done?(win?' win':' loss'):''}`}>
    <span className="lb-label">{done?(win?'Cible atteinte':'Cible manquée'):rolling?'Le multiplicateur monte…':'Multiplicateur'}</span>
    <strong ref={readout}>{outcome!==null?`${outcome.toFixed(2)}×`:'1.00×'}</strong>
   </div>
   <div className="lb-rail" role="img" aria-label={`Échelle des multiplicateurs, cible ${valid?goal.toFixed(2):'invalide'}×`}>
    <div className="lb-track"><div className={`lb-fill${done?(win?' win':' loss'):''}`} ref={fill} style={{width:`${outcome!==null?pos(outcome):0}%`}}/>
     {valid&&<span className="lb-target" style={{left:`${pos(goal)}%`}}><b>{goal.toFixed(2)}×</b></span>}
    </div>
    <div className="lb-ticks" aria-hidden="true">{[1,2,5,10,25,50,100].map((tick)=><span key={tick} style={{left:`${pos(tick)}%`}}>{tick}×</span>)}</div>
   </div>
   <div className="gx-stats">
    <Stat label="Cible" value={valid?`${goal.toFixed(2)}×`:'—'} tone="gold"/>
    <Stat label="Chance de gain" value={valid?`${chance.toFixed(2)} %`:'—'}/>
    <Stat label="Gain possible" value={valid?money((Number(stake)||0)*goal):'—'} tone="win"/>
   </div>
  </GameFrame>
 )
}
