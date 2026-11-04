import type { CardData } from '../components/PlayingCard'
import { cardName, rankLabel } from '../components/PlayingCard'
import { money } from '../lib/format'

const GLYPH:Record<string,string>={S:'♠',H:'♥',D:'♦',C:'♣'}

/** Carte à jouer : les deux faces sont toujours dans le DOM, ce qui permet de la retourner en douceur. */
export function Card({card,delay=0,hidden,highlight,held}:{card:CardData;delay?:number;hidden?:boolean;highlight?:'win'|'loss'|'';held?:boolean}){
 const down=hidden??(card.hidden||!card.rank||!card.suit)
 const red=card.suit==='H'||card.suit==='D'
 const glyph=card.suit?GLYPH[card.suit]:''
 const label=card.rank?rankLabel(card.rank):''
 return (
  <span className={`cd${down?'':' up'}${red?' red':''}${highlight?` ${highlight}`:''}${held?' held':''}`} style={{animationDelay:`${delay}s`}} role="img" aria-label={down?'Carte cachée':cardName(card)}>
   <span className="cd-inner">
    <span className="cd-face">
     <b className="cd-idx">{label}<i>{glyph}</i></b>
     <b className="cd-mid">{card.rank&&card.rank>=11&&card.rank<14?<>{label}<i>{glyph}</i></>:glyph}</b>
     <b className="cd-idx flip">{label}<i>{glyph}</i></b>
    </span>
    <span className="cd-back"/>
   </span>
  </span>
 )
}

export function Hand({cards,startDelay=0,step=.22,hiddenFrom}:{cards:CardData[];startDelay?:number;step?:number;hiddenFrom?:number}){
 if(!cards.length)return <div className="hand empty" aria-hidden="true"><span className="cd ghost"/><span className="cd ghost"/></div>
 return <div className="hand">{cards.map((card,index)=><Card key={index} card={card} delay={startDelay+index*step} hidden={hiddenFrom!==undefined&&index>=hiddenFrom?true:undefined}/>)}</div>
}

export function TotalBadge({value,tone,label}:{value:number|string;tone?:'win'|'loss'|'push'|'bust';label?:string}){
 return <span className={`tb${tone?` ${tone}`:''}`} aria-label={label}>{value}</span>
}

/** Jeton de mise posé sur le tapis. */
export function Chip({amount,tone}:{amount:number;tone?:'win'|'loss'|'push'}){
 return <span className={`chip${tone?` ${tone}`:''}`} title={money(amount)}><b>{amount>=1000?`${(amount/1000).toFixed(amount%1000?1:0)}k`:Number.isInteger(amount)?amount:amount.toFixed(2)}</b></span>
}
