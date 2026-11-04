import { useEffect, useRef, useState } from 'react'
import { Dices } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { money } from '../lib/format'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, GameFrame, ResultBanner, Stat, toneOf } from './kit'

const MIN=5,MAX=95
const clamp=(value:number)=>Math.min(MAX,Math.max(MIN,Math.round(value)))

/** Curseur de seuil : glisser, clavier (flèches, Maj ×10, Début/Fin). */
function ThresholdSlider({value,onChange,disabled,pin,pinTone}:{value:number;onChange:(value:number)=>void;disabled:boolean;pin:number|null;pinTone:'win'|'loss'|''}){
 const track=useRef<HTMLDivElement>(null)
 const fromPointer=(clientX:number)=>{const rect=track.current?.getBoundingClientRect();if(rect)onChange(clamp((clientX-rect.left)/rect.width*100))}
 const onKey=(event:React.KeyboardEvent)=>{
  const step=event.shiftKey?10:1
  const map:Record<string,number>={ArrowLeft:value-step,ArrowDown:value-step,ArrowRight:value+step,ArrowUp:value+step,Home:MIN,End:MAX,PageDown:value-10,PageUp:value+10}
  if(event.key in map){event.preventDefault();onChange(clamp(map[event.key]))}
 }
 return (
  <div className="dice-rail">
   <div className="dice-track" ref={track} onPointerDown={(event)=>{if(disabled)return;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);fromPointer(event.clientX)}} onPointerMove={(event)=>{if(!disabled&&event.buttons===1)fromPointer(event.clientX)}}>
    <i className="dice-zone win" style={{width:`${value}%`}}/>
    <i className="dice-zone lose" style={{left:`${value}%`}}/>
    {pin!==null&&<span className={`dice-pin ${pinTone}`} style={{left:`${pin}%`}} aria-hidden="true"><b>{pin.toFixed(2)}</b></span>}
    <span className="dice-handle" role="slider" tabIndex={disabled?-1:0} aria-label="Seuil de victoire" aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={value} aria-valuetext={`Gagnez sous ${value}`} aria-disabled={disabled} style={{left:`${value}%`}} onKeyDown={onKey}><i/><i/><i/></span>
   </div>
   <div className="dice-ticks" aria-hidden="true">{[0,25,50,75,100].map((tick)=><span key={tick} style={{left:`${tick}%`}}>{tick}</span>)}</div>
  </div>
 )
}

export function DiceGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[chance,setChance]=useState(50)
 const [shown,setShown]=useState<number|null>(null),[pin,setPin]=useState<number|null>(null),[rolling,setRolling]=useState(false)
 const stop=useRef<()=>void>(()=>undefined)
 useEffect(()=>()=>stop.current(),[])
 const multiplier=Number((99/chance).toFixed(4))
 const amount=Number(stake)||0

 const roll=async()=>{
  const bet=validStake(stake,balance);if(!bet||busy||rolling)return
  setRolling(true);setPin(null)
  const next=await start(bet,{chance})
  if(!next){setRolling(false);return}
  const final=Number(next.result?.roll)
  let frame=0
  // Les chiffres défilent puis se figent sur le tirage du serveur.
  stop.current=animate(900,(t)=>{frame+=1;if(t<.82){if(frame%3===0)setShown(Math.random()*100)}else setShown(final)},()=>{setShown(final);setPin(final);window.setTimeout(()=>setRolling(false),550)})
 }

 const done=!rolling&&settled&&pin!==null
 const win=done&&net>0
 const tone=done?toneOf(true,net):rolling?'live':'idle'
 return (
  <GameFrame game={game} tone={tone} status={rolling?'Lancer en cours':done?(win?'Gagné':'Perdu'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||rolling}
    cta={<Cta disabled={busy||rolling||!validStake(stake,balance)} onClick={()=>void roll()}><Dices size={19} aria-hidden="true"/>{busy||rolling?'Lancer…':'Lancer les dés'}</Cta>}
    note="Faites glisser le curseur : plus le seuil est bas, plus le gain est élevé."/>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`Tirage ${pin!.toFixed(2)} · seuil ${chance}`}/>}
   <div className={`dice-readout${done?(win?' win':' loss'):''}${rolling?' rolling':''}`} aria-live="off">
    <span className="dice-readout-label">{done?(win?'Sous le seuil':'Au-dessus du seuil'):'Résultat'}</span>
    <strong className={shown===null?'idle':''}>{(shown??0).toFixed(2)}</strong>
   </div>
   <ThresholdSlider value={chance} onChange={setChance} disabled={busy||rolling} pin={done||rolling?pin:null} pinTone={done?(win?'win':'loss'):''}/>
   <div className="gx-stats">
    <Stat label="Multiplicateur" value={`${multiplier.toFixed(2)}×`} tone="gold"/>
    <Stat label="Chance de gain" value={`${chance} %`}/>
    <Stat label="Gain possible" value={money(amount*multiplier)} tone="win"/>
   </div>
  </GameFrame>
 )
}
