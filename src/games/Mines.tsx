import { useState } from 'react'
import { Bomb, Gem, Pickaxe, Shuffle } from 'lucide-react'
import type { GameDefinition } from '../data/games'
import { money } from '../lib/format'
import { useRoundGame, validStake } from '../components/gameKit'
import { BetPanel, Cta, GameFrame, ResultBanner, Stat, toneOf } from './kit'

const CELLS=25,MINES=3
const comb=(n:number,k:number)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}
/** Même formule que le serveur (minesMultiplier) : 0,99 × C(25,n) ÷ C(22,n). */
const payout=(gems:number)=>gems>0&&gems<=22?Number((.99*comb(CELLS,gems)/comb(CELLS-MINES,gems)).toFixed(4)):1

export function MinesGame({game}:{game:GameDefinition}){
 const {balance,engine,round,busy,start,act,settled,net,live}=useRoundGame(game)
 const [stake,setStake]=useState('10')
 const result=(settled?round?.result:null) as {mines?:number[];opened?:number[];mine?:number}|null
 const opened=(settled?result?.opened:(live?.state as {opened?:number[]}|null)?.opened)??[]
 const mines=result?.mines??[]
 const hit=result?.mine
 const gems=opened.length
 const multiplier=settled?round?.multiplier??0:live?(gems?round?.multiplier||payout(gems):1):1
 const nextMultiplier=payout(gems+1),safeChance=(CELLS-MINES-gems)/(CELLS-gems)*100
 const stakeValue=live?live.stake:Number(stake)||0

 const begin=()=>{const amount=validStake(stake,balance);if(amount)void start(amount)}
 const open=(cell:number)=>{if(live&&!busy&&!opened.includes(cell))void act('reveal',{cell})}
 const randomCell=()=>{const free=Array.from({length:CELLS},(_,i)=>i).filter((i)=>!opened.includes(i));if(free.length)open(free[Math.floor(Math.random()*free.length)])}
 const lost=settled&&hit!==undefined
 const status=live?`${gems} gemme${gems>1?'s':''} · ${multiplier.toFixed(2)}×`:settled?(lost?'Mine touchée':'Encaissé'):'Prêt'

 return (
  <GameFrame game={game} tone={live?'live':toneOf(!!settled,net)} status={status}
   panel={<BetPanel balance={balance} stake={stake} setStake={setStake} error={engine.error} disabled={!!live||busy}
    cta={live?<>
      <Cta variant="cash" disabled={busy||!gems} onClick={()=>void act('cashout')}>{gems?`Encaisser ${money(stakeValue*multiplier)}`:'Ouvrez une case pour encaisser'}</Cta>
      <Cta variant="ghost" disabled={busy} onClick={randomCell}><Shuffle size={16} aria-hidden="true"/>Case au hasard</Cta>
     </>:<Cta disabled={busy||!validStake(stake,balance)} onClick={begin}><Pickaxe size={19} aria-hidden="true"/>{busy?'Préparation…':settled?'Nouvelle grille':'Commencer'}</Cta>}
    note="25 cases, 3 mines. Chaque gemme augmente le gain ; une mine termine la partie."/>}>
   {settled&&<ResultBanner id={round?.id} net={net} headline={lost?'MINE !':'ENCAISSÉ'} sub={lost?`${gems} gemme${gems>1?'s':''} avant la mine`:`${gems} gemme${gems>1?'s':''} · ${multiplier.toFixed(2)}×`}/>}
   <div className="mn-stats">
    <Stat label="Multiplicateur" value={`${multiplier.toFixed(2)}×`} tone={settled&&!lost?'win':lost?'loss':'gold'}/>
    <Stat label="Gemmes" value={`${gems} / ${CELLS-MINES}`}/>
    <Stat label={live||!settled?'Prochaine gemme':'Mines'} value={live||!settled?`${nextMultiplier.toFixed(2)}× · ${safeChance.toFixed(0)} %`:String(MINES)}/>
   </div>
   <div className="mn-board" role="group" aria-label="Grille de 25 cases">
    {Array.from({length:CELLS},(_,cell)=>{
     const isGem=opened.includes(cell),isMine=mines.includes(cell),isHit=hit===cell
     const shown=isGem||(settled&&isMine)
     const label=`Case ${cell+1}${isGem?' : gemme':settled&&isMine?(isHit?' : mine touchée':' : mine'):''}`
     return (
      <button key={cell} type="button" disabled={!live||busy||isGem} aria-label={label} onClick={()=>open(cell)}
       className={`mn-tile${shown?' flipped':''}${isGem?' gem':''}${settled&&isMine?' mine':''}${isHit?' hit':''}${settled&&!shown?' dim':''}`}
       style={{transitionDelay:settled&&isMine&&!isHit?`${(cell%7)*70}ms`:undefined}}>
       <span className="mn-front" aria-hidden="true"><i/></span>
       <span className="mn-back" aria-hidden="true">{isGem?<Gem size={30}/>:<Bomb size={30}/>}</span>
      </button>
     )
    })}
   </div>
  </GameFrame>
 )
}
