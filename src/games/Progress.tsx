import { useEffect, useRef, useState } from 'react'
import { Bell, Cherry, Coins, Crown, Gem, KeyRound, Moon, Pickaxe, Star, Target, Ticket, type LucideIcon } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { money } from '../lib/format'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, easeOutCubic, GameFrame, ResultBanner, Segmented, toneOf, wait } from './kit'

/* ------------------------------------------------------------------ */
/*  Tour                                                               */
/* ------------------------------------------------------------------ */
const RISKS:{id:'low'|'medium'|'high';label:string;safe:number}[]=[{id:'low',label:'Prudent',safe:3},{id:'medium',label:'Équilibré',safe:2},{id:'high',label:'Audacieux',safe:1}]
const FLOORS=8
const towerMultiplier=(safe:number,level:number)=>Number((.99*Math.pow(4/safe,level)).toFixed(2))

export function TowerGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[risk,setRisk]=useState<'low'|'medium'|'high'>('medium')
 const view=(settled?round?.result:live?.state) as {risk:string;level:number;picks:number[];traps?:number[][];hit?:{floor:number;tile:number}}|null|undefined
 const active=RISKS.find((item)=>item.id===(view?.risk??risk))!
 const level=view?.level??0
 const current=live?towerMultiplier(active.safe,level):0
 const stakeValue=live?live.stake:Number(stake)||0
 const lost=!!settled&&!!view?.hit
 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,net)} status={live?`Étage ${level+1} / ${FLOORS}${level?` · ${current.toFixed(2)}×`:''}`:settled?(lost?`Piège à l’étage ${view!.hit!.floor+1}`:'Encaissé'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<Cta variant="cash" disabled={busy||!level} onClick={()=>void act('cashout')}>{level?`Encaisser ${money(stakeValue*current)}`:'Montez un étage pour encaisser'}</Cta>
     :<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>{const amount=validStake(stake,balance);if(amount)void start(amount,{risk})}}><Pickaxe size={19} aria-hidden="true"/>{busy?'Construction…':settled?'Nouvelle tour':'Commencer l’ascension'}</Cta>}
    note="Chaque étage réussi multiplie le gain. Encaissez quand vous voulez ; un piège termine la partie.">
    {!live&&<Segmented label="Niveau de risque" value={risk} onChange={setRisk} disabled={busy} columns={3} options={RISKS.map((item)=>({value:item.id,label:item.label,hint:`${item.safe}/4 sûres`}))}/>}
   </BetPanel>}>
   {settled&&<ResultBanner id={round?.id} net={net} headline={lost?'PIÈGE':'ENCAISSÉ'} sub={lost?`Étage ${view!.hit!.floor+1}`:`${level} étage${level>1?'s':''} · ${round?.multiplier?.toFixed(2)}×`}/>}
   <div className="tw-tower" role="group" aria-label="Tour de 8 étages">
    {Array.from({length:FLOORS},(_,i)=>FLOORS-1-i).map((floor)=>{
     const isCurrent=!!live&&floor===level
     return (
      <div className={`tw-floor${isCurrent?' current':''}${floor<level?' cleared':''}`} key={floor}>
       <span className="tw-mult"><small>{floor+1}</small><b>{towerMultiplier(active.safe,floor+1).toFixed(2)}×</b></span>
       <div className="tw-tiles">
        {[0,1,2,3].map((tile)=>{
         const picked=view?.picks?.[floor]===tile,trap=!!settled&&!!view?.traps?.[floor]?.includes(tile),hit=view?.hit?.floor===floor&&view.hit.tile===tile
         return <button key={tile} type="button" className={`tw-tile${picked?' safe':''}${trap?' trap':''}${hit?' hit':''}`} disabled={!live||busy||floor!==level} aria-label={`Étage ${floor+1}, tuile ${tile+1}${picked?' : sûre':trap?' : piège':''}`} onClick={()=>void act('reveal',{tile})}><span aria-hidden="true">{picked?'✓':trap?'✕':''}</span></button>
        })}
       </div>
      </div>
     )
    })}
   </div>
  </GameFrame>
 )
}

/* ------------------------------------------------------------------ */
/*  Penalty                                                            */
/* ------------------------------------------------------------------ */
const ZONES=['Gauche','Centre','Droite']
const ZONE_X=[-130,0,130]
interface Shot{zone:number;keeper:number;goal:boolean}

