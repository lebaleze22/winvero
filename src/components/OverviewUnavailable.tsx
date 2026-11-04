import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'
import { getCreditOverview } from '../services/creditApi'

/** Affiché quand la session est valide mais que l'état du compte (solde, accès) n'a pas pu être lu. */
export function OverviewUnavailable(){
 const setCreditOverview=useWinveroStore((s)=>s.setCreditOverview)
 const [busy,setBusy]=useState(false)
 const [failed,setFailed]=useState(false)
 const retry=async()=>{setBusy(true);setFailed(false);try{setCreditOverview(await getCreditOverview())}catch{setFailed(true)}finally{setBusy(false)}}
 return (
  <div className="notice" role="alert">
   <div>
    <AlertTriangle size={22}/>
    <span><strong>État du compte indisponible</strong><small>{failed?'Toujours impossible de joindre le serveur. Réessayez dans un instant.':'Impossible de lire votre solde et votre accès pour le moment. Aucun changement n’a été appliqué.'}</small></span>
   </div>
   <button type="button" className="auth-mode-link" disabled={busy} onClick={()=>void retry()}>{busy?'Lecture…':'Réessayer'}</button>
  </div>
 )
}
