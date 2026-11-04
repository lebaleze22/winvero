import { useEffect, useRef, useState } from 'react'
import { CircleDot, Eraser } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, easeOutCubic, easeOutQuart, GameFrame, ResultBanner, toneOf } from './kit'
import { Chip } from './cards'

// Roue européenne à zéro unique, dans l'ordre réel des cases.
const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
const colorOf=(n:number)=>n===0?'green':RED.has(n)?'red':'black'
const SLICE=360/WHEEL.length
const FILL={green:'#1f9d62',red:'#c92847',black:'#17131f'}

interface Bet{type:string;value?:number;numbers?:number[]}
const PAYOUT:Record<string,number>={straight:36,split:18,street:12,corner:9,column:3,dozen:3,red:2,black:2,even:2,odd:2,low:2,high:2}
const LABEL:Record<string,string>={straight:'Plein',split:'Cheval',street:'Transversale',corner:'Carré',column:'Colonne',dozen:'Douzaine',red:'Rouge',black:'Noir',even:'Pair',odd:'Impair',low:'Manque (1–18)',high:'Passe (19–36)'}
const OUTSIDE:{label:string;bet:Bet;span?:number}[]=[
 {label:'1re douzaine',bet:{type:'dozen',value:1},span:4},{label:'2e douzaine',bet:{type:'dozen',value:2},span:4},{label:'3e douzaine',bet:{type:'dozen',value:3},span:4},
 {label:'1–18',bet:{type:'low'},span:2},{label:'Pair',bet:{type:'even'},span:2},{label:'Rouge',bet:{type:'red'},span:2},{label:'Noir',bet:{type:'black'},span:2},{label:'Impair',bet:{type:'odd'},span:2},{label:'19–36',bet:{type:'high'},span:2},
 {label:'Colonne 1',bet:{type:'column',value:1},span:4},{label:'Colonne 2',bet:{type:'column',value:2},span:4},{label:'Colonne 3',bet:{type:'column',value:3},span:4}]

/** Déduit le type de pari interne d'après les numéros choisis (mêmes règles de voisinage que le serveur). */
function innerBet(numbers:number[]):Bet|null{
 if(numbers.length===1)return{type:'straight',value:numbers[0]}
 if(numbers.includes(0)||numbers.length>4)return null
 const rows=numbers.map((n)=>Math.floor((n-1)/3)),cols=numbers.map((n)=>(n-1)%3)
 const spanR=Math.max(...rows)-Math.min(...rows),spanC=Math.max(...cols)-Math.min(...cols)
 if(numbers.length===2&&spanR+spanC===1)return{type:'split',numbers}
 if(numbers.length===3&&spanR===0&&new Set(cols).size===3)return{type:'street',numbers}
 if(numbers.length===4&&spanR===1&&spanC===1&&new Set(rows).size===2&&new Set(cols).size===2)return{type:'corner',numbers}
 return null
}
const sameBet=(a:Bet|null,b:Bet)=>!!a&&a.type===b.type&&a.value===b.value

const polar=(angle:number,radius:number)=>{const a=(angle-90)*Math.PI/180;return[150+radius*Math.cos(a),150+radius*Math.sin(a)] as const}
const wedge=(index:number,inner:number,outer:number)=>{
 const a0=index*SLICE-SLICE/2,a1=index*SLICE+SLICE/2,[x0,y0]=polar(a0,outer),[x1,y1]=polar(a1,outer),[x2,y2]=polar(a1,inner),[x3,y3]=polar(a0,inner)
 return `M${x0} ${y0}A${outer} ${outer} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 0 0 ${x3} ${y3}Z`
}