export function PenaltyGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[series,setSeries]=useState(3),[flash,setFlash]=useState<{goal:boolean}|null>(null),[kicking,setKicking]=useState(false)
 const ball=useRef<SVGGElement>(null),keeper=useRef<SVGGElement>(null),stop=useRef<()=>void>(()=>undefined),alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;stop.current()}},[])
 const view=(settled?round?.result:live?.state) as {series:number;shots:Shot[]}|null|undefined
 const shots=view?.shots??[],total=view?.series??series
 const goals=shots.filter((shot)=>shot.goal).length

 const kick=async(zone:number)=>{
  if(!live||busy||kicking)return
  setKicking(true);setFlash(null)
  const next=await act('kick',{zone});if(!next){setKicking(false);return}
  const list=((next.status==='settled'?next.result:next.state) as {shots:Shot[]}).shots,shot=list[list.length-1]
  // Le ballon part vers la zone visée pendant que le gardien plonge du côté tiré par le serveur.
  const tx=ZONE_X[shot.zone],ty=-190,kx=ZONE_X[shot.keeper]*.9
  await new Promise<void>((resolve)=>{
   stop.current=animate(780,(t)=>{
    const e=easeOutCubic(t)
    ball.current?.setAttribute('transform',`translate(${300+tx*e} ${330+ty*e-Math.sin(Math.PI*t)*40}) scale(${1-.55*e})`)
    keeper.current?.setAttribute('transform',`translate(${300+kx*easeOutCubic(Math.min(1,t*1.4))} 150) rotate(${(kx/130)*28*easeOutCubic(Math.min(1,t*1.4))})`)
   },resolve)
  })
  if(!alive.current)return
  setFlash({goal:shot.goal});await wait(1100)
  if(!alive.current)return
  setFlash(null);setKicking(false)
  ball.current?.setAttribute('transform','translate(300 330)');keeper.current?.setAttribute('transform','translate(300 150)')
 }
 const done=!!settled&&!kicking
 return (
  <GameFrame game={game} tone={live||kicking?'live':done?toneOf(true,net):'idle'} status={kicking?(flash?(flash.goal?'But !':'Arrêt du gardien'):'Tir…'):live?`Tir ${shots.length+1} / ${total}`:settled?`${goals} but${goals>1?'s':''} sur ${shots.length}`:'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<p className="gx-msg warn" role="status">Cliquez sur une zone du but pour tirer.</p>:<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>{const amount=validStake(stake,balance);if(amount){setFlash(null);void start(amount,{series})}}}><Target size={19} aria-hidden="true"/>{busy?'Préparation…':settled?'Nouvelle série':'Entrer sur le terrain'}</Cta>}
    note="Un arrêt du gardien termine la série. Le gain n’est versé que si tous les tirs sont des buts.">
    {!live&&<Segmented label="Nombre de tirs" value={series} onChange={setSeries} disabled={busy} columns={3} options={[{value:1,label:'1 tir',hint:'1,49×'},{value:3,label:'3 tirs',hint:'3,34×'},{value:5,label:'5 tirs',hint:'7,52×'}]}/>}
   </BetPanel>}>
   {done&&!flash&&<ResultBanner id={round?.id} net={net} sub={`${goals} but${goals>1?'s':''} sur ${shots.length} tir${shots.length>1?'s':''}`}/>}
   <ol className="pn-dots" aria-label="Tirs">{Array.from({length:total},(_,i)=><li key={i} className={shots[i]?(shots[i].goal?'goal':'miss'):i===shots.length&&live?'next':''}>{shots[i]?(shots[i].goal?'⚽':'✕'):i+1}</li>)}</ol>
   <div className="pn-scene">
    <svg viewBox="0 0 600 380" role="group" aria-label="But de football : choisissez une zone pour tirer">
     <defs>
      <pattern id="pnNet" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 0L14 14M14 0L0 14" stroke="rgba(255,255,255,.22)" strokeWidth=".8"/></pattern>
      <linearGradient id="pnGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c6a3e"/><stop offset="1" stopColor="#0e3d24"/></linearGradient>
     </defs>
     <rect x="0" y="0" width="600" height="380" fill="url(#pnGrass)"/>
     {Array.from({length:7},(_,i)=><rect key={i} x={i*100} y="0" width="50" height="380" fill="rgba(255,255,255,.035)"/>)}
     <rect x="150" y="60" width="300" height="170" fill="url(#pnNet)" opacity=".9"/>
     <rect x="150" y="60" width="300" height="170" fill="rgba(0,0,0,.25)"/>
     <path d="M150 230V60H450V230" fill="none" stroke="#fff" strokeWidth="9" strokeLinejoin="round"/>
     <line x1="60" y1="230" x2="540" y2="230" stroke="rgba(255,255,255,.7)" strokeWidth="3"/>
     <circle cx="300" cy="330" r="3" fill="rgba(255,255,255,.7)"/>
     {live&&!kicking&&ZONES.map((label,zone)=>(
      <g key={label} className="pn-zone" tabIndex={0} role="button" aria-label={`Tirer ${label.toLowerCase()}`} onClick={()=>void kick(zone)} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();void kick(zone)}}}>
       <rect x={152+zone*98} y="62" width="98" height="166" rx="6"/><text x={201+zone*98} y="150" textAnchor="middle">{label}</text>
      </g>
     ))}
     <g ref={keeper} transform="translate(300 150)" className="pn-keeper"><rect x="-17" y="-26" width="34" height="62" rx="12" fill="#ffc21a"/><circle cx="0" cy="-38" r="12" fill="#f1c9a0"/><circle cx="-26" cy="-16" r="8" fill="#fff" stroke="#ffc21a" strokeWidth="3"/><circle cx="26" cy="-16" r="8" fill="#fff" stroke="#ffc21a" strokeWidth="3"/><rect x="-14" y="34" width="11" height="26" rx="4" fill="#222"/><rect x="3" y="34" width="11" height="26" rx="4" fill="#222"/></g>
     <g ref={ball} transform="translate(300 330)"><circle r="17" fill="#fff" stroke="#222" strokeWidth="2"/><path d="M0 -8l8 6-3 9h-10l-3-9z" fill="#222"/></g>
    </svg>
    {flash&&<div className={`pn-flash ${flash.goal?'goal':'save'}`} role="status">{flash.goal?'BUT !':'ARRÊTÉ !'}</div>}
   </div>
  </GameFrame>
 )
}

