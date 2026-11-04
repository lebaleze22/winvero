import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import { games } from '../data/games'
import { useWinveroStore } from '../store/useWinveroStore'
import { Brand } from '../components/Brand'
import { GameCard } from '../components/GameCard'

export function Landing(){
 const account=useWinveroStore((s)=>s.account)
 useEffect(()=>{
  const items=[...document.querySelectorAll<HTMLElement>('[data-reveal]')]
  if(!('IntersectionObserver' in window)){items.forEach((item)=>item.classList.add('in'));return}
  const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}}),{threshold:0,rootMargin:'0px 0px -6% 0px'})
  items.forEach((item)=>observer.observe(item))
  return()=>observer.disconnect()
 },[])
 return <div className="landing"><header className="public-nav"><Brand/><nav><a href="#games">Jeux</a><a href="#process">Fonctionnement</a><Link to={account?'/app':'/start'} className="button small">{account?'Ouvrir l’espace':'Rejoindre Winvero'}</Link></nav></header><main>
 <section className="hero"><div className="hero-copy"><div className="eyebrow"><span/> EXPÉRIENCE DE JEU NOUVELLE GÉNÉRATION</div><h1>Jouez avec style.<br/><em>Vibrez sans limite.</em></h1><p>Vingt univers exclusifs, un solde de démonstration transparent et une expérience conçue pour le spectacle. Aucun fonds réel ne transite par Winvero.</p><div className="hero-actions"><Link to={account?'/app/games':'/start'} className="button">Entrer dans l’arène <ArrowRight size={17}/></Link><a href="#process" className="text-button">Découvrir le concept <ChevronRight size={16}/></a></div><div className="trust-row"><span><ShieldCheck size={17}/> Crédits fictifs</span><span><WalletCards size={17}/> Accès de laboratoire</span><span><Sparkles size={17}/> 20 jeux originaux</span></div></div>
 <div className="hero-visual"><div className="performance-card"><div className="performance-head"><span><i/> PERFORMANCE LIVE</span><b>+18,42 %</b></div><strong>28 564,80 <small>WVC</small></strong><p>Volume des gains · dernières 24 h</p><svg viewBox="0 0 520 190" role="img" aria-label="Courbe de performance fictive"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c250ff" stopOpacity=".52"/><stop offset="1" stopColor="#6a36ff" stopOpacity="0"/></linearGradient><linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#7f5cff"/><stop offset=".55" stopColor="#ee4ab7"/><stop offset="1" stopColor="#55ddff"/></linearGradient></defs><path className="chart-grid" d="M0 35H520M0 80H520M0 125H520M0 170H520"/><path className="chart-fill" d="M0 157 C44 152 58 124 91 132 S144 103 177 113 S224 76 264 91 S323 48 358 66 S404 26 442 42 S486 16 520 20 L520 190 L0 190Z"/><path className="chart-line" d="M0 157 C44 152 58 124 91 132 S144 103 177 113 S224 76 264 91 S323 48 358 66 S404 26 442 42 S486 16 520 20"/><circle className="chart-point" cx="442" cy="42" r="6"/></svg><div className="chart-stats"><span><small>JOUEURS EN LIGNE</small><b>4 826</b></span><span><small>PLUS GROS GAIN</small><b>428,6×</b></span><span><small>PARTIES / MIN</small><b>1 294</b></span></div></div></div></section>
 <section className="proof-strip" data-reveal><span><b>20</b> salles de jeu</span><span><b>4 826</b> joueurs en ligne</span><span><b>428,6×</b> gain maximum live</span><span><b>100 %</b> simulation</span></section>
 <section className="section-block" id="games"><div className="section-heading" data-reveal><div><div className="eyebrow"><span/> LA COLLECTION</div><h2>Un univers pour chaque joueur.</h2></div><Link to={account?'/app/games':'/start'} className="text-button">Voir les 20 jeux <ArrowRight size={16}/></Link></div><div className="feature-grid" data-reveal>{games.slice(0,8).map((game)=><GameCard key={game.id} game={game}/>)}</div></section>
 <section className="process section-block" id="process"><div><div className="eyebrow light"><span/> COMMENT ÇA MARCHE</div><h2>Du premier clic au jeu<br/>en trois étapes.</h2><p>Winvero utilise exclusivement des crédits fictifs. Toutes les opérations restent des simulations locales.</p></div><ol data-reveal><li><b>01</b><div><strong>Créez votre profil joueur</strong><span>Quelques informations suffisent pour personnaliser votre espace.</span></div></li><li><b>02</b><div><strong>Vérifiez votre code Winvero</strong><span>Saisissez vos 12 mots secrets pour le laboratoire.</span></div></li><li><b>03</b><div><strong>Recevez vos crédits et jouez</strong><span>La validation débloque un solde fictif utilisable dans toutes les salles.</span></div></li></ol></section>
 </main><footer className="public-footer"><Brand/><p>Winvero est un prototype de jeu fictif. Aucun dépôt, retrait ou gain réel.</p><span>© 2026 Winvero</span></footer></div>
}
