import { useState } from 'react'
import { ArrowDown, ArrowUp, Layers3 } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { rankLabel } from '../components/PlayingCard'
import { wait, BetPanel, Cta, GameFrame, ResultBanner, Stat, toneOf } from './kit'

const LOW=2,HIGH=14,POOL=HIGH-LOW // 12 valeurs possibles : la carte courante ne peut pas ressortir

/** Probabilité et multiplicateur de chaque direction, avec la formule du serveur (0,99 ÷ probabilité). */
function odds(current:number){
 const high=HIGH-current,low=current-LOW
 const mult=(wins:number)=>wins?Number((.99/(wins/POOL)).toFixed(4)):0
 return {high:{wins:high,chance:high/POOL*100,mult:mult(high)},low:{wins:low,chance:low/POOL*100,mult:mult(low)}}
}

function ValueCard({rank,back,size='md',tone}:{rank?:number;back?:boolean;size?:'sm'|'md';tone?:'win'|'loss'}){
 return (
  <span className={`hl-card ${size}${back?' back':''}${tone?` ${tone}`:''}`} role="img" aria-label={back||!rank?'Carte cachée':`Carte ${rankLabel(rank)}`}>
   {!back&&rank&&<><b className="hl-corner">{rankLabel(rank)}</b><b className="hl-center">{rankLabel(rank)}</b><b className="hl-corner flip">{rankLabel(rank)}</b></>}
  </span>
 )
}

export function HiLoGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[revealing,setRevealing]=useState(false),[trail,setTrail]=useState<number[]>([])
 const current=live?Number((live.state as {current?:number}|null)?.current):settled?Number((round?.result as {card?:number}|null)?.card):null
 const next=settled?Number((round?.result as {next?:number}|null)?.next):null
 const direction=settled?(round?.result as {direction?:'high'|'low'}|null)?.direction:undefined
 const chances=current?odds(current):null

 const deal=()=>{const amount=validStake(stake,balance);if(amount){setTrail([]);void start(amount)}}
 const guess=async(side:'high'|'low')=>{
  if(!live||busy)return
  setRevealing(true)
  const result=await act(side)
  if(result){const card=Number((result.result as {card?:number}|null)?.card),nxt=Number((result.result as {next?:number}|null)?.next);setTrail((items)=>[...items,card,nxt].slice(-8));await wait(650)}
  setRevealing(false)
 }
 const done=settled&&!revealing
 return (
  <GameFrame game={game} tone={live?'live':done?toneOf(true,net):'idle'} status={live?'À vous de choisir':revealing?'Carte en cours…':done?(net>0?'Gagné':'Perdu'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy||revealing}
    cta={live&&chances?<div className="gx-cta-row">
      <Cta hotkey={false} disabled={busy||!chances.high.wins} onClick={()=>void guess('high')}><ArrowUp size={18} aria-hidden="true"/>Plus haut</Cta>
      <Cta hotkey={false} disabled={busy||!chances.low.wins} onClick={()=>void guess('low')}><ArrowDown size={18} aria-hidden="true"/>Plus bas</Cta>
     </div>:<Cta disabled={busy||revealing||!validStake(stake,balance)} onClick={deal}><Layers3 size={19} aria-hidden="true"/>{settled?'Nouvelle carte':'Distribuer'}</Cta>}
    note="Une seule prédiction par partie. Plus votre choix est improbable, plus le gain est élevé."/>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`${rankLabel(current??0)} → ${rankLabel(next??0)} · ${direction==='high'?'plus haut':'plus bas'}`}/>}
   <div className="hl-table">
    <div className="hl-slot"><span className="hl-cap">Carte actuelle</span>{current?<ValueCard rank={current}/>:<ValueCard back/>}</div>
    <div className="hl-vs" aria-hidden="true">{direction==='high'||(!settled&&live)?<ArrowUp/>:<ArrowDown/>}</div>
    <div className="hl-slot"><span className="hl-cap">Carte suivante</span>
     <span className={`hl-flip${settled&&!revealing?' open':''}`}><ValueCard back/><ValueCard rank={next??undefined} tone={settled&&!revealing?(net>0?'win':'loss'):undefined}/></span>
    </div>
   </div>
   {chances&&(live||settled)?<div className="hl-odds">
    <div className={`hl-odd${direction==='high'?' picked':''}`}><ArrowUp size={18} aria-hidden="true"/><span>Plus haut</span><b>{chances.high.wins?`${chances.high.mult.toFixed(2)}×`:'Impossible'}</b><small>{chances.high.chance.toFixed(1)} %{chances.high.wins&&chances.high.mult<1?' · gain inférieur à la mise':''}</small></div>
    <div className={`hl-odd${direction==='low'?' picked':''}`}><ArrowDown size={18} aria-hidden="true"/><span>Plus bas</span><b>{chances.low.wins?`${chances.low.mult.toFixed(2)}×`:'Impossible'}</b><small>{chances.low.chance.toFixed(1)} %{chances.low.wins&&chances.low.mult<1?' · gain inférieur à la mise':''}</small></div>
   </div>:<div className="gx-stats"><Stat label="Valeurs" value="2 → As"/><Stat label="Retour" value="99 %" tone="gold"/><Stat label="Même valeur" value="Impossible"/></div>}
   {trail.length>0&&<ol className="hl-trail" aria-label="Dernières cartes">{trail.map((rank,index)=><li key={index}>{rankLabel(rank)}</li>)}</ol>}
  </GameFrame>
 )
}
