import { useEffect, useRef, useState } from 'react'
import { Spade } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import type { CardData } from '../components/PlayingCard'
import { money } from '../lib/format'
import { useRoundGame, validStake } from '../components/gameKit'
import { BetPanel, Cta, GameFrame, ResultBanner, toneOf } from './kit'
import { Chip, Hand, TotalBadge } from './cards'

interface HandState{cards:CardData[];total:number;wagerCents:number;stood:boolean}
interface LiveState{hands:HandState[];dealer:CardData[];currentHand:number;insuranceOffered:boolean;splitAvailable:boolean}
interface Outcome{cards:CardData[];total:number;outcome:string;wagerCents:number;returnedCents:number}
interface Settled{dealer:CardData[];dealerTotal:number;outcomes:Outcome[];insuranceCents:number;dealerNatural:boolean}

const OUTCOME:Record<string,{label:string;tone:'win'|'loss'|'push'}>={blackjack:{label:'Blackjack · 3:2',tone:'win'},win:{label:'Gagné',tone:'win'},push:{label:'Égalité',tone:'push'},lose:{label:'Perdu',tone:'loss'},bust:{label:'Brûlé',tone:'loss'}}

export function BlackjackGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled:done,live:liveRound}=useRoundGame(game)
 const [stake,setStake]=useState('10')
 const settled=done&&round?round.result as unknown as Settled:null
 const live=liveRound?liveRound.state as unknown as LiveState:null
 const hand=live?.hands[live.currentHand]
 // Blackjack naturel : seule issue possible, on laisse le croupier découvrir sa main.
 const natural=!!live&&!live.insuranceOffered&&live.hands.length===1&&hand?.cards.length===2&&hand.total===21
 const roundId=liveRound?.id
 const actRef=useRef(act);actRef.current=act
 useEffect(()=>{if(!natural||!roundId)return;const timer=window.setTimeout(()=>void actRef.current('stand'),1100);return()=>window.clearTimeout(timer)},[natural,roundId])
 const stakeValue=liveRound?liveRound.stake:Number(stake)||0
 const canDouble=!!hand&&hand.cards.length===2&&balance>=stakeValue
 const canSplit=!!live?.splitAvailable&&balance>=stakeValue
 const canInsure=!!live?.insuranceOffered&&balance>=stakeValue/2

 // Raccourcis : H tirer, S rester, D doubler, P séparer, A assurance.
 useEffect(()=>{
  if(!live)return
  const onKey=(event:KeyboardEvent)=>{
   if((event.target as HTMLElement|null)?.closest('input,textarea,select')||event.ctrlKey||event.metaKey||event.altKey||busy)return
   const key=event.key.toLowerCase()
   if(key==='h')void act('hit');else if(key==='s')void act('stand');else if(key==='d'&&canDouble)void act('double');else if(key==='p'&&canSplit)void act('split');else if(key==='a'&&canInsure)void act('insurance')
  }
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
 },[live,busy,canDouble,canSplit,canInsure,act])

 const wager=settled?(settled.outcomes.reduce((sum,item)=>sum+item.wagerCents,0)+settled.insuranceCents)/100:0
 const profit=settled&&round?round.payout-wager:0
 const dealerCards:CardData[]=settled?settled.dealer:live?live.dealer:[]
 const hands=settled
  ?settled.outcomes.map((item)=>({cards:item.cards,total:item.total,wager:item.wagerCents/100,note:OUTCOME[item.outcome],active:false}))
  :live?live.hands.map((item,index)=>({cards:item.cards,total:item.total,wager:item.wagerCents/100,note:undefined,active:index===live.currentHand&&live.hands.length>1})):[]
 const status=settled?(profit>0?'Gagné':profit<0?'Perdu':'Égalité'):natural?'Blackjack !':live?'À vous de jouer':'Prêt'
 const dealerTotal=settled?settled.dealerTotal:null

 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,profit)} status={status}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<>
      <div className="act-grid">
       <Cta hotkey={false} disabled={busy} onClick={()=>void act('hit')}>Tirer<small>H</small></Cta>
       <Cta hotkey={false} disabled={busy} onClick={()=>void act('stand')}>Rester<small>S</small></Cta>
       <Cta hotkey={false} disabled={busy||!canDouble} onClick={()=>void act('double')} title="Mise doublée, une seule carte, puis vous restez">Doubler<small>D</small></Cta>
       <Cta hotkey={false} disabled={busy||!canSplit} onClick={()=>void act('split')} title="Disponible avec deux cartes de même valeur">Séparer<small>P</small></Cta>
       {live.insuranceOffered&&<Cta hotkey={false} className="wide" disabled={busy||!canInsure} onClick={()=>void act('insurance')}>Assurance · {money(stakeValue/2)}<small>A · paie 2:1 si le croupier a blackjack</small></Cta>}
      </div>
     </>:<Cta disabled={busy||!validStake(stake,balance)} onClick={()=>{const amount=validStake(stake,balance);if(amount)void start(amount)}}><Spade size={19} aria-hidden="true"/>{busy?'Distribution…':done?'Nouvelle donne':'Distribuer'}</Cta>}
    note="Un seul jeu de 52 cartes. Le croupier tire jusqu’à 17 et reste sur 17 (même souple)."/>}>
   {settled&&round&&<ResultBanner id={round.id} net={profit} sub={settled.dealerNatural?'Le croupier avait un blackjack':dealerTotal!==null&&dealerTotal>21?`Le croupier brûle avec ${dealerTotal}`:`Le croupier s’arrête à ${dealerTotal}`}/>}
   <div className="table-felt bj">
    <div className="seat">
     <div className="seat-head">Croupier{dealerCards.length>0&&<TotalBadge value={settled?dealerTotal!:(dealerCards[0]?.rank?Math.min(dealerCards[0].rank,dealerCards[0].rank===14?11:10):'?')} tone={settled&&dealerTotal!==null&&dealerTotal>21?'bust':undefined} label="Total du croupier"/>}</div>
     <Hand cards={dealerCards} step={settled?.35:.25}/>
    </div>
    <p className="table-rule">Blackjack paie 3:2 · Assurance 2:1 · Le croupier reste sur 17</p>
    <div className="seats-row">
     {hands.length?hands.map((item,index)=>(
      <div className={`seat${item.active?' active':''}`} key={index}>
       <Hand cards={item.cards} step={.22}/>
       <div className="seat-head">{hands.length>1?`Main ${index+1}`:'Vous'}<TotalBadge value={item.total} tone={item.total>21?'bust':item.total===21?'win':undefined} label="Votre total"/><Chip amount={item.wager} tone={item.note?.tone}/></div>
       {item.note&&<span className={`seat-note ${item.note.tone}`}>{item.note.label}</span>}
      </div>
     )):<div className="seat"><Hand cards={[]}/><div className="seat-head">Vous</div></div>}
    </div>
   </div>
  </GameFrame>
 )
}
