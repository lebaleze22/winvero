import { useEffect, useState } from 'react'
import { Layers3, Sparkles, Swords, Trophy } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import type { CardData } from '../components/PlayingCard'
import { money } from '../lib/format'
import { useRoundGame, validStake } from '../components/gameKit'
import { BetPanel, Cta, GameFrame, ResultBanner, toneOf } from './kit'
import { Card, Chip, Hand, TotalBadge } from './cards'

const toCard=(value:unknown):CardData=>typeof value==='string'?{card:value,rank:parseInt(value,10),suit:value.at(-1)}:(value as CardData)
const HAND_NAMES:Record<string,string>={high_card:'Carte haute',pair:'Paire',low_pair:'Paire basse',jacks_or_better:'Valets ou mieux',two_pair:'Double paire',three_kind:'Brelan',straight:'Suite',flush:'Couleur',full_house:'Full',four_kind:'Carré',straight_flush:'Quinte flush',royal_flush:'Quinte flush royale'}
const handName=(key:unknown)=>HAND_NAMES[String(key)]??String(key??'')

/* ------------------------------------------------------------------ */
/*  Baccarat                                                           */
/* ------------------------------------------------------------------ */
type BaccaratBet='player'|'tie'|'banker'
const SPOTS:{id:BaccaratBet;label:string;pay:string}[]=[{id:'player',label:'Joueur',pay:'2×'},{id:'tie',label:'Égalité',pay:'9×'},{id:'banker',label:'Banquier',pay:'1,95×'}]
interface BaccaratResult{winner:string;player:CardData[];banker:CardData[];playerTotal:number;bankerTotal:number;bet:string}

