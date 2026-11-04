import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'
import { loginAccount, registerAccount } from '../services/authApi'
import { getCreditOverview } from '../services/creditApi'
import { ApiError } from '../services/apiError'
import { Brand } from '../components/Brand'

const authErrorMessage=(reason:unknown,mode:'login'|'register')=>{
 if(reason instanceof ApiError){
  if(reason.status===429)return reason.message||'Trop de tentatives. Réessayez dans quelques minutes.'
  if(reason.status>=500)return 'Le serveur a rencontré une erreur. Réessayez dans un instant.'
  if(reason.message)return reason.message
  return mode==='login'?'E-mail ou mot de passe incorrect.':'Inscription impossible. Vérifiez vos informations.'
 }
 return 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez.'
}

export function Start(){
 const account=useWinveroStore((s)=>s.account),setSession=useWinveroStore((s)=>s.setSession),navigate=useNavigate()
 const [mode,setMode]=useState<'login'|'register'>('login'),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [form,setForm]=useState({firstName:'',lastName:'',email:'',username:'',country:'France',phone:'',password:''})
 if(account)return <Navigate to="/app" replace/>
 const submit=async(event:React.FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{const session=mode==='login'?await loginAccount(form.email,form.password):await registerAccount(form);const overview=await getCreditOverview();setSession(session);useWinveroStore.getState().setCreditOverview(overview);navigate(overview.accessUnlocked?'/app':'/app/wallet',{replace:true})}catch(reason){setError(authErrorMessage(reason,mode))}finally{setBusy(false)}}
 return <main className="auth-page"><div className="auth-panel"><Brand/><div className="auth-copy"><div className="eyebrow light"><span/> ACCÈS JOUEUR</div><h1>Votre arène.<br/>Votre signature.</h1><p>{mode==='login'?'Connectez-vous à votre compte Winvero.':'Créer un compte est gratuit et n’offre aucun crédit : votre solde démarre à 0 WVC.'}</p></div><div className="auth-stat"><strong>20</strong><span>univers de jeu<br/>dans un seul espace</span></div></div><div className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><span className="step-label">COMPTE WINVERO</span><h2>{mode==='login'?'Connexion':'Créer un compte'}</h2>{mode==='register'&&<><div className="form-grid"><label>Prénom<input required autoComplete="given-name" value={form.firstName} onChange={(e)=>setForm({...form,firstName:e.target.value})}/></label><label>Nom<input required autoComplete="family-name" value={form.lastName} onChange={(e)=>setForm({...form,lastName:e.target.value})}/></label></div><label>Pseudo<input required autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_\-]+" title="3 à 30 caractères : lettres, chiffres, _ ou -" value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})}/></label><div className="form-grid"><label>Pays<input required autoComplete="country-name" value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})}/></label><label>Téléphone<input required type="tel" autoComplete="tel" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label></div></>}<label>Adresse e-mail<input type="email" autoComplete="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label>Mot de passe<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={10} maxLength={128} required aria-describedby={mode==='register'?'password-rule':undefined} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})}/></label>{mode==='register'&&<p className="form-hint" id="password-rule">10 caractères minimum. </p>}{mode==='register'&&<p className="form-hint">Les 1 250 WVC d’entraînement ne sont débloqués qu’après validation du code en 12 mots.</p>}{error&&<p className="form-error" role="alert">{error}</p>}<button className="button full" disabled={busy} type="submit">{busy?'Vérification…':mode==='login'?'Se connecter':'Créer le compte'} <ArrowRight size={17}/></button><p className="auth-mode-switch">{mode==='login'?'Pas encore de compte ?':'Déjà un compte ?'} <button className="auth-mode-link" disabled={busy} type="button" onClick={()=>{setError('');setForm({...form,password:''});setMode(mode==='login'?'register':'login')}}>{mode==='login'?'Créer un compte':'Se connecter'}</button></p><Link to="/" className="back-link">Retour à l’accueil</Link></form></div></main>
}
