import { useWinveroStore } from '../store/useWinveroStore'
import { ActivityList } from '../components/ActivityList'

export function ActivityPage(){
 const entries=useWinveroStore((s)=>s.activity);
 return (
  <>
   <div className="page-heading">
    <div><span className="page-kicker">REGISTRE DU COMPTE</span><h1>Historique d’activité</h1><p>Vos crédits simulés et vos parties fictives.</p></div>
   </div>
   <ActivityList entries={entries}/>
  </>
 );
}