export function BaccaratGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,settled,net}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[bet,setBet]=useState<BaccaratBet>('player'),[road,setRoad]=useState<string[]>([])
 const res=settled?round?.result as unknown as BaccaratResult:null
 useEffect(()=>{if(res&&round)setRoad((items)=>[...items,res.winner].slice(-18))},[round?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 const deal=()=>{const amount=validStake(stake,balance);if(amount)void start(amount,{bet})}
 const winnerLabel=res?(res.winner==='tie'?'Égalité':res.winner==='player'?'Le Joueur gagne':'Le Banquier gagne'):''
 return (
  <GameFrame game={game} tone={toneOf(!!res,net)} status={res?winnerLabel:busy?'Distribution…':'Placez votre mise'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={busy}
    cta={<Cta disabled={busy||!validStake(stake,balance)} onClick={deal}><Sparkles size={19} aria-hidden="true"/>{busy?'Distribution…':res?'Nouvelle donne':'Distribuer'}</Cta>}
    note="Huit jeux de cartes. La main la plus proche de 9 gagne ; le troisième tirage suit les règles du baccarat."/>}>
   {res&&<ResultBanner id={round?.id} net={net} sub={`${res.playerTotal} contre ${res.bankerTotal}`}/>}
   <div className="table-felt">
    <div className="bc-hands">
     <div className={`seat${res?.winner==='player'?' active':''}`}><div className="seat-head">Joueur{res&&<TotalBadge value={res.playerTotal} tone={res.winner==='player'?'win':undefined}/>}</div><Hand cards={res?.player??[]} step={.4}/></div>
     <div className={`seat${res?.winner==='banker'?' active':''}`}><div className="seat-head">Banquier{res&&<TotalBadge value={res.bankerTotal} tone={res.winner==='banker'?'win':undefined}/>}</div><Hand cards={res?.banker??[]} startDelay={.2} step={.4}/></div>
    </div>
    <div className="bc-spots" role="radiogroup" aria-label="Votre pari">
     {SPOTS.map((spot)=>(
      <button key={spot.id} type="button" role="radio" aria-checked={bet===spot.id} disabled={busy} className={`bc-spot ${spot.id}${bet===spot.id?' on':''}${res?.winner===spot.id?' won':''}`} onClick={()=>setBet(spot.id)}>
       <span>{spot.label}</span><b>{spot.pay}</b>
       {bet===spot.id&&<Chip amount={Number(stake)||0} tone={res&&res.bet===spot.id?(res.winner===spot.id?'win':'loss'):undefined}/>}
      </button>
     ))}
    </div>
    <div className="bc-road" aria-label="Historique des mains">{road.length?road.map((winner,index)=><i key={index} className={winner} title={winner==='player'?'Joueur':winner==='banker'?'Banquier':'Égalité'}/>):<span>Les mains jouées apparaîtront ici.</span>}</div>
   </div>
  </GameFrame>
 )
}

/* ------------------------------------------------------------------ */
/*  Bataille                                                           */
/* ------------------------------------------------------------------ */
interface WarView{playerCard:string;dealerCard:string;playerWar?:string;dealerWar?:string;outcome?:string;availableActions?:string[]}
const WAR_TEXT:Record<string,string>={win:'Votre carte est plus forte.',lose:'La carte du croupier est plus forte.',surrender:'Abandon : la moitié de la mise est rendue.',war_win:'Vous gagnez la guerre !',war_lose:'Vous perdez la guerre.',war_tie:'Nouvelle égalité : la guerre est payée.'}

export function WarGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10')
 const view=(settled?round?.result:live?.state) as WarView|null|undefined
 const actions=live?(view?.availableActions??[]):[]
 const dealerCards=view?[view.dealerCard,view.dealerWar].filter(Boolean).map(toCard):[]
 const playerCards=view?[view.playerCard,view.playerWar].filter(Boolean).map(toCard):[]
 const winSide=settled?(net>0?'player':net<0?'dealer':''):''
 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,net)} status={live?'Égalité : guerre ou abandon ?':settled?(net>0?'Gagné':net<0?'Perdu':'Égalité'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<div className="act-grid">
      {actions.includes('war')&&<Cta hotkey={false} disabled={busy||balance<live.stake} onClick={()=>void act('war')}><Swords size={17} aria-hidden="true"/>Guerre<small>{money(live.stake)}</small></Cta>}
      {actions.includes('surrender')&&<Cta hotkey={false} disabled={busy} onClick={()=>void act('surrender')}>Abandonner<small>½ mise</small></Cta>}
      {actions.includes('resolve')&&<Cta hotkey={false} className="wide" disabled={busy} onClick={()=>void act('resolve')}>Comparer</Cta>}
     </div>:<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>{const amount=validStake(stake,balance);if(amount)void start(amount)}}><Layers3 size={19} aria-hidden="true"/>{busy?'Distribution…':settled?'Nouvelle donne':'Distribuer'}</Cta>}
    note="Victoire 1:1 · guerre gagnée 2:1 · abandon : ½ mise. As en haut."/>}>
   {settled&&<ResultBanner id={round?.id} net={net} sub={WAR_TEXT[(view as WarView|undefined)?.outcome??'']}/>}
   <div className="table-felt">
    <div className="war-face">
     <div className={`seat${winSide==='dealer'?' active':''}`}><div className="seat-head">Croupier</div><Hand cards={dealerCards} step={.5}/></div>
     <span className="war-vs" aria-hidden="true">VS</span>
     <div className={`seat${winSide==='player'?' active':''}`}><div className="seat-head">Vous<Chip amount={live?live.stake:Number(stake)||0}/></div><Hand cards={playerCards} startDelay={.25} step={.5}/></div>
    </div>
    {live&&<p className="table-rule war-alert">Égalité ! Déclarez la guerre (mise supplémentaire) ou abandonnez.</p>}
   </div>
  </GameFrame>
 )
}

/* ------------------------------------------------------------------ */
/*  Vidéo poker                                                        */
/* ------------------------------------------------------------------ */
const PAYTABLE:[string,string][]=[['royal_flush','800×'],['straight_flush','50×'],['four_kind','25×'],['full_house','9×'],['flush','6×'],['straight','4×'],['three_kind','3×'],['two_pair','2×'],['jacks_or_better','1×']]

