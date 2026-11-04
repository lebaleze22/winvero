import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { games } from '../data/games'
import { GameCard } from '../components/GameCard'
import { atlasPosition, categoryLabel } from '../lib/format'

type Filter='All'|'Originals'|'Table'|'Arcade'
const LABELS:Record<Filter,string>={All:'Tous',Originals:'Originaux',Table:'Casino',Arcade:'Arcade'}
const CATEGORIES=['Originals','Table','Arcade'] as const

export function GamesPage(){
 const [filter,setFilter]=useState<Filter>('All'),[query,setQuery]=useState('');
 const search=query.trim().toLowerCase();
 const visible=games.filter((g)=>(filter==='All'||g.category===filter)&&(!search||g.name.toLowerCase().includes(search)||g.description.toLowerCase().includes(search)));
 // Salle à l'honneur : change chaque jour, sans aléatoire ni donnée inventée.
 const spotlight=games[Math.floor(Date.now()/86400000)%games.length];
 const spotIndex=games.findIndex((g)=>g.id===spotlight.id);
 const grouped=filter==='All'&&!search;

 return (
  <div className="catalog">
   <section className="spotlight" style={{'--accent':spotlight.accent} as React.CSSProperties}>
    <div className="spotlight-text">
     <span className="page-kicker">SALLE DU JOUR · {categoryLabel[spotlight.category].toUpperCase()}</span>
     <h1>{spotlight.name}</h1>
     <p>{spotlight.description}</p>
     <div className="spotlight-meta"><span>jusqu’à {spotlight.maxMultiplier}</span><span>Crédits fictifs</span></div>
     <Link to={`/app/games/${spotlight.id}`} className="button">Jouer <ArrowRight size={17}/></Link>
    </div>
    <span className="spotlight-art game-atlas" style={{backgroundPosition:atlasPosition(spotIndex)}} aria-hidden="true"/>
   </section>
   <div className="catalog-bar">
    <div className="filter-row">
     {(Object.keys(LABELS) as Filter[]).map((x)=>(
      <button key={x} className={filter===x?'active':''} aria-pressed={filter===x} onClick={()=>setFilter(x)}>
       {LABELS[x]}<span>{x==='All'?games.length:games.filter((g)=>g.category===x).length}</span>
      </button>
     ))}
    </div>
    <label className="search-box"><Search size={16} aria-hidden="true"/><span className="sr-only">Rechercher un jeu</span><input type="search" placeholder="Rechercher un jeu" value={query} onChange={(event)=>setQuery(event.target.value)}/></label>
   </div>
   <h2 className="sr-only">Catalogue des jeux</h2>
   {grouped?CATEGORIES.map((category)=>(
    <section key={category} className="catalog-group">
     <div className="section-row"><div><span className="page-kicker">{games.filter((g)=>g.category===category).length} SALLES</span><h2>{LABELS[category]}</h2></div></div>
     <div className="catalog-grid">{games.filter((g)=>g.category===category).map((g)=><GameCard key={g.id} game={g}/>)}</div>
    </section>
   )):visible.length?(
    <div className="catalog-grid">{visible.map((g)=><GameCard key={g.id} game={g}/>)}</div>
   ):<p className="empty-list" role="status">Aucun jeu ne correspond à « {query} ».</p>}
  </div>
 );
}
