import { useEffect, useRef, useState } from 'react'
import { Disc3, Dices } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, easeOutQuart, GameFrame, ResultBanner, toneOf } from './kit'
import { Chip } from './cards'

/* ------------------------------------------------------------------ */
/*  Grande Roue                                                        */
/* ------------------------------------------------------------------ */
// 30 secteurs, répartis comme les poids du serveur (600/300/200/109/57/29).
const SEGMENTS=[1,3,1,5,1,3,1,10,1,3,1,5,1,3,1,20,1,3,1,5,1,3,1,10,1,3,5,1,3,40]
const COLORS:Record<number,string>={1:'#2f6df0',3:'#17a88f',5:'#9b4dff',10:'#ee3c9c',20:'#ff9d3d',40:'#ffd24a'}
const CHANCE:Record<number,string>={1:'46,3 %',3:'23,2 %',5:'15,4 %',10:'8,4 %',20:'4,4 %',40:'2,2 %'}
const SLICE=360/SEGMENTS.length
const pt=(angle:number,radius:number)=>{const a=(angle-90)*Math.PI/180;return[150+radius*Math.cos(a),150+radius*Math.sin(a)] as const}
const slicePath=(index:number)=>{const a0=index*SLICE,a1=(index+1)*SLICE,[x0,y0]=pt(a0,140),[x1,y1]=pt(a1,140),[x2,y2]=pt(a1,44),[x3,y3]=pt(a0,44);return `M${x0} ${y0}A140 140 0 0 1 ${x1} ${y1}L${x2} ${y2}A44 44 0 0 0 ${x3} ${y3}Z`}

export function BigWheelGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[choice,setChoice]=useState(1),[spinning,setSpinning]=useState(false),[landed,setLanded]=useState<number|null>(null),[tick,setTick]=useState(0)
 const wheel=useRef<SVGGElement>(null),angle=useRef(0),stop=useRef<()=>void>(()=>undefined),lastTick=useRef(-1)
 useEffect(()=>()=>stop.current(),[])

 const spin=async()=>{
  const bet=validStake(stake,balance);if(!bet||busy||spinning)return
  setSpinning(true);setLanded(null)
  const next=await start(bet,{choice});if(!next){setSpinning(false);return}
  const value=(next.result as {landed:number}).landed
  const candidates=SEGMENTS.map((item,index)=>item===value?index:-1).filter((index)=>index>=0)
  const target=candidates[Math.floor(Math.random()*candidates.length)]
  const from=angle.current
  let to=from+360*6;to+=(((-(target+.5)*SLICE)-(to%360))%360+360)%360
  angle.current=to
  stop.current=animate(5600,(t)=>{
   const w=from+(to-from)*easeOutQuart(t)
   wheel.current?.setAttribute('transform',`rotate(${w} 150 150)`)
   const crossed=Math.floor(w/SLICE)
   if(crossed!==lastTick.current){lastTick.current=crossed;setTick(crossed%2)}
  },()=>{setLanded(value);setSpinning(false)})
 }
 const done=!spinning&&settled&&landed!==null
 return (
  <GameFrame game={game} tone={spinning?'live':done?toneOf(true,net):'idle'} status={spinning?'La roue tourne':done?`${landed}×${landed===choice?' · votre secteur':''}`:'Choisissez un secteur'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||spinning}
    cta={<Cta disabled={busy||spinning||!validStake(stake,balance)} onClick={()=>void spin()}><Disc3 size={19} aria-hidden="true"/>{spinning?'La roue tourne…':'Lancer la roue'}</Cta>}
    note="Si la roue s’arrête sur votre secteur, vous gagnez mise × (secteur + 1)."/>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={landed===choice?`Secteur ${landed}× touché`:`La roue s’arrête sur ${landed}×`}/>}
   <div className="bw-wheel-wrap">
    <svg className="bw-wheel" viewBox="0 0 300 300" role="img" aria-label="Grande roue à 30 secteurs">
     <circle cx="150" cy="150" r="148" fill="#2a1a08"/><circle cx="150" cy="150" r="144" fill="#d9b36a"/>
     <g ref={wheel}>
      {SEGMENTS.map((value,index)=>{const [tx,ty]=pt((index+.5)*SLICE,118);return <g key={index}><path d={slicePath(index)} fill={COLORS[value]} stroke="rgba(255,255,255,.55)" strokeWidth=".8"/><text x={tx} y={ty} fill="#fff" fontSize={value>=10?12:11} fontWeight="800" textAnchor="middle" dominantBaseline="central" transform={`rotate(${(index+.5)*SLICE} ${tx} ${ty})`} fontFamily="JetBrains Mono,monospace">{value}</text></g>})}
      <circle cx="150" cy="150" r="44" fill="#1a1230" stroke="#d9b36a" strokeWidth="2"/>
     </g>
     <text x="150" y="150" textAnchor="middle" dominantBaseline="central" fill="#f0d796" fontSize="26" fontWeight="700" fontFamily="Fraunces,serif">{done&&landed?`${landed}×`:'W'}</text>
     <g className={`bw-flap${tick?' a':' b'}`}><path d="M137 -4 L163 -4 L150 28 Z" fill="#ff3d6e" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/></g>
    </svg>
   </div>
   <div className="bw-bets" role="radiogroup" aria-label="Votre secteur">
    {[1,3,5,10,20,40].map((value)=>(
     <button key={value} type="button" role="radio" aria-checked={choice===value} disabled={busy||spinning} className={`bw-bet${choice===value?' on':''}${done&&landed===value?' hit':''}`} style={{'--c':COLORS[value]} as React.CSSProperties} onClick={()=>setChoice(value)}>
      <b>{value}</b><small>paie {value+1}×</small><i>{CHANCE[value]}</i>
      {choice===value&&<Chip amount={Number(stake)||0}/>}
     </button>
    ))}
   </div>
  </GameFrame>
 )
}

