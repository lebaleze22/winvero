import { useEffect, useRef, useState } from 'react'
import { Coins } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, easeOutQuart, GameFrame, ResultBanner, Segmented, toneOf } from './kit'

type Side='face'|'pile'
const LABEL:Record<Side,string>={face:'Face',pile:'Pile'}

export function CoinFlipGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[choice,setChoice]=useState<Side>('face'),[flipping,setFlipping]=useState(false),[landed,setLanded]=useState<Side|null>(null)
 const coin=useRef<HTMLDivElement>(null),shadow=useRef<HTMLDivElement>(null),angle=useRef(0),stop=useRef<()=>void>(()=>undefined)
 useEffect(()=>()=>stop.current(),[])

 const flip=async()=>{
  const bet=validStake(stake,balance);if(!bet||busy||flipping)return
  setFlipping(true);setLanded(null)
  const next=await start(bet,{choice});if(!next){setFlipping(false);return}
  const result=next.result?.landed as Side
  // La pièce monte, tourne plusieurs fois et retombe sur la face tirée par le serveur.
  const from=angle.current,want=result==='pile'?180:0
  let to=from+6*360;to+=((want-(to%360))+360)%360
  angle.current=to
  stop.current=animate(1900,(t)=>{
   const e=easeOutQuart(t),lift=Math.sin(Math.PI*Math.min(1,t*1.15))*150
   if(coin.current)coin.current.style.transform=`translateY(${-lift}px) rotateX(${from+(to-from)*e}deg)`
   if(shadow.current)shadow.current.style.transform=`scale(${1-lift/260})`
  },()=>{
   setLanded(result);setFlipping(false)
  })
 }
 const done=!flipping&&settled&&landed!==null
 return (
  <GameFrame game={game} tone={flipping?'live':done?toneOf(true,net):'idle'} status={flipping?'La pièce tourne':done?(net>0?'Gagné':'Perdu'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||flipping}
    cta={<Cta disabled={busy||flipping||!validStake(stake,balance)} onClick={()=>void flip()}><Coins size={19} aria-hidden="true"/>{flipping?'La pièce tourne…':'Lancer la pièce'}</Cta>}
    note="Bon choix : mise × 1,98. Une chance sur deux à chaque lancer.">
    <Segmented label="Votre côté" value={choice} onChange={setChoice} disabled={busy||flipping} options={[{value:'face',label:'Face',hint:'1,98×'},{value:'pile',label:'Pile',hint:'1,98×'}]}/>
   </BetPanel>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`${LABEL[landed!]} · vous aviez choisi ${LABEL[choice]}`}/>}
   <div className="cf-stage">
    <div className="cf-coin" ref={coin}>
     <div className="cf-face front"><b>W</b><small>FACE</small></div>
     <div className="cf-face back"><b>★</b><small>PILE</small></div>
     <span className="cf-edge" aria-hidden="true"/>
    </div>
    <div className="cf-shadow" ref={shadow} aria-hidden="true"/>
   </div>
   <div className="cf-sides" aria-hidden="true"><span className={choice==='face'?'on':''}>Face</span><i>VS</i><span className={choice==='pile'?'on':''}>Pile</span></div>
  </GameFrame>
 )
}
