import { create } from 'zustand'
import type { AccountProfile, AuthSession } from '../services/authApi'
import type { CreditOverview, LedgerActivity } from '../services/creditApi'

export type Asset='EUR'|'USD'|'SOL'|'BTC'|'ETH'|'USDT'
export type ActivityEntry=LedgerActivity
export type AuthStatus='loading'|'authenticated'|'anonymous'

interface WinveroState {
  account:AccountProfile|null
  authStatus:AuthStatus
  csrfToken:string|null
  sessionExpiresAt:string|null
  balance:number
  activity:ActivityEntry[]
  testCreditsEnabled:boolean
  accessUnlocked:boolean
  overviewStatus:'unknown'|'ready'
  setSession:(session:AuthSession)=>void
  setCreditOverview:(overview:CreditOverview)=>void
  syncServerBalance:(balance:number)=>void
  clearSession:()=>void
  setAnonymous:()=>void
}

if(typeof window!=='undefined'){
  localStorage.removeItem('winvero-ui-v1')
  localStorage.removeItem('winvero-game-player-v1')
}

export const useWinveroStore=create<WinveroState>((set)=>({
  account:null,
  authStatus:'loading',
  csrfToken:null,
  sessionExpiresAt:null,
  balance:0,
  activity:[],
  testCreditsEnabled:false,
  accessUnlocked:false,
  overviewStatus:'unknown',
  setSession:(session)=>set({account:session.account,authStatus:'authenticated',csrfToken:session.csrfToken,sessionExpiresAt:session.expiresAt,balance:session.balance}),
  setCreditOverview:(overview)=>set({balance:overview.balance,activity:overview.entries,testCreditsEnabled:overview.testCreditsEnabled,...(overview.accessUnlocked===undefined?{}:{accessUnlocked:overview.accessUnlocked,overviewStatus:'ready' as const})}),
  syncServerBalance:(balance)=>{if(Number.isFinite(balance)&&balance>=0)set({balance:Number(balance.toFixed(2))})},
  clearSession:()=>set({account:null,authStatus:'anonymous',csrfToken:null,sessionExpiresAt:null,balance:0,activity:[],testCreditsEnabled:false,accessUnlocked:false,overviewStatus:'unknown'}),
  setAnonymous:()=>set({account:null,authStatus:'anonymous',csrfToken:null,sessionExpiresAt:null,balance:0,activity:[],testCreditsEnabled:false,accessUnlocked:false,overviewStatus:'unknown'}),
}))
