import { Brand } from './Brand'

export function Skeleton({w,h,className=''}:{w?:number|string,h?:number|string,className?:string}){
 return <span aria-hidden="true" className={`skeleton ${className}`.trim()} style={{width:w,height:h}}/>
}

/** Coquille complète de l'app pendant la vérification de session : mêmes grilles que AppShell + Dashboard. */
export function AppShellSkeleton(){
 return (
  <div className="shell" role="status" aria-busy="true" aria-live="polite">
   <span className="sr-only">Chargement de votre espace…</span>
   <header className="topbar" aria-hidden="true">
    <div className="topbar-inner">
     <Brand/>
     <div className="topnav">{[0,1,2,3].map((i)=><Skeleton key={i} w={92} h={34}/>)}</div>
     <div className="topbar-actions"><Skeleton w={130} h={38}/><Skeleton w={38} h={38}/></div>
    </div>
   </header>
    <main className="page" aria-hidden="true">
     <div className="page-heading"><div><Skeleton w={110} h={12}/><Skeleton w="min(420px,70vw)" h={40} className="skeleton-gap"/><Skeleton w="min(520px,80vw)" h={14}/></div></div>
     <section className="overview-grid">
      {[0,1,2].map((i)=><div className="skeleton-card skeleton-stat" key={i}><Skeleton w={90} h={12}/><Skeleton w="60%" h={34} className="skeleton-gap"/><Skeleton w="80%" h={12}/></div>)}
     </section>
     <section className="dashboard-section"><div className="app-game-grid">{[0,1,2,3].map((i)=><div className="skeleton-card skeleton-game" key={i}><Skeleton h={120}/><Skeleton w="70%" h={16} className="skeleton-gap"/><Skeleton w="45%" h={12}/></div>)}</div></section>
    </main>
  </div>
 )
}

/** Panneau de la page « 12 mots » pendant la lecture du compte. */
export function WalletSkeleton(){
 return (
  <section className="phrase-lab panel" role="status" aria-busy="true" aria-live="polite">
   <span className="sr-only">Lecture de votre compte…</span>
   <div aria-hidden="true">
    <Skeleton w={160} h={12}/><Skeleton w="min(380px,80%)" h={26} className="skeleton-gap"/><Skeleton w="min(520px,90%)" h={14}/>
    <div className="skeleton-words">{Array.from({length:12},(_,i)=><Skeleton key={i} h={44}/>)}</div>
    <Skeleton w={240} h={46} className="skeleton-gap"/>
   </div>
  </section>
 )
}
