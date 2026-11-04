import { useCallback, useEffect, useRef, useState } from 'react'
import { Rocket } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { money } from '../lib/format'
import { useWinveroStore } from '../store/useWinveroStore'
import { useServerGame, validStake } from '../components/gameKit'
import { BetPanel, Cta, GameFrame, ResultBanner, type Tone } from './kit'

/* Même courbe que le serveur (server/rules.mjs) : 1,018^(ms/90), arrondie au centième. */
const GROWTH=Math.log(1.018)/90
const multiplierAt=(ms:number)=>Number(Math.max(1,Math.exp(GROWTH*Math.max(0,ms))).toFixed(2))
const msAt=(multiplier:number)=>Math.log(Math.max(1,multiplier))/GROWTH

interface Flight{
 start:number;roundId:string|null;stake:number
 crashAt:number|null;cashed:number|null;cashedMs:number
 crashedAtMs:number|null;over:boolean
 particles:{x:number;y:number;vx:number;vy:number;life:number;hue:number}[]
}
const freshFlight=():Flight=>({start:0,roundId:null,stake:0,crashAt:null,cashed:null,cashedMs:0,crashedAtMs:null,over:false,particles:[]})

const TICKS=[1,1.25,1.5,2,3,4,5,7.5,10,20,30,50,100,200,500,1000]
const STARS=Array.from({length:70},(_,index)=>({x:((index*97)%100)/100,y:((index*53+17)%100)/100,r:.5+((index*31)%10)/10*1.4,s:.2+((index*13)%10)/10}))