export function RouletteGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[picked,setPicked]=useState<number[]>([]),[outside,setOutside]=useState<Bet|null>({type:'red'})
 const [spinning,setSpinning]=useState(false),[history,setHistory]=useState<number[]>([]),[landed,setLanded]=useState<number|null>(null)
 const wheel=useRef<SVGGElement>(null),ball=useRef<SVGCircleElement>(null),angle=useRef(0),stop=useRef<()=>void>(()=>undefined)
 useEffect(()=>()=>stop.current(),[])
 const bet:Bet|null=outside??(picked.length?innerBet(picked):null)
 const amount=Number(stake)||0

 const toggle=(n:number)=>{setOutside(null);setPicked((items)=>n===0?(items.includes(0)?[]:[0]):items.includes(n)?items.filter((x)=>x!==n):[...items.filter((x)=>x!==0),n].slice(-4))}
 const chooseOutside=(next:Bet)=>{setPicked([]);setOutside(next)}

 const spin=async()=>{
  const bettor=validStake(stake,balance);if(!bettor||!bet||busy||spinning)return
  setSpinning(true);setLanded(null)
  const next=await start(bettor,{bet})
  if(!next){setSpinning(false);return}
  const number=Number((next.result as {number:number}).number),index=WHEEL.indexOf(number)
  // La case gagnante finit sous le repère (en haut) ; la bille tourne en sens inverse et ralentit.
  const from=angle.current
  let to=from+360*5;to+=(((-index*SLICE)-(to%360))%360+360)%360
  angle.current=to
  stop.current=animate(5600,(t)=>{
   const w=from+(to-from)*easeOutQuart(t),b=-360*7*(1-easeOutCubic(t)),drop=Math.max(0,(t-.72)/.28)
   wheel.current?.setAttribute('transform',`rotate(${w} 150 150)`)
   const [bx,by]=polar(b,139-24*(drop*drop*(3-2*drop)))
   ball.current?.setAttribute('cx',String(bx));ball.current?.setAttribute('cy',String(by))
  },()=>{setLanded(number);setHistory((items)=>[number,...items].slice(0,14));setSpinning(false)})
 }
 const done=!spinning&&settled&&landed!==null
 const betText=bet?`${LABEL[bet.type]}${bet.value!==undefined?` ${bet.value}`:''}${bet.numbers?` (${bet.numbers.join('-')})`:''} · paie ${PAYOUT[bet.type]}×`:picked.length?'Sélection non valide : choisissez des numéros voisins (2, 3 ou 4).':'Choisissez un pari sur le tapis.'
 const cell=(n:number)=>{
  const on=picked.includes(n)&&!outside,win=done&&landed===n
  return <button key={n} type="button" className={`rl-cell ${colorOf(n)}${on?' on':''}${win?' win':''}`} aria-pressed={on} aria-label={`Numéro ${n}, ${colorOf(n)==='red'?'rouge':colorOf(n)==='black'?'noir':'vert'}`} disabled={busy||spinning} onClick={()=>toggle(n)}>{n}{on&&<Chip amount={amount}/>}</button>
 }
 return (
  <GameFrame game={game} tone={spinning?'live':done?toneOf(true,net):'idle'} status={spinning?'La bille tourne':done?`${landed} ${colorOf(landed!)==='red'?'rouge':colorOf(landed!)==='black'?'noir':'vert'}`:'Faites vos jeux'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||spinning}
    cta={<>
      <Cta disabled={busy||spinning||!bet||!validStake(stake,balance)} onClick={()=>void spin()}><CircleDot size={19} aria-hidden="true"/>{spinning?'La bille tourne…':'Lancer la roulette'}</Cta>
      {picked.length>0&&!outside&&<Cta variant="ghost" disabled={busy||spinning} onClick={()=>{setPicked([]);setOutside({type:'red'})}}><Eraser size={15} aria-hidden="true"/>Effacer la sélection</Cta>}
     </>}
    note={<><strong className="rl-bet">{betText}</strong><br/>Un pari par tour. Touchez 1 à 4 numéros voisins pour un cheval, une transversale ou un carré.</>}/>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`Le ${landed} ${colorOf(landed!)==='red'?'rouge':colorOf(landed!)==='black'?'noir':'vert'} sort`}/>}
   <div className="rl-top">
    <svg className="rl-wheel" viewBox="0 0 300 300" role="img" aria-label="Roue de roulette européenne">
     <circle cx="150" cy="150" r="148" fill="#2a1a08"/><circle cx="150" cy="150" r="143" fill="#5a3a12"/>
     <circle cx="150" cy="150" r="133" fill="#0d0a18"/>
     <g ref={wheel}>
      {WHEEL.map((n,index)=>{const [tx,ty]=polar(index*SLICE,112);return <g key={n}><path d={wedge(index,92,128)} fill={FILL[colorOf(n)]} stroke="#d9b36a" strokeWidth=".7"/><text x={tx} y={ty} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="central" transform={`rotate(${index*SLICE} ${tx} ${ty})`} fontFamily="JetBrains Mono,monospace">{n}</text></g>})}
      <circle cx="150" cy="150" r="92" fill="#1a1230" stroke="#d9b36a" strokeWidth="1"/>
      <circle cx="150" cy="150" r="62" fill="url(#rlHub)"/>
      {[0,90,180,270].map((a)=>{const [x,y]=polar(a,52);return <circle key={a} cx={x} cy={y} r="5" fill="#d9b36a"/>})}
     </g>
     <defs><radialGradient id="rlHub"><stop offset="0" stopColor="#f4cf72"/><stop offset="1" stopColor="#8a5a12"/></radialGradient></defs>
     <circle ref={ball} cx="150" cy="11" r="6" fill="#fff" stroke="#bbb" strokeWidth=".6" style={{filter:'drop-shadow(0 2px 3px rgba(0,0,0,.7))'}}/>
     <path d="M150 20 l7 -14 h-14z" fill="#d9b36a" transform="translate(0 -6)"/>
    </svg>
    <div className="rl-last"><small>Derniers numéros</small>{history.length?<ol aria-label="Derniers numéros">{history.map((n,i)=><li key={i} className={colorOf(n)}>{n}</li>)}</ol>:<span>Aucun tirage</span>}</div>
   </div>
   <div className="rl-board" role="group" tabIndex={0} aria-label="Tapis de roulette">
    <button type="button" className={`rl-cell green zero${picked.includes(0)&&!outside?' on':''}${done&&landed===0?' win':''}`} aria-pressed={picked.includes(0)&&!outside} aria-label="Numéro 0, vert" disabled={busy||spinning} onClick={()=>toggle(0)}>0{picked.includes(0)&&!outside&&<Chip amount={amount}/>}</button>
    <div className="rl-grid">{[2,1,0].flatMap((c)=>Array.from({length:12},(_,r)=>cell(3*r+c+1)))}</div>
    <div className="rl-outside" role="group" aria-label="Paris extérieurs">{OUTSIDE.map((item)=>{const on=sameBet(outside,item.bet);return <button key={item.label} type="button" aria-pressed={on} className={`rl-out${item.bet.type==='red'?' red':item.bet.type==='black'?' black':''}${on?' on':''}`} style={{gridColumn:`span ${item.span}`}} disabled={busy||spinning} onClick={()=>chooseOutside(item.bet)}>{item.label}{on&&<Chip amount={amount}/>}</button>})}</div>
   </div>
  </GameFrame>
 )
}