/* ------------------------------------------------------------------ */
/*  Carte à gratter                                                    */
/* ------------------------------------------------------------------ */
const VALUE_SYMBOLS=['COIN','GEM','STAR','CROWN']
const ICONS:Record<string,{icon?:LucideIcon;text?:string;name:string}>={COIN:{icon:Coins,name:'Pièce'},GEM:{icon:Gem,name:'Gemme'},STAR:{icon:Star,name:'Étoile'},CROWN:{icon:Crown,name:'Couronne'},BELL:{icon:Bell,name:'Cloche'},CHERRY:{icon:Cherry,name:'Cerise'},SEVEN:{text:'7',name:'Sept'},MOON:{icon:Moon,name:'Lune'},KEY:{icon:KeyRound,name:'Clé'}}

export function ScratchGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[auto,setAuto]=useState(false)
 const view=(settled?round?.result:live?.state) as {revealed:(number|{index:number;symbol:string})[];grid?:string[];prize?:string}|null|undefined
 const revealed=new Map<number,string>()
 if(settled&&view?.grid)view.grid.forEach((symbol,index)=>revealed.set(index,symbol))
 else (view?.revealed??[]).forEach((item)=>{if(typeof item==='object')revealed.set(item.index,item.symbol)})
 const winner=settled&&net>0?[...revealed.values()].find((symbol,_,list)=>VALUE_SYMBOLS.includes(symbol)&&list.filter((x)=>x===symbol).length>=3):undefined
 const scratchAll=async()=>{
  if(!live||auto)return;setAuto(true)
  for(let cell=0;cell<9;cell++){if(revealed.has(cell))continue;const next=await act('reveal',{cell});if(!next||next.status==='settled')break;await wait(220)}
  setAuto(false)
 }
 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,net)} status={live?`${revealed.size} / 9 cases`:settled?(winner?`Trio ${ICONS[winner].name.toLowerCase()}`:'Pas de trio'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<Cta disabled={busy||auto} onClick={()=>void scratchAll()}>{auto?'Grattage…':'Tout gratter'}</Cta>:<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>{const amount=validStake(stake,balance);if(amount)void start(amount)}}><Ticket size={19} aria-hidden="true"/>{busy?'Impression…':settled?'Nouvelle carte':'Acheter une carte'}</Cta>}
    note="Le résultat est fixé dès l’achat. Trois symboles de valeur identiques (pièce, gemme, étoile, couronne) gagnent."/>}>
   {settled&&<ResultBanner id={round?.id} net={net} sub={winner?`Trio ${ICONS[winner].name.toLowerCase()}`:'Aucun trio gagnant'}/>}
   <div className="sc-card">
    <div className="sc-title" aria-hidden="true"><b>GRATTE EXPRESS</b><small>Trouvez 3 symboles identiques</small></div>
    <div className="sc-grid" role="group" aria-label="Carte à gratter">
     {Array.from({length:9},(_,cell)=>{
      const symbol=revealed.get(cell),meta=symbol?ICONS[symbol]:undefined,Icon=meta?.icon
      return (
       <button key={cell} type="button" disabled={!live||busy||auto||!!symbol} aria-label={symbol?`Case ${cell+1} : ${meta?.name??symbol}`:`Gratter la case ${cell+1}`} onClick={()=>void act('reveal',{cell})}
        className={`sc-cell${symbol?' open':''}${winner&&symbol===winner?' win':''}${symbol&&VALUE_SYMBOLS.includes(symbol)?' value':''}`}>
        <span className="sc-sym" aria-hidden="true">{Icon?<Icon size={38} strokeWidth={1.8}/>:meta?.text}</span>
        <span className="sc-foil" aria-hidden="true"/>
       </button>
      )
     })}
    </div>
   </div>
  </GameFrame>
 )
}
