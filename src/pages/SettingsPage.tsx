import { useState } from 'react'
import { Settings, Sparkles } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'

const MOTION_KEY='winvero-reduced-motion';

export const readMotionPreference=()=>{try{return localStorage.getItem(MOTION_KEY)==='1'}catch{return false}};

export const applyMotionPreference=(reduced:boolean)=>document.documentElement.toggleAttribute('data-reduced-motion',reduced);

export function SettingsPage(){
 const account=useWinveroStore((s)=>s.account)!;
 const [reduced,setReduced]=useState(readMotionPreference);
 const toggleMotion=()=>{
  const next=!reduced;
  setReduced(next);
  applyMotionPreference(next);
  try{localStorage.setItem(MOTION_KEY,next?'1':'0')}catch{/* préférence non enregistrée */}
 };

 return (
  <>
   <div className="page-heading">
    <div><span className="page-kicker">PRÉFÉRENCES</span><h1>Votre compte et votre confort.</h1><p>Informations de votre profil et réglages d’affichage.</p></div>
   </div>
   <section className="settings-panel panel">
    <div className="settings-title"><Settings size={24}/><div><h2>Profil</h2><p>Ces informations proviennent de votre compte.</p></div></div>
    <div className="setting-row"><div><strong>Pseudo</strong><small>{account.username}</small></div></div>
    <div className="setting-row"><div><strong>Nom</strong><small>{account.firstName} {account.lastName}</small></div></div>
    <div className="setting-row"><div><strong>Adresse e-mail</strong><small>{account.email}</small></div></div>
    <div className="settings-title"><Sparkles size={24}/><div><h2>Affichage</h2><p>Enregistré sur cet appareil uniquement.</p></div></div>
    <div className="setting-row">
     <div><strong>Réduire les animations</strong><small>Désactive les mouvements des cartes, halos et icônes</small></div>
     <button className={reduced?'toggle on':'toggle'} onClick={toggleMotion} aria-pressed={reduced} aria-label="Réduire les animations"><i/></button>
    </div>
   </section>
  </>
 );
}
