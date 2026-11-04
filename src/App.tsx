import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useWinveroStore } from './store/useWinveroStore'
import { getCurrentSession } from './services/authApi'
import { getCreditOverview } from './services/creditApi'
import { Start } from './pages/Start'
import { Landing } from './pages/Landing'
import { RequireAccount } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { GamesPage } from './pages/GamesPage'
import { WalletPage } from './pages/WalletPage'
import { GameRoom } from './pages/GameRoom'
import { BonusPage } from './pages/BonusPage'
import { SettingsPage, applyMotionPreference, readMotionPreference } from './pages/SettingsPage'
import { ActivityPage } from './pages/ActivityPage'

let authBootstrapPromise:ReturnType<typeof getCurrentSession>|null=null

function App(){
 useEffect(()=>{applyMotionPreference(readMotionPreference())},[])
 const setSession=useWinveroStore((s)=>s.setSession),setOverview=useWinveroStore((s)=>s.setCreditOverview),setAnonymous=useWinveroStore((s)=>s.setAnonymous)
 useEffect(()=>{
  let active=true
  authBootstrapPromise??=getCurrentSession()
  authBootstrapPromise.then(async(session)=>{
   // Le solde et l'accès sont lus avant de publier la session : pas d'écran « verrouillé » provisoire.
   const overview=await getCreditOverview().catch(()=>null)
   if(!active)return
   setSession(session)
   if(overview)setOverview(overview)
  }).catch(()=>{if(active)setAnonymous()})
  return()=>{active=false}
 },[setAnonymous,setOverview,setSession])
 return (
  <Routes>
   <Route path="/" element={<Landing/>}/>
   <Route path="/start" element={<Start/>}/>
   <Route path="/app" element={<RequireAccount/>}>
    <Route index element={<Dashboard/>}/>
    <Route path="games" element={<GamesPage/>}/>
    <Route path="games/:gameId" element={<GameRoom/>}/>
    <Route path="bonus" element={<BonusPage/>}/>
    <Route path="wallet" element={<WalletPage/>}/>
    <Route path="activity" element={<ActivityPage/>}/>
    <Route path="settings" element={<SettingsPage/>}/>
   </Route>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>
 );
}

export default App