export function VideoPokerGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10'),[holds,setHolds]=useState<number[]>([])
 const view=(settled?round?.result:live?.state) as {hand?:CardData[];category?:string}|null|undefined
 const category=settled?String(view?.category??''):''
 const toggle=(index:number)=>{if(live&&!busy)setHolds((items)=>items.includes(index)?items.filter((item)=>item!==index):[...items,index])}
 const deal=async()=>{const amount=validStake(stake,balance);if(!amount)return;setHolds([]);await start(amount)}
 // Touches 1 à 5 : garder / relâcher une carte.
 useEffect(()=>{
  if(!live)return
  const onKey=(event:KeyboardEvent)=>{if(event.ctrlKey||event.metaKey||event.altKey||(event.target as HTMLElement|null)?.closest('input,textarea,select'))return;const n=Number(event.key);if(n>=1&&n<=5)toggle(n-1)}
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
 })
 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,net)} status={live?'Choisissez vos cartes':settled?(category&&category!=='none'?handName(category):'Aucune combinaison'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<Cta disabled={busy} onClick={()=>void act('draw',{holds})}>{busy?'Tirage…':holds.length===5?'Garder les 5 cartes':`Tirer ${5-holds.length} carte${5-holds.length>1?'s':''}`}</Cta>
     :<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>void deal()}><Trophy size={19} aria-hidden="true"/>{busy?'Distribution…':settled?'Nouvelle main':'Distribuer'}</Cta>}
    note={live?'Cliquez sur les cartes à conserver (ou touches 1 à 5), puis tirez. Un seul échange.':'Jacks or Better : valets ou mieux paie 1×.'}/>}>
   {settled&&<ResultBanner id={round?.id} net={net} headline={category&&category!=='none'?handName(category).toUpperCase():'PERDU'}/>}
   <div className="table-felt">
    <ol className="vp-pay" aria-label="Table des gains">{PAYTABLE.map(([key,pay])=><li key={key} className={category===key?'hit':''}><span>{handName(key)}</span><b>{pay}</b></li>)}</ol>
    <div className="vp-hand">
     {view?.hand?view.hand.map((card,index)=>(
      <button key={index} type="button" className={`vp-slot${live&&holds.includes(index)?' held':''}`} disabled={!live||busy} aria-pressed={holds.includes(index)} aria-label={`${live?'Garder ':''}carte ${index+1}`} onClick={()=>toggle(index)}>
       <Card card={card} delay={settled?0:index*.14} held={!!live&&holds.includes(index)}/>
       <span className="vp-tag">{live?(holds.includes(index)?'GARDÉE':`${index+1}`):''}</span>
      </button>
     )):<Hand cards={[]}/>}
    </div>
   </div>
  </GameFrame>
 )
}

/* ------------------------------------------------------------------ */
/*  Poker à trois cartes                                               */
/* ------------------------------------------------------------------ */
interface TcpView{player:CardData[];dealer:CardData[];playerCategory?:string;dealerCategory?:string;dealerQualifies?:boolean;outcome?:string;anteBonus?:number}

export function ThreeCardPokerGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10')
 const view=(settled?round?.result:live?.state) as TcpView|null|undefined
 const sub=settled?(view?.outcome==='fold'?'Vous vous couchez : la mise est perdue.':!view?.dealerQualifies&&view?.outcome!=='fold'?'Le croupier ne se qualifie pas (Dame haute minimum).':`${handName(view?.playerCategory)} contre ${handName(view?.dealerCategory)}`):undefined
 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,net)} status={live?'Jouer ou se coucher ?':settled?(net>0?'Gagné':net<0?'Perdu':'Égalité'):'Prêt'}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<div className="act-grid">
      <Cta hotkey={false} disabled={busy||balance<live.stake} onClick={()=>void act('play')}>Jouer<small>{money(live.stake)}</small></Cta>
      <Cta hotkey={false} disabled={busy} onClick={()=>void act('fold')}>Se coucher<small>perd l’ante</small></Cta>
     </div>:<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>{const amount=validStake(stake,balance);if(amount)void start(amount)}}><Trophy size={19} aria-hidden="true"/>{busy?'Distribution…':settled?'Nouvelle donne':'Distribuer'}</Cta>}
    note="Le croupier se qualifie avec Dame haute. Bonus d’ante : suite 1:1, brelan 4:1, quinte flush 5:1."/>}>
   {settled&&<ResultBanner id={round?.id} net={net} sub={sub}/>}
   <div className="table-felt">
    <div className="seat"><div className="seat-head">Croupier{settled&&view?.dealerCategory&&<span className="seat-tag">{handName(view.dealerCategory)}</span>}</div><Hand cards={view?.dealer??[]} step={.3}/></div>
    <p className="table-rule">Ante + jeu · Dame haute pour se qualifier</p>
    <div className={`seat${settled&&net>0?' active':''}`}><Hand cards={view?.player??[]} step={.25}/><div className="seat-head">Vous{view?.playerCategory&&<span className="seat-tag">{handName(view.playerCategory)}</span>}<Chip amount={live?live.stake:Number(stake)||0}/></div>
     {settled&&view?.anteBonus?<span className="seat-note win">Bonus d’ante {view.anteBonus}×</span>:null}</div>
   </div>
  </GameFrame>
 )
}