function draw(canvas:HTMLCanvasElement,flight:Flight,now:number,rocket:HTMLImageElement|null,target:number|null){
 const ctx=canvas.getContext('2d');if(!ctx)return
 const dpr=window.devicePixelRatio||1,W=canvas.clientWidth,H=canvas.clientHeight
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr)}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H)
 const flying=flight.start>0
 const elapsed=flying?now-flight.start:0
 let mult=multiplierAt(elapsed),ms=elapsed
 if(flight.crashAt!==null&&mult>=flight.crashAt){mult=flight.crashAt;ms=msAt(flight.crashAt);if(flight.crashedAtMs===null){flight.crashedAtMs=now}}
 const crashed=flight.crashedAtMs!==null
 const padL=52,padR=18,padT=24,padB=34,pw=W-padL-padR,ph=H-padT-padB
 const spanX=Math.max(7000,ms*1.18),spanY=Math.max(2,mult*1.22)
 const X=(t:number)=>padL+Math.min(1,t/spanX)*pw
 const Y=(m:number)=>padT+ph-Math.min(1,(m-1)/(spanY-1))*ph

 // étoiles : défilent plus vite quand la fusée accélère
 ctx.fillStyle='#fff'
 STARS.forEach((star)=>{const drift=((star.y+(flying&&!crashed?elapsed*.00004*star.s*(1+mult*.15):0))%1);ctx.globalAlpha=.25+star.s*.5;ctx.beginPath();ctx.arc(star.x*W,drift*H,star.r,0,7);ctx.fill()})
 ctx.globalAlpha=1

 // grille et repères de multiplicateur
 ctx.font='600 11px "JetBrains Mono",monospace';ctx.textAlign='right';ctx.textBaseline='middle'
 TICKS.filter((tick)=>tick<=spanY&&tick>=1).forEach((tick)=>{
  const y=Y(tick);ctx.strokeStyle=tick===1?'rgba(255,255,255,.28)':'rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke()
  ctx.fillStyle='rgba(185,178,210,.85)';ctx.fillText(`${tick}×`,padL-8,y)
 })
 ctx.textAlign='center';ctx.textBaseline='top'
 const stepS=spanX>30000?10:spanX>14000?5:2
 for(let s=0;s*1000<=spanX;s+=stepS){const x=X(s*1000);ctx.strokeStyle='rgba(255,255,255,.05)';ctx.beginPath();ctx.moveTo(x,padT);ctx.lineTo(x,padT+ph);ctx.stroke();ctx.fillStyle='rgba(185,178,210,.7)';ctx.fillText(`${s}s`,x,padT+ph+10)}

 // cible de cash-out automatique
 if(target&&target>1&&target<spanY){const y=Y(target);ctx.setLineDash([7,6]);ctx.strokeStyle='rgba(217,179,106,.85)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e9cf93';ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText(`Auto ${target.toFixed(2)}×`,padL+6,y-4)}

 if(flying){
  const steps=70,pts:[number,number][]=[]
  for(let i=0;i<=steps;i++){const t=ms*i/steps;pts.push([X(t),Y(multiplierAt(t))])}
  const [tx,ty]=pts[steps]
  const color=crashed&&flight.cashed===null?'#ff5a74':flight.cashed!==null?'#49c995':'#9d7bff'
  // aire sous la courbe
  const grad=ctx.createLinearGradient(0,padT,0,padT+ph);grad.addColorStop(0,color+'88');grad.addColorStop(1,color+'00')
  ctx.beginPath();ctx.moveTo(pts[0][0],padT+ph);pts.forEach(([x,y])=>ctx.lineTo(x,y));ctx.lineTo(tx,padT+ph);ctx.closePath();ctx.fillStyle=grad;ctx.fill()
  // courbe
  ctx.shadowColor=color;ctx.shadowBlur=18;ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineJoin='round';ctx.lineCap='round'
  ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.shadowBlur=0
  // repère d'encaissement
  if(flight.cashed!==null){const cx=X(flight.cashedMs),cy=Y(flight.cashed);ctx.fillStyle='#49c995';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,7,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#bff5dd';ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText(`Encaissé ${flight.cashed.toFixed(2)}×`,cx+12,cy-8)}
  // fusée
  if(!crashed&&rocket&&rocket.complete){
   const [px,py]=pts[Math.max(0,steps-3)],angle=Math.atan2(ty-py,tx-px)
   ctx.save();ctx.translate(tx,ty);ctx.rotate(angle+Math.PI/4);const size=Math.min(96,Math.max(58,W*.1))
   const flame=ctx.createRadialGradient(-size*.3,size*.3,2,-size*.3,size*.3,size*.5);flame.addColorStop(0,'rgba(255,214,120,.9)');flame.addColorStop(1,'rgba(255,90,60,0)')
   ctx.fillStyle=flame;ctx.beginPath();ctx.arc(-size*.3,size*.3,size*(.42+.08*Math.sin(now/45)),0,7);ctx.fill()
   ctx.drawImage(rocket,-size/2,-size/2,size,size);ctx.restore()
  }
  // explosion
  if(crashed&&flight.crashedAtMs!==null){
   const age=now-flight.crashedAtMs
   if(!flight.particles.length&&!flight.over){flight.over=true;flight.particles=Array.from({length:46},()=>{const a=Math.random()*Math.PI*2,v=1.5+Math.random()*5;return{x:tx,y:ty,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,hue:Math.random()*50}})}
   flight.particles.forEach((p)=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.life=Math.max(0,1-age/1100);ctx.globalAlpha=p.life;ctx.fillStyle=`hsl(${p.hue},100%,60%)`;ctx.beginPath();ctx.arc(p.x,p.y,3.2*p.life+.5,0,7);ctx.fill()})
   ctx.globalAlpha=1
   const ring=Math.min(1,age/500);ctx.strokeStyle=`rgba(255,120,90,${1-ring})`;ctx.lineWidth=5*(1-ring)+1;ctx.beginPath();ctx.arc(tx,ty,10+ring*70,0,7);ctx.stroke()
  }
 }else{
  // rampe de lancement : la fusée attend le départ
  if(rocket&&rocket.complete){const size=Math.min(96,Math.max(58,W*.1)),x=padL+18,y=padT+ph-8;ctx.save();ctx.translate(x+size/2,y-size/2);ctx.globalAlpha=.9;ctx.drawImage(rocket,-size/2,-size/2,size,size);ctx.restore()}
 }
 return {mult,crashed}
}

