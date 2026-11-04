import { useEffect, useId, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { gameInfo, MAX_STAKE, MIN_STAKE } from '../data/gameInfo'
import { money } from '../lib/format'
import { useRounds } from '../components/RoundHistory'

/* ------------------------------------------------------------------ */
/*  Outils d'animation : tout passe par requestAnimationFrame, donc    */
/*  la cadence suit la fréquence de rafraîchissement de l'écran.       */
/* ------------------------------------------------------------------ */

export const reducedMotion=()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const easeOutCubic=(t:number)=>1-Math.pow(1-t,3)
export const easeOutQuart=(t:number)=>1-Math.pow(1-t,4)
export const easeInOutCubic=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)

/** Lance une animation sur `duration` ms ; `draw` reçoit la progression 0→1. Retourne une fonction d'annulation. */
export function animate(duration:number,draw:(t:number)=>void,done?:()=>void){
 if(reducedMotion()){draw(1);done?.();return()=>undefined}
 let frame=0,start=0,cancelled=false
 const tick=(now:number)=>{
  if(cancelled)return
  if(!start)start=now
  const t=Math.min(1,(now-start)/duration)
  draw(t)
  if(t<1)frame=requestAnimationFrame(tick);else done?.()
 }
 frame=requestAnimationFrame(tick)
 return()=>{cancelled=true;cancelAnimationFrame(frame)}
}

/** Valeur qui monte de 0 à `target` ; se relance quand `key` change. */
export function useCountUp(target:number,key:unknown,duration=800){
 const [value,setValue]=useState(0)
 useEffect(()=>animate(duration,(t)=>setValue(target*easeOutCubic(t))),[target,key,duration])
 return value
}

/** Minuterie nettoyée au démontage : évite les mises à jour sur composant démonté. */
export function useTimers(){
 const timers=useRef<number[]>([])
 useEffect(()=>()=>timers.current.forEach((timer)=>window.clearTimeout(timer)),[])
 return (callback:()=>void,delay:number)=>{timers.current.push(window.setTimeout(callback,delay))}
}

export const wait=(delay:number)=>new Promise<void>((resolve)=>window.setTimeout(resolve,reducedMotion()?0:delay))

/* ------------------------------------------------------------------ */
/*  Cadre de jeu                                                       */
/* ------------------------------------------------------------------ */

export type Tone='idle'|'live'|'win'|'loss'|'push'

export const toneOf=(settled:boolean,net:number):Tone=>settled?(net>0?'win':net<0?'loss':'push'):'idle'

export function GameFrame({game,tone='idle',status,panel,children}:{game:GameDefinition;tone?:Tone;status:string;panel:React.ReactNode;children:React.ReactNode}){
 const theme=gameInfo[game.id].theme
 return (
  <div className="gx" style={{'--accent':game.accent} as React.CSSProperties}>
   <section className={`gx-stage theme-${theme}`} aria-label={`Table de jeu ${game.name}`}>
    <div className="gx-stage-top">
     <span className="gx-name"><game.icon size={18} aria-hidden="true"/>{game.name}</span>
     <span className={`gx-status ${tone}`} role="status" aria-live="polite">{status}</span>
    </div>
    <div className="gx-body">{children}</div>
    <RoundStrip gameId={game.id}/>
   </section>
   <aside className="gx-panel" aria-label="Mise et actions">{panel}</aside>
  </div>
 )
}

/** Bandeau de résultat : apparaît au règlement, ne bloque jamais le jeu. */
export function ResultBanner({id,net,headline,sub}:{id:string|undefined;net:number;headline?:string;sub?:string}){
 const shown=useCountUp(Math.abs(net),id,900)
 if(!id)return null
 const tone=net>0?'win':net<0?'loss':'push'
 return (
  <div className={`gx-result ${tone}`} key={id} role="status">
   <small>{headline??(net>0?'GAGNÉ':net<0?'PERDU':'ÉGALITÉ')}</small>
   <strong>{net===0?money(0):`${net>0?'+':'−'}${money(shown)}`}</strong>
   {sub&&<span>{sub}</span>}
  </div>
 )
}

/** Dernières parties de la session sous la table : un coup d'œil sur la série en cours. */
export function RoundStrip({gameId}:{gameId:string}){
 const list=useRounds(gameId)
 if(!list?.length)return <div className="gx-strip empty"><span>Vos dernières parties apparaîtront ici.</span></div>
 return (
  <ol className="gx-strip" aria-label="Dernières parties">
   {list.slice(0,12).map((round)=>{const tone=round.payout>round.stake?'win':round.payout<round.stake?'loss':'push';return <li key={round.id} className={tone} title={`Mise ${money(round.stake)} · paiement ${money(round.payout)}`}>{round.multiplier>0?`${round.multiplier.toFixed(2)}×`:'0×'}</li>})}
  </ol>
 )
}

