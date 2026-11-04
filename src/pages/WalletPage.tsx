import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'
import { getCreditOverview, getCodeSubmission, submitWinveroCode } from '../services/creditApi'
import { money } from '../lib/format'
import { WalletSkeleton } from '../components/Skeleton'

export function WalletPage(){
 const csrf=useWinveroStore(s=>s.csrfToken);
 const [words,setWords]=useState<string[]>(Array(12).fill(''));
 const [pending,setPending]=useState(false);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [codeLoaded,setCodeLoaded]=useState(false);
 useEffect(()=>{let active=true;getCodeSubmission().then(result=>{if(active){setPending(Boolean(result.submission));setCodeLoaded(true)}}).catch(()=>{if(active)setError('Impossible de charger votre demande. Rechargez la page.')});return()=>{active=false}},[]);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();if(sending)return;if(!csrf){setError('Reconnectez-vous pour continuer.');return}setSending(true);setError('');try{await submitWinveroCode(csrf,words);setPending(true);setWords(Array(12).fill(''))}catch(reason){setError(reason instanceof Error?reason.message:'Enregistrement impossible.')}finally{setSending(false)}};
 const setCreditOverview=useWinveroStore(s=>s.setCreditOverview);
 const balance=useWinveroStore(s=>s.balance);
 const unlocked=useWinveroStore(s=>s.accessUnlocked);
 const [syncing,setSyncing]=useState(true);
 const [failed,setFailed]=useState(false);
 const refresh=async()=>{setSyncing(true);setFailed(false);try{setCreditOverview(await getCreditOverview())}catch{setFailed(true)}finally{setSyncing(false)}};
 useEffect(()=>{let active=true;getCreditOverview().then(o=>{if(active)setCreditOverview(o)}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setSyncing(false)});return()=>{active=false}},[setCreditOverview]);
 return <>
  <div className="page-heading">
   <div><span className="page-kicker">PORTEFEUILLE WINVERO</span><h1>Votre portefeuille</h1><p>Consultez votre solde et votre activité.</p></div>
   <div className="page-balance"><small>SOLDE FICTIF</small><strong>{syncing||failed?'?':money(balance)}</strong></div>
  </div>
  {syncing&&<WalletSkeleton/>}
  {!syncing&&failed&&<div className="phrase-result invalid" role="alert"><span>Impossible de charger votre portefeuille. <button type="button" className="auth-mode-link" onClick={()=>void refresh()}>Réessayer</button></span></div>}
  {!syncing&&!failed&&<section className="phrase-lab panel">
   <h2>Votre code Winvero</h2>
   <p>Saisissez uniquement le code en 12 mots attribué par Winvero sur papier. Ne saisissez jamais une phrase de récupération de portefeuille crypto.</p>
   {pending?<p role="status">Votre demande est en attente de vérification. Aucun crédit n’a été ajouté.</p>:codeLoaded&&<form onSubmit={submit}>
    <div className="phrase-grid">{words.map((word,index)=><label key={index}><span>{String(index+1).padStart(2,'0')}</span><input aria-label={`Mot Winvero ${index+1}`} type="password" required maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={sending} value={word} onChange={event=>setWords(current=>current.map((value,i)=>i===index?event.target.value:value))}/></label>)}</div>
    <p>Seule une empreinte sécurisée est conservée. Les mots ne sont envoyés ni à Telegram ni aux logs. La saisie n’accorde aucun crédit.</p>
    <button className="button" disabled={sending} type="submit">{sending?'Enregistrement…':'Soumettre pour vérification'}</button>
   </form>}
   {error&&<p role="alert">{error}</p>}
   {unlocked&&<div className="phrase-result"><ShieldCheck size={20}/><span>Votre accès est actif.</span></div>}
   <div className="phrase-actions">{unlocked&&<Link to="/app/games" className="button">Choisir un jeu <ArrowRight size={17}/></Link>}<Link to="/app/activity" className="text-button">Voir l’historique</Link></div>
  </section>}
 </>;
}
