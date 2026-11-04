import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { useRoundGame, validStake } from '../components/gameKit'
import { animate, BetPanel, Cta, GameFrame, ResultBanner, toneOf } from './kit'

const SYMBOLS=['STAR','DIAMOND','SEVEN','W','DOT'] as const
type Symbol=(typeof SYMBOLS)[number]
const GLYPH:Record<Symbol,{char:string;color:string;name:string}>={STAR:{char:'★',color:'#ffd24a',name:'Étoile'},DIAMOND:{char:'◆',color:'#5ad8ee',name:'Diamant'},SEVEN:{char:'7',color:'#ff5a74',name:'Sept'},W:{char:'W',color:'#b39bff',name:'W'},DOT:{char:'●',color:'#49c995',name:'Perle'}}
const CYCLES=12,STRIP=SYMBOLS.length*(CYCLES+3)
const easeOutBack=(t:number)=>{const c1=1.15,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)}

export function JackpotGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[spinning,setSpinning]=useState(false),[reels,setReels]=useState<Symbol[]>(['W','SEVEN','DIAMOND'])
 const strips=useRef<(HTMLDivElement|null)[]>([null,null,null]),index=useRef([3,2,1]),stops=useRef<(()=>void)[]>([])
 // Position de départ : chaque rouleau affiche son symbole courant.
 useEffect(()=>{strips.current.forEach((strip,i)=>{if(strip)strip.style.transform=`translateY(${-index.current[i]/STRIP*100}%)`})},[])
 useEffect(()=>()=>stops.current.forEach((stop)=>stop()),[])

 const spin=async()=>{
  const amount=validStake(stake,balance);if(!amount||busy||spinning)return
  setSpinning(true)
  const next=await start(amount);if(!next){setSpinning(false);return}
  const final=((next.result as {reels:Symbol[]}).reels)
  let finished=0
  final.forEach((symbol,i)=>{
   const base=index.current[i]%SYMBOLS.length,target=SYMBOLS.indexOf(symbol)
   const end=base+SYMBOLS.length*(CYCLES-3+i*2)+((target-base+SYMBOLS.length)%SYMBOLS.length)
   const strip=strips.current[i]
   stops.current.push(animate(1500+i*520,(t)=>{
    if(!strip)return
    strip.style.transform=`translateY(${-(base+(end-base)*Math.min(1,easeOutBack(t)))/STRIP*100}%)`
    strip.dataset.motion=t<.82?'fast':'slow'
   },()=>{
    if(strip){strip.dataset.motion='';index.current[i]=target;strip.style.transform=`translateY(${-target/STRIP*100}%)`}
    finished+=1
    if(finished===3){setReels(final);setSpinning(false)}
   }))
  })
 }
 const done=!spinning&&settled
 const win=done&&net>0
 const kind=win?(round?.multiplier===8?'jackpot':'pair'):''
 return (
  <GameFrame game={game} tone={spinning?'live':done?toneOf(true,net):'idle'} status={spinning?'Les rouleaux tournent':done?(round?.multiplier===8?'Jackpot !':win?'Paire gagnante':'Perdu'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy||spinning}
    cta={<Cta disabled={busy||spinning||!validStake(stake,balance)} onClick={()=>void spin()}><Sparkles size={19} aria-hidden="true"/>{spinning?'Rotation…':'Faire tourner'}</Cta>}
    note="Deux symboles identiques paient 1,25×, trois paient 8×."/>}>
   {done&&<ResultBanner id={round?.id} net={net} headline={round?.multiplier===8?'JACKPOT':undefined} sub={win?`${round?.multiplier}× votre mise`:'Aucune combinaison'}/>}
   <div className={`jp-machine${kind?` ${kind}`:''}`}>
    <div className="jp-top" aria-hidden="true"><i/><b>COFFRE D’OR</b><i/></div>
    <div className="jp-reels">
     {[0,1,2].map((i)=>(
      <div className="jp-reel" key={i}>
       <div className="jp-strip" ref={(node)=>{strips.current[i]=node}}>
        {Array.from({length:STRIP},(_,cell)=>{const symbol=SYMBOLS[cell%SYMBOLS.length],g=GLYPH[symbol];return <span key={cell} className="jp-cell" style={{color:g.color}} aria-hidden="true">{symbol==='DOT'?<i className="jp-dot"/>:g.char}</span>})}
       </div>
      </div>
     ))}
     <span className="jp-line" aria-hidden="true"/>
    </div>
    <p className="sr-only" aria-live="polite">{done?`Rouleaux : ${reels.map((symbol)=>GLYPH[symbol].name).join(', ')}`:''}</p>
   </div>
   <div className="jp-pay">
    <div className={`jp-pay-row${kind==='jackpot'?' on':''}`}><span>{['★','★','★'].join(' ')}</span><small>Trois identiques · 4 % des tirages</small><b>8×</b></div>
    <div className={`jp-pay-row${kind==='pair'?' on':''}`}><span>◆ ◆ ●</span><small>Deux identiques · 48 % des tirages</small><b>1,25×</b></div>
   </div>
  </GameFrame>
 )
}
