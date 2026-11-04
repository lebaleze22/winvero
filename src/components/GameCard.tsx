import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { games } from '../data/games'
import { useWinveroStore } from '../store/useWinveroStore'
import { atlasPosition, categoryLabel } from '../lib/format'

export function GameCard({game,featured=false}:{game:(typeof games)[number];featured?:boolean}){const account=useWinveroStore((s)=>s.account);const gameIndex=games.findIndex((item)=>item.id===game.id);return <Link to={account?`/app/games/${game.id}`:'/start'} className={`game-card ${featured?'featured':''}`} style={{'--accent':game.accent} as React.CSSProperties}><div className="game-art"><span className="game-icon game-atlas" style={{backgroundPosition:atlasPosition(gameIndex)}}/><span className="game-multi">jusqu’à {game.maxMultiplier}</span></div><div className="game-info"><span>{categoryLabel[game.category]}</span><h3>{game.name}</h3><p>{game.description}</p></div><span className="round-link"><ArrowRight size={17}/></span></Link>}