export function CrashGame({game}:{game:GameDefinition}){
 const balance=useWinveroStore((s)=>s.balance),engine=useServerGame(game)
 const [stake,setStake]=useState('10'),[auto,setAuto]=useState('2.00')
 const [phase,setPhase]=useState<'idle'|'flying'|'cashed'|'crashed'>('idle')
 const [live,setLive]=useState(1),[last,setLast]=useState<{id:string;net:number;crashAt:number;cashed:boolean;mult:number}|null>(null)
 const canvas=useRef<HTMLCanvasElement>(null),readout=useRef<HTMLDivElement>(null)
 const flight=useRef<Flight>(freshFlight()),rocket=useRef<HTMLImageElement|null>(null)
 const cashing=useRef(false),targetRef=useRef<number|null>(null),phaseRef=useRef(phase)
 phaseRef.current=phase
 const target=Number(auto)>1?Number(auto):null
 targetRef.current=target

 useEffect(()=>{const image=new Image();image.src='/assets/games/orbital-rocket.png';rocket.current=image},[])

 const settle=useCallback((round:{id:string;payout:number;stake:number;multiplier:number;result:Record<string,unknown>|null})=>{
  const crashAt=Number(round.result?.crashAt??1),cashedOut=Boolean(round.result?.cashedOut)
  flight.current.crashAt=crashAt
  if(cashedOut){flight.current.cashed=round.multiplier;flight.current.cashedMs=msAt(round.multiplier);setPhase('cashed')}else setPhase('crashed')
  setLast({id:round.id,net:Number((round.payout-round.stake).toFixed(2)),crashAt,cashed:cashedOut,mult:round.multiplier})
 },[])

 const cashout=useCallback(async()=>{
  const id=flight.current.roundId;if(!id||cashing.current||phaseRef.current!=='flying')return
  cashing.current=true
  const round=await engine.act(id,'cashout')
  if(round&&round.status==='settled')settle(round);else cashing.current=false
 },[engine,settle])

 const launch=async()=>{
  const amount=validStake(stake,balance);if(!amount||phase==='flying')return
  const round=await engine.start(amount);if(!round)return
  cashing.current=false;setLast(null);setLive(1)
  flight.current={...freshFlight(),start:performance.now(),roundId:round.id,stake:amount}
  setPhase('flying')
 }

 // boucle d'affichage : suit la fréquence de rafraîchissement de l'écran
 useEffect(()=>{
  let frame=0,lastText='',lastUi=0
  const loop=(now:number)=>{
   const el=canvas.current
   if(el){
    const state=draw(el,flight.current,now,rocket.current,targetRef.current)
    if(state&&readout.current){
     const text=state.mult.toFixed(2)
     if(text!==lastText){lastText=text;readout.current.textContent=`${text}×`}
     const f=flight.current,tone=state.crashed&&f.cashed===null?'crash':f.cashed!==null?'cash':state.mult>=10?'hot':state.mult>=2?'warm':''
     if(readout.current.dataset.tone!==tone)readout.current.dataset.tone=tone
     if(phaseRef.current==='flying'){
      if(now-lastUi>90){lastUi=now;setLive(state.mult)}
      const goal=targetRef.current;if(goal&&state.mult>=goal)void cashout()
     }
    }
   }
   frame=requestAnimationFrame(loop)
  }
  frame=requestAnimationFrame(loop)
  return()=>cancelAnimationFrame(frame)
 },[cashout])

 // le serveur reste l'autorité : on l'interroge pour détecter le crash
 useEffect(()=>{
  if(phase!=='flying')return
  const timer=window.setInterval(async()=>{
   const id=flight.current.roundId;if(!id||cashing.current)return
   const round=await engine.read(id)
   if(round&&round.status==='settled'&&phaseRef.current==='flying')settle(round)
  },180)
  return()=>window.clearInterval(timer)
 },[engine,phase,settle])

 const flying=phase==='flying'
 const tone:Tone=flying?'live':phase==='cashed'?'win':phase==='crashed'?'loss':'idle'
 const status=flying?'En vol':phase==='cashed'?`Encaissé ${last?.mult.toFixed(2)}×`:phase==='crashed'?`Crash à ${last?.crashAt.toFixed(2)}×`:'Prêt au décollage'
 return (
  <GameFrame game={game} tone={tone} status={status}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={flying}
    cta={flying?<Cta variant="cash" onClick={()=>void cashout()}>Encaisser {money(flight.current.stake*live)}</Cta>:<Cta disabled={!validStake(stake,balance)} onClick={()=>void launch()}><Rocket size={19} aria-hidden="true"/>Lancer la fusée</Cta>}
    note={<>
     <label className="cr-auto">Cash-out automatique
      <span className="cr-auto-input"><input type="number" min="1.01" step="0.05" value={auto} disabled={flying} onChange={(event)=>setAuto(event.target.value)} aria-label="Cash-out automatique (multiplicateur)"/><i>×</i></span>
     </label>
     Encaissez avant le crash : la fusée peut exploser à tout instant. La cible automatique encaisse pour vous.
    </>}/>}>
   {last&&!flying&&<ResultBanner id={last.id} net={last.net} headline={last.cashed?'ENCAISSÉ':'CRASH'} sub={last.cashed?`À ${last.mult.toFixed(2)}× · la fusée a explosé à ${last.crashAt.toFixed(2)}×`:`La fusée a explosé à ${last.crashAt.toFixed(2)}×`}/>}
   <div className="cr-view">
    <canvas ref={canvas} className="cr-canvas" role="img" aria-label="Courbe du multiplicateur de la fusée"/>
    <div className="cr-hud" aria-hidden="true"><div ref={readout} className="cr-mult" data-tone="">1.00×</div></div>
    {!flying&&!last&&<p className="cr-hint">Placez votre mise et lancez la fusée.</p>}
   </div>
   <p className="sr-only" aria-live="polite">{flying?'La fusée est en vol.':status}</p>
  </GameFrame>
 )
}
