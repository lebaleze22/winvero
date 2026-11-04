import { useEffect, useRef, useState } from 'react'
import { Waves } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, GameFrame, ResultBanner, Segmented, toneOf } from './kit'

const MULTIPLIERS={Prudent:[3.46,2.08,1.38,.81,.58,.81,1.38,2.08,3.46],Équilibré:[7.88,3.28,1.58,.66,.26,.66,1.58,3.28,7.88],Extrême:[19.55,5.21,1.3,.39,.13,.39,1.3,5.21,19.55]} as const
type Risk=keyof typeof MULTIPLIERS
const ROWS=8,DX=42,DY=34,CX=200,TOP=40,STEP_MS=300

const pegX=(row:number,rights:number)=>CX+(rights-row/2)*DX
const pegY=(row:number)=>TOP+row*DY
const slotX=(index:number)=>CX+(index-ROWS/2)*DX
const slotColor=(value:number)=>value>=10?'#ff3d6e':value>=3?'#ff7a45':value>=1.3?'#ffc21a':value>=.8?'#7fd36a':'#5b6bc4'

/** Repli si le serveur ne renvoie pas le chemin : un chemin quelconque menant à la même case. */
function pathTo(slot:number){
 const steps=[...Array(slot).fill(1),...Array(ROWS-slot).fill(0)] as number[]
 for(let i=steps.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[steps[i],steps[j]]=[steps[j],steps[i]]}
 return steps
}

export function PlinkoGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[risk,setRisk]=useState<Risk>('Équilibré'),[dropping,setDropping]=useState(false)
 const [hit,setHit]=useState<string|null>(null),[landed,setLanded]=useState<number|null>(null)
 const ball=useRef<SVGCircleElement>(null),trail=useRef<SVGCircleElement>(null),stop=useRef<()=>void>(()=>undefined)
 useEffect(()=>()=>stop.current(),[])
 const values=MULTIPLIERS[risk]

 const drop=async()=>{
  const amount=validStake(stake,balance);if(!amount||busy||dropping)return
  setDropping(true);setLanded(null);setHit(null)
  const next=await start(amount,{risk})
  if(!next){setDropping(false);return}
  const result=next.result as {slot:number;path?:number[]},target=Number(result.slot)
  const path=Array.isArray(result.path)&&result.path.length===ROWS?result.path.map(Number):pathTo(target)
  // Points de rebond : la bille touche un picot par rangée puis tombe dans la case.
  const points:[number,number][]=[[CX,TOP-30]]
  let rights=0
  path.forEach((_,row)=>{points.push([pegX(row,rights),pegY(row)-9]);rights+=path[row]})
  points.push([slotX(rights),pegY(ROWS)+4])
  const segments=points.length-1,total=segments*STEP_MS
  let lastSegment=-1
  stop.current=animate(total,(t)=>{
   const raw=t*segments,segment=Math.min(segments-1,Math.floor(raw)),local=raw-segment
   const [x0,y0]=points[segment],[x1,y1]=points[segment+1]
   const x=x0+(x1-x0)*(local<.5?2*local*local:1-Math.pow(-2*local+2,2)/2)
   const bounce=Math.sin(Math.PI*local)*(segment===0||segment===segments-1?0:11)
   const y=y0+(y1-y0)*(local*local*.65+local*.35)-bounce
   ball.current?.setAttribute('cx',String(x));ball.current?.setAttribute('cy',String(y))
   trail.current?.setAttribute('cx',String(x));trail.current?.setAttribute('cy',String(y-9))
   if(segment!==lastSegment&&segment>0&&segment<=ROWS){lastSegment=segment;setHit(`${segment-1}-${points[segment][0]}`)}
  },()=>{setLanded(Number(result.slot));setDropping(false)})
 }
 const done=!dropping&&settled&&landed!==null
 return (
  <GameFrame game={game} tone={dropping?'live':done?toneOf(true,net):'idle'} status={dropping?'La bille descend':done?`${values[landed!]}×`:'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||dropping}
    cta={<Cta disabled={busy||dropping||!validStake(stake,balance)} onClick={()=>void drop()}><Waves size={19} aria-hidden="true"/>{dropping?'La bille tombe…':'Lâcher la bille'}</Cta>}
    note="Le chemin de la bille (gauche ou droite à chaque rangée) est celui tiré par le serveur.">
    <Segmented label="Niveau de risque" value={risk} onChange={setRisk} disabled={busy||dropping} options={[{value:'Prudent',label:'Prudent',hint:'jusqu’à 3,46×'},{value:'Équilibré',label:'Équilibré',hint:'jusqu’à 7,88×'},{value:'Extrême',label:'Extrême',hint:'jusqu’à 19,55×'}]} columns={3}/>
   </BetPanel>}>
   {done&&<ResultBanner id={round?.id} net={net} sub={`Case ${values[landed!]}×`}/>}
   <svg className="pl-board" viewBox="0 0 400 390" role="img" aria-label="Plateau de Plinko, 8 rangées et 9 cases">
    <defs><radialGradient id="plBall" cx="35%" cy="30%"><stop offset="0" stopColor="#fff"/><stop offset=".45" stopColor="#ffd24a"/><stop offset="1" stopColor="#c9801a"/></radialGradient></defs>
    {Array.from({length:ROWS},(_,row)=>Array.from({length:row+1},(_,k)=>{const x=pegX(row,k),key=`${row}-${x}`;return <circle key={key} cx={x} cy={pegY(row)} r="4" className={`pl-peg${hit===key?' flash':''}`}/>}))}
    {values.map((value,index)=>{const x=slotX(index)-DX/2+3,on=done&&landed===index;return(
     <g key={index} className={`pl-slot${on?' hit':''}`} style={{'--c':slotColor(value)} as React.CSSProperties}>
      <rect x={x} y={pegY(ROWS)+12} width={DX-6} height="30" rx="8"/><text x={slotX(index)} y={pegY(ROWS)+32} textAnchor="middle">{value}×</text>
     </g>)})}
    <circle ref={trail} cx={CX} cy={TOP-39} r="11" className="pl-glow" style={{opacity:dropping?1:0}}/>
    <circle ref={ball} cx={CX} cy={TOP-30} r="8.5" fill="url(#plBall)" className="pl-ball"/>
   </svg>
  </GameFrame>
 )
}