/* ------------------------------------------------------------------ */
/*  Panneau de mise                                                    */
/* ------------------------------------------------------------------ */

const toStake=(value:number)=>String(Math.floor(value*100)/100)

export function BetPanel({balance,stake,setStake,error,disabled,children,cta,note}:{balance:number;stake:string;setStake:(value:string)=>void;error?:string;disabled?:boolean;children?:React.ReactNode;cta:React.ReactNode;note?:React.ReactNode}){
 const id=useId(),ref=useRef<HTMLDivElement>(null)
 const value=Number(stake),max=Math.min(MAX_STAKE,balance)
 const invalid=!(value>=MIN_STAKE)||value>balance||value>MAX_STAKE
 // Raccourci clavier : Espace lance l'action principale tant qu'aucun champ n'a le focus.
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.code!=='Space'||event.repeat)return
   const target=event.target as HTMLElement|null
   if(target&&(target.closest('input,textarea,select,button,a,[role=radio],[role=switch]')))return
   const button=ref.current?.querySelector<HTMLButtonElement>('[data-cta]:not(:disabled)')
   if(button){event.preventDefault();button.click()}
  }
  window.addEventListener('keydown',onKey)
  return()=>window.removeEventListener('keydown',onKey)
 },[])
 return (
  <div className="gx-panel-inner" ref={ref}>
   <div className="gx-field">
    <div className="gx-field-head"><label htmlFor={id}>Mise</label><span className="gx-balance">Solde <b>{money(balance)}</b></span></div>
    <div className="gx-stake">
     <input id={id} type="number" inputMode="decimal" min={MIN_STAKE} max={MAX_STAKE} step="0.01" value={stake} disabled={disabled} onChange={(event)=>setStake(event.target.value)} aria-invalid={invalid&&stake!==''}/>
     <span className="gx-unit">WVC</span>
     <button type="button" disabled={disabled} onClick={()=>setStake(toStake(Math.max(MIN_STAKE,value/2||MIN_STAKE)))} aria-label="Diviser la mise par deux">½</button>
     <button type="button" disabled={disabled} onClick={()=>setStake(toStake(Math.min(max||MIN_STAKE,(value||MIN_STAKE)*2)))} aria-label="Doubler la mise">2×</button>
     <button type="button" disabled={disabled||max<MIN_STAKE} onClick={()=>setStake(toStake(max))} aria-label="Mise maximale">Max</button>
    </div>
    <div className="gx-chips" role="group" aria-label="Mises rapides">{[5,10,25,50,100].map((amount)=><button key={amount} type="button" disabled={disabled||amount>balance} className={value===amount?'on':''} onClick={()=>setStake(String(amount))}>{amount}</button>)}</div>
   </div>
   {children}
   <div className="gx-cta-wrap">{cta}</div>
   {note&&<div className="gx-note">{note}</div>}
   {!error&&value>balance&&<p className="gx-msg warn" role="status">{balance>0?'Votre mise dépasse votre solde disponible.':'Votre solde est de 0,00 WVC.'}</p>}
   {!error&&value>MAX_STAKE&&<p className="gx-msg warn" role="status">La mise maximale est de {money(MAX_STAKE)}.</p>}
   {error&&<p className="gx-msg err" role="alert">{error}</p>}
   <p className="gx-foot"><ShieldCheck size={14} aria-hidden="true"/> Mise {MIN_STAKE} – {MAX_STAKE.toLocaleString('fr-FR')} WVC · <kbd>Espace</kbd> pour lancer</p>
  </div>
 )
}

export function Cta({children,variant='main',hotkey=true,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'main'|'cash'|'ghost';hotkey?:boolean}){
 return <button type="button" {...props} data-cta={variant==='ghost'||!hotkey?undefined:''} className={`gx-cta ${variant}${props.className?` ${props.className}`:''}`}>{children}</button>
}

export function Segmented<T extends string|number>({label,value,onChange,options,disabled,columns}:{label:string;value:T;onChange:(value:T)=>void;options:{value:T;label:string;hint?:string}[];disabled?:boolean;columns?:number}){
 return (
  <div className="gx-field">
   <div className="gx-field-head"><span className="gx-label">{label}</span></div>
   <div className="gx-seg" role="radiogroup" aria-label={label} style={columns?{gridTemplateColumns:`repeat(${columns},1fr)`}:undefined}>
    {options.map((option)=><button key={String(option.value)} type="button" role="radio" aria-checked={value===option.value} disabled={disabled} className={value===option.value?'on':''} onClick={()=>onChange(option.value)}><span>{option.label}</span>{option.hint&&<small>{option.hint}</small>}</button>)}
   </div>
  </div>
 )
}

export function Stat({label,value,tone}:{label:string;value:string;tone?:'win'|'loss'|'gold'}){
 return <div className={`gx-stat${tone?` ${tone}`:''}`}><small>{label}</small><b>{value}</b></div>
}
