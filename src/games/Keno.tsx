import { useEffect, useRef, useState } from 'react'
import { Grid3X3, Shuffle, X } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { BetPanel, Cta, GameFrame, ResultBanner, toneOf, wait } from './kit'

const NUMBERS=20,PICKS=5
/** Table du serveur : gain selon le nombre de numéros trouvés. */
const PAYTABLE=[0,0,2,5,10,100]

export function KenoGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[picked,setPicked]=useState<number[]>([]),[drawn,setDrawn]=useState<number[]>([]),[drawing,setDrawing]=useState(false)
 const alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const hits=drawn.filter((value)=>picked.includes(value)).length
 const result=settled?(round?.result as {drawn?:number[];selected?:number[]}|null):null

 const toggle=(value:number)=>setPicked((items)=>items.includes(value)?items.filter((item)=>item!==value):items.length<PICKS?[...items,value]:items)
 const quick=()=>setPicked(Array.from({length:NUMBERS},(_,i)=>i+1).sort(()=>Math.random()-.5).slice(0,PICKS).sort((a,b)=>a-b))

 const play=async()=>{
  const amount=validStake(stake,balance);if(!amount||picked.length!==PICKS||busy||drawing)return
  setDrawing(true);setDrawn([])
  const next=await start(amount,{selected:picked});if(!next){setDrawing(false);return}
  const numbers=((next.result as {drawn:number[]}).drawn)||[]
  // Les boules sortent une à une.
  for(const value of numbers){await wait(380);if(!alive.current)return;setDrawn((items)=>[...items,value])}
  await wait(350);if(alive.current)setDrawing(false)
 }
 const done=!drawing&&!!result
 const status=drawing?`Tirage : ${drawn.length} / ${PICKS}`:done?`${hits} trouvé${hits>1?'s':''}`:picked.length===PICKS?'Grille prête':`Choisissez ${PICKS-picked.length} numéro${PICKS-picked.length>1?'s':''}`
 return (
  <GameFrame game={game} tone={drawing?'live':done?toneOf(true,net):'idle'} status={status}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||drawing}
    cta={<>
      <Cta disabled={busy||drawing||picked.length!==PICKS||!validStake(stake,balance)} onClick={()=>void play()}><Grid3X3 size={19} aria-hidden="true"/>{drawing?'Tirage…':picked.length===PICKS?'Tirer 5 numéros':`Encore ${PICKS-picked.length} à choisir`}</Cta>
      <div className="gx-cta-row">
       <Cta variant="ghost" disabled={busy||drawing} onClick={quick}><Shuffle size={15} aria-hidden="true"/>Au hasard</Cta>
       <Cta variant="ghost" disabled={busy||drawing||!picked.length} onClick={()=>{setPicked([]);setDrawn([])}}><X size={15} aria-hidden="true"/>Effacer</Cta>
      </div>
     </>}
    note="Choisissez 5 numéros sur 20 : le serveur en tire 5. Plus vous en trouvez, plus le gain grimpe."/>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`${hits} numéro${hits>1?'s':''} trouvé${hits>1?'s':''} sur ${PICKS}`}/>}
   <div className="kn-board" role="group" aria-label="Grille de 20 numéros">
    {Array.from({length:NUMBERS},(_,index)=>{
     const value=index+1,isPicked=picked.includes(value),isDrawn=drawn.includes(value),isHit=isPicked&&isDrawn
     return <button key={value} type="button" disabled={busy||drawing} aria-pressed={isPicked} aria-label={`Numéro ${value}${isPicked?', choisi':''}${isDrawn?', tiré':''}${isHit?', trouvé':''}`} onClick={()=>toggle(value)} className={`kn-ball${isPicked?' picked':''}${isDrawn?' drawn':''}${isHit?' hit':''}`}>{value}</button>
    })}
   </div>
   <div className="kn-pay" aria-label="Table des gains">
    {PAYTABLE.map((multiplier,count)=><div key={count} className={`kn-pay-cell${(drawing||done)&&hits===count?' on':''}${multiplier===0?' zero':''}`}><small>{count} trouvé{count>1?'s':''}</small><b>{multiplier}×</b></div>)}
   </div>
  </GameFrame>
 )
}
