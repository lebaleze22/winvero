import { useEffect, useState, useSyncExternalStore } from 'react'
import { BadgeCheck, ShieldAlert } from 'lucide-react'
import type { ServerRound } from '../services/gameApi'
import { money } from '../lib/format'
import { verifyCommitment } from '../lib/fair'

/** Dernières parties réglées de la session, en mémoire (jamais persistées côté navigateur). */
const MAX=8
let rounds:Record<string,ServerRound[]>={}
const listeners=new Set<()=>void>()
const emit=()=>listeners.forEach((listener)=>listener())

export function recordSettledRound(round:ServerRound){
 if(round.status!=='settled')return
 const list=rounds[round.gameId]??[]
 if(list.some((item)=>item.id===round.id))return
 rounds={...rounds,[round.gameId]:[round,...list].slice(0,MAX)}
 emit()
}
export function clearRoundHistory(){rounds={};emit()}

const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
export const useRounds=(gameId:string)=>useSyncExternalStore(subscribe,()=>rounds[gameId])

export function RoundHistory({gameId}:{gameId:string}){
 const list=useRounds(gameId)
 const latest=list?.[0]
 const [proof,setProof]=useState<'checking'|'ok'|'bad'|'none'>('none')
 const seed=latest?.fair?.serverSeed,hash=latest?.fair?.serverSeedHash
 useEffect(()=>{
  if(!seed||!hash){setProof('none');return}
  let active=true;setProof('checking')
  void verifyCommitment(seed,hash).then((ok)=>{if(active)setProof(ok?'ok':'bad')})
  return()=>{active=false}
 },[seed,hash])
 if(!list?.length)return null
 return (
  <div className="round-log">
   <span className="page-kicker">DERNIÈRES PARTIES</span>
   <ol aria-label="Dernières parties">
    {list.map((round)=>{const tone=round.payout>round.stake?'win':round.payout<round.stake?'loss':'push';return(
     <li key={round.id} className={tone} title={`Mise ${money(round.stake)} · paiement ${money(round.payout)}`}>
      <b>{round.multiplier.toFixed(2)}×</b><span>{money(round.payout)}</span>
     </li>)})}
   </ol>
   {proof!=='none'&&(
    <p className={`proof ${proof}`} role="status">
     {proof==='ok'?<><BadgeCheck size={15}/> Engagement vérifié : la graine du serveur correspond à l’empreinte publiée avant la partie.</>
      :proof==='bad'?<><ShieldAlert size={15}/> L’empreinte ne correspond pas. Signalez-le.</>:'Vérification de l’équité…'}
    </p>
   )}
  </div>
 )
}
