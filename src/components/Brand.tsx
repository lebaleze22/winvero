import { Link } from 'react-router-dom'

export function Brand({compact=false}:{compact?:boolean}){return <Link to="/" className="brand" aria-label="Accueil Winvero"><span className="brand-mark"><span>W</span></span>{!compact&&<span className="brand-word">winvero<i>.</i></span>}</Link>}