/* ------------------------------------------------------------------ */
/*  Sic Bo                                                             */
/* ------------------------------------------------------------------ */
const PIPS:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}
function Die({value,rolling,size='lg'}:{value:number;rolling?:boolean;size?:'sm'|'lg'}){
 return <span className={`sb-die ${size}${rolling?' rolling':''}`} role="img" aria-label={`Dé : ${value}`}>{Array.from({length:9},(_,i)=><i key={i} className={PIPS[value].includes(i)?'on':''}/>)}</span>
}
const TOTAL_PAY:Record<number,number>={4:51,5:19,6:15,7:13,8:9,9:7,10:7,11:7,12:7,13:9,14:13,15:15,16:19,17:51}
interface Pick{type:string;value?:number}
const same=(a:Pick,b:Pick)=>a.type===b.type&&a.value===b.value
const pickLabel=(pick:Pick)=>pick.type==='small'?'Petit (4–10) · 2×':pick.type==='big'?'Grand (11–17) · 2×':pick.type==='any_triple'?'Triple quelconque · 31×':pick.type==='double'?`Double de ${pick.value} · 11×`:pick.type==='specific_triple'?`Triple de ${pick.value} · 181×`:`Total ${pick.value} · ${TOTAL_PAY[pick.value!]}×`

export function SicBoGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[pick,setPick]=useState<Pick>({type:'small'}),[rolling,setRolling]=useState(false),[faces,setFaces]=useState([1,1,1]),[final,setFinal]=useState<number[]|null>(null)
 const stop=useRef<()=>void>(()=>undefined)
 useEffect(()=>()=>stop.current(),[])
 const res=settled?(round?.result as {dice:number[];sum:number;triple:boolean}|null):null
 const amount=Number(stake)||0

 const roll=async()=>{
  const bet=validStake(stake,balance);if(!bet||busy||rolling)return
  setRolling(true);setFinal(null)
  const next=await start(bet,{bet:pick})
  if(!next){setRolling(false);return}
  const dice=(next.result as {dice:number[]}).dice
  let frame=0
  stop.current=animate(1300,(t)=>{frame+=1;if(t<.85){if(frame%4===0)setFaces([0,1,2].map(()=>1+Math.floor(Math.random()*6)))}else setFaces(dice)},()=>{setFaces(dice);setFinal(dice);setRolling(false)})
 }
 const done=!rolling&&!!res&&final!==null
 const zone=(next:Pick,content:React.ReactNode,className='')=>{const on=same(pick,next);return <button key={`${next.type}-${next.value??''}`} type="button" role="radio" aria-checked={on} disabled={busy||rolling} className={`sb-zone${on?' on':''} ${className}`} onClick={()=>setPick(next)}>{content}{on&&<Chip amount={amount}/>}</button>}
 return (
  <GameFrame game={game} tone={rolling?'live':done?toneOf(true,net):'idle'} status={rolling?'Les dés roulent':done?`Total ${res!.sum}${res!.triple?' · triple':''}`:'Placez votre mise'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||rolling}
    cta={<Cta disabled={busy||rolling||!validStake(stake,balance)} onClick={()=>void roll()}><Dices size={19} aria-hidden="true"/>{rolling?'Lancer…':'Lancer les dés'}</Cta>}
    note={<><strong className="rl-bet">{pickLabel(pick)}</strong><br/>Petit et Grand perdent sur un triple.</>}/>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`Dés ${res!.dice.join(' · ')} · total ${res!.sum}`}/>}
   <div className="sb-tray" aria-live="off">{faces.map((face,index)=><Die key={index} value={face} rolling={rolling}/>)}</div>
   <div className="sb-board" role="radiogroup" aria-label="Table de paris">
    <div className="sb-row top">
     {zone({type:'small'},<><b>PETIT</b><small>4 – 10 · 2×</small></>)}
     {zone({type:'any_triple'},<><b>TRIPLE</b><small>quelconque · 31×</small></>,'mid')}
     {zone({type:'big'},<><b>GRAND</b><small>11 – 17 · 2×</small></>)}
    </div>
    <div className="sb-label">Double précis · paie 11×</div>
    <div className="sb-row six">{[1,2,3,4,5,6].map((v)=>zone({type:'double',value:v},<><Die value={v} size="sm"/><Die value={v} size="sm"/></>))}</div>
    <div className="sb-label">Triple précis · paie 181×</div>
    <div className="sb-row six">{[1,2,3,4,5,6].map((v)=>zone({type:'specific_triple',value:v},<><Die value={v} size="sm"/><Die value={v} size="sm"/><Die value={v} size="sm"/></>))}</div>
    <div className="sb-label">Total exact</div>
    <div className="sb-row totals">{Object.entries(TOTAL_PAY).map(([total,pay])=>zone({type:'total',value:Number(total)},<><b>{total}</b><small>{pay}×</small></>,done&&res!.sum===Number(total)?'hit':''))}</div>
   </div>
  </GameFrame>
 )
}
