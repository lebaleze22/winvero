import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Coins, Gift, History, Home, LayoutGrid, LogOut, Settings, UserRound, WalletCards } from 'lucide-react'
import { useWinveroStore } from '../store/useWinveroStore'
import { logoutAccount } from '../services/authApi'
import { money } from '../lib/format'
import { Brand } from './Brand'
import { clearRoundHistory } from './RoundHistory'
import { AppShellSkeleton } from './Skeleton'

/** Parcours de navigation, dans l'ordre d'usage : découvrir → jouer → progresser → suivre. */
const primaryNav=[
 {to:'/app',label:'Accueil',icon:Home,end:true},
 {to:'/app/games',label:'Casino',icon:LayoutGrid},
 {to:'/app/bonus',label:'Parcours',icon:Gift},
 {to:'/app/activity',label:'Historique',icon:History},
]

export function RequireAccount(){const account=useWinveroStore((s)=>s.account),status=useWinveroStore((s)=>s.authStatus);if(status==='loading')return <AppShellSkeleton/>;return account?<AppShell/>:<Navigate to="/start" replace/>}

export function AppShell(){
 const account=useWinveroStore((s)=>s.account)!;
 const balance=useWinveroStore((s)=>s.balance);
 const wallet=useWinveroStore((s)=>s.accessUnlocked);
 const ready=useWinveroStore((s)=>s.overviewStatus)==='ready';
 const csrfToken=useWinveroStore((s)=>s.csrfToken);
 const clearSession=useWinveroStore((s)=>s.clearSession);
 const reset=async()=>{try{if(csrfToken)await logoutAccount(csrfToken)}finally{clearRoundHistory();clearSession()}};
 const [menuOpen,setMenuOpen]=useState(false);
 const mainRef=useRef<HTMLElement>(null),menuRef=useRef<HTMLDivElement>(null),location=useLocation();
 const lastPath=useRef(location.pathname);
 useEffect(()=>{if(lastPath.current===location.pathname)return;lastPath.current=location.pathname;mainRef.current?.focus({preventScroll:true});window.scrollTo({top:0});setMenuOpen(false)},[location.pathname]);
 useEffect(()=>{
  if(!menuOpen)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false)};
  const onClick=(event:MouseEvent)=>{if(menuRef.current&&!menuRef.current.contains(event.target as Node))setMenuOpen(false)};
  window.addEventListener('keydown',onKey);window.addEventListener('mousedown',onClick);
  return()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('mousedown',onClick)};
 },[menuOpen]);
 const initials=`${account.firstName[0]??''}${account.lastName[0]??''}`.toUpperCase();

 return (
  <div className="shell">
   <a className="skip-link" href="#contenu" onClick={(e)=>{e.preventDefault();mainRef.current?.focus()}}>Aller au contenu</a>
   <header className="topbar">
    <div className="topbar-inner">
     <Brand/>
     <nav className="topnav" aria-label="Navigation principale">
      {primaryNav.map(({to,label,icon:Icon,end})=>(
       <NavLink key={to} to={to} end={end} className={({isActive})=>isActive?'active':''}><Icon size={17} aria-hidden="true"/><span>{label}</span></NavLink>
      ))}
     </nav>
     <div className="topbar-actions">
      {ready&&!wallet?<Link to="/app/wallet" className="unlock-pill"><WalletCards size={16} aria-hidden="true"/> Débloquer mes crédits</Link>:null}
      <Link to="/app/wallet" className="balance-pill" aria-label={`Solde : ${money(balance)}`}><Coins size={17} aria-hidden="true"/><span>{money(balance)}</span></Link>
      <div className="user-menu" ref={menuRef}>
       <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Menu du compte" onClick={()=>setMenuOpen((open)=>!open)}>{initials||<UserRound size={17}/>}</button>
       {menuOpen&&(
        <div className="user-popover" role="menu" aria-label="Compte">
         <div className="user-popover-head"><strong>{account.username}</strong><small>{account.email}</small></div>
         <Link role="menuitem" to="/app/wallet"><WalletCards size={16} aria-hidden="true"/> Accès 12 mots<small>{!ready?'Indisponible':wallet?'Vérifié':'À valider'}</small></Link>
         <Link role="menuitem" to="/app/settings"><Settings size={16} aria-hidden="true"/> Paramètres</Link>
         <button role="menuitem" type="button" onClick={()=>void reset()}><LogOut size={16} aria-hidden="true"/> Se déconnecter</button>
        </div>
       )}
      </div>
     </div>
    </div>
   </header>
   <main className="page" id="contenu" tabIndex={-1} ref={mainRef}><Outlet/></main>
   <nav className="tabbar" aria-label="Navigation principale (mobile)">
    {primaryNav.map(({to,label,icon:Icon,end})=>(
     <NavLink key={to} to={to} end={end} className={({isActive})=>isActive?'active':''}><Icon size={20} aria-hidden="true"/><span>{label}</span></NavLink>
    ))}
    <NavLink to="/app/settings" className={({isActive})=>isActive?'active':''}><UserRound size={20} aria-hidden="true"/><span>Compte</span></NavLink>
   </nav>
  </div>
 );
}
