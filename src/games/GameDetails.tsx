import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GameDefinition } from '../data/games'
import { games } from '../data/games'
import { gameInfo, MAX_STAKE, MIN_STAKE } from '../data/gameInfo'
import { atlasPosition, money } from '../lib/format'
import { RoundHistory } from '../components/RoundHistory'

const TABS=[{id:'rules',label:'Règles'},{id:'pay',label:'Gains'},{id:'fair',label:'Équité et historique'}] as const

export function GameDetails({game}:{game:GameDefinition}){
 const info=gameInfo[game.id]
 const [tab,setTab]=useState<(typeof TABS)[number]['id']>('rules')
 const refs=useRef<Record<string,HTMLButtonElement|null>>({})
 const onKey=(event:React.KeyboardEvent,index:number)=>{
  const next=event.key==='ArrowRight'?(index+1)%TABS.length:event.key==='ArrowLeft'?(index+TABS.length-1)%TABS.length:-1
  if(next<0)return
  event.preventDefault();setTab(TABS[next].id);refs.current[TABS[next].id]?.focus()
 }
 return (
  <section className="gx-details" aria-label="Informations sur le jeu">
   <div className="gx-tabs" role="tablist" aria-label="Informations sur le jeu">
    {TABS.map((item,index)=><button key={item.id} ref={(node)=>{refs.current[item.id]=node}} role="tab" id={`tab-${item.id}`} aria-selected={tab===item.id} aria-controls={`panel-${item.id}`} tabIndex={tab===item.id?0:-1} onClick={()=>setTab(item.id)} onKeyDown={(event)=>onKey(event,index)}>{item.label}</button>)}
   </div>
   <div className="gx-tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
    {tab==='rules'&&<>
     <h2>Comment jouer à {game.name}</h2>
     <ul>{info.rules.map((rule)=><li key={rule}>{rule}</li>)}</ul>
     <p>Mise : de {money(MIN_STAKE)} à {money(MAX_STAKE)} par partie. Retour théorique au joueur : <b>{info.rtp.toLocaleString('fr-FR')} %</b>. Tous les crédits sont fictifs.</p>
    </>}
    {tab==='pay'&&<>
     <h2>Table des gains</h2>
     <table className="gx-paytable"><thead><tr><th scope="col">Résultat</th><th scope="col">Paiement</th></tr></thead><tbody>{info.payouts.map(([label,value])=><tr key={label}><td>{label}</td><td>{value}</td></tr>)}</tbody></table>
    </>}
    {tab==='fair'&&<>
     <h2>Équité vérifiable</h2>
     <p>Avant chaque partie, le serveur publie l’empreinte SHA-256 de sa graine secrète. Une fois la partie réglée, il révèle la graine : votre navigateur recalcule l’empreinte et la compare à celle annoncée avant le jeu. Si elles correspondent, le résultat n’a pas été modifié après votre mise.</p>
     <RoundHistory gameId={game.id}/>
    </>}
   </div>
  </section>
 )
}

export function SimilarGames({game}:{game:GameDefinition}){
 const others=games.filter((item)=>item.category===game.category&&item.id!==game.id).slice(0,6)
 return (
  <section className="similar" aria-labelledby="similar-title">
   <div className="section-row"><div><span className="page-kicker">À ESSAYER AUSSI</span><h2 id="similar-title">Jeux similaires</h2></div><Link to="/app/games">Tout le casino</Link></div>
   <div className="similar-row">
    {others.map((item)=>{const index=games.findIndex((entry)=>entry.id===item.id);return(
     <Link key={item.id} to={`/app/games/${item.id}`} style={{'--accent':item.accent} as React.CSSProperties}>
      <span className="sim-art game-atlas" style={{backgroundPosition:atlasPosition(index)}} aria-hidden="true"/>
      <strong>{item.name}</strong>
     </Link>)})}
   </div>
  </section>
 )
}
