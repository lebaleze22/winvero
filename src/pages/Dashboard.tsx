import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Check, Gamepad2, Sparkles, WalletCards } from 'lucide-react'
import { games } from '../data/games'
import { useWinveroStore } from '../store/useWinveroStore'
import { money } from '../lib/format'
import { buildJourney } from '../lib/journey'
import { GameCard } from '../components/GameCard'
import { ActivityList } from '../components/ActivityList'
import { OverviewUnavailable } from '../components/OverviewUnavailable'

export function Dashboard(){
 const account=useWinveroStore((s)=>s.account)!;
 const balance=useWinveroStore((s)=>s.balance);
 const wallet=useWinveroStore((s)=>s.accessUnlocked);
 const ready=useWinveroStore((s)=>s.overviewStatus)==='ready';
 const activity=useWinveroStore((s)=>s.activity);
 const played=activity.filter((item)=>item.type==='game').length;
 const rooms=new Set(activity.filter((x)=>x.type==='game').map((x)=>x.label)).size;
 const journey=buildJourney(wallet,activity),done=journey.filter((step)=>step.done).length,next=journey.find((step)=>!step.done);
 const percent=Math.round(done/journey.length*100);

 return (
  <div className="dash">
   <section className="dash-hero">
    <div className="dash-hero-text">
     <span className="page-kicker">VUE JOUEUR</span>
     <h1>Bonjour, {account.firstName}.</h1>
     <p>Votre espace Winvero : crédits fictifs, vingt salles, résultats vérifiables.</p>
     {!ready?null:wallet?<Link to="/app/games" className="button">Choisir un jeu <Gamepad2 size={17}/></Link>:<Link to="/app/wallet" className="button">Débloquer mes crédits <WalletCards size={17}/></Link>}
    </div>
    {ready&&(
     <div className="dash-balance">
      <span>SOLDE FICTIF DISPONIBLE</span>
      <strong>{money(balance)}</strong>
      <p>Crédits fictifs Winvero</p>
      <Link to="/app/wallet">{wallet?'Voir mon accès':'Débloquer mes crédits'} <ArrowRight size={16}/></Link>
     </div>
    )}
   </section>
   {!ready&&<OverviewUnavailable/>}
   {ready&&!wallet&&(
    <div className="notice">
     <div>
      <WalletCards size={22}/>
      <span><strong>Terminez la vérification</strong><small>Saisissez vos 12 mots pour débloquer les crédits.</small></span>
     </div>
     <Link to="/app/wallet">Continuer <ArrowRight size={16}/></Link>
    </div>
   )}
   <div className="dash-cols">
    <div className="dash-main">
     <section>
      <div className="section-row">
       <div><span className="page-kicker">SÉLECTION POUR VOUS</span><h2>Jouer maintenant</h2></div>
       <Link to="/app/games">Les 20 jeux <ArrowRight size={15}/></Link>
      </div>
      <div className="rail">{games.slice(0,6).map((g)=><GameCard key={g.id} game={g}/>)}</div>
     </section>
     <section>
      <div className="section-row">
       <div><span className="page-kicker">TABLES</span><h2>Cartes et casino</h2></div>
      </div>
      <div className="rail">{games.filter((g)=>g.category==='Table').slice(0,6).map((g)=><GameCard key={g.id} game={g}/>)}</div>
     </section>
    </div>
    <aside className="dash-side">
     <section className="journey-card" aria-label="Progression du parcours">
      <div className="journey-ring" style={{'--pct':`${percent}%`} as React.CSSProperties} role="img" aria-label={`${done} étapes sur ${journey.length}`}><b>{done}/{journey.length}</b></div>
      <div>
       <span className="page-kicker">PARCOURS</span>
       <strong>{next?next.title:'Parcours terminé'}</strong>
       {next?.to?<Link to={next.to}>{next.cta} <ArrowRight size={14}/></Link>:<span className="journey-done"><Check size={14}/> Bravo</span>}
      </div>
     </section>
     <section className="mini-stats">
      <div><Activity size={18}/><strong>{played}</strong><small>parties jouées</small></div>
      <div><Sparkles size={18}/><strong>{rooms}</strong><small>salles essayées</small></div>
     </section>
     <section>
      <div className="section-row">
       <div><span className="page-kicker">DERNIERS MOUVEMENTS</span><h2>Activité récente</h2></div>
      </div>
      <ActivityList entries={activity.slice(0,5)}/>
      <Link to="/app/activity" className="text-button side-link">Historique complet <ArrowRight size={15}/></Link>
     </section>
    </aside>
   </div>
  </div>
 );
}
