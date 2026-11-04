import { ApiError } from './apiError'
export { ApiError } from './apiError'

export interface LedgerActivity {id:string;type:string;label:string;amount:number;detail:string;createdAt:number}
export interface CreditOverview {balance:number;entries:LedgerActivity[];testCreditsEnabled:boolean;accessUnlocked?:boolean}

import { useWinveroStore } from '../store/useWinveroStore'

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{...init,credentials:'include',headers:{'content-type':'application/json',...init?.headers}})
  const body=await response.json().catch(()=>({})) as {error?:string}
  if(response.status===401)useWinveroStore.getState().clearSession()
  if(!response.ok)throw new ApiError(body.error||'Service de crédits indisponible',response.status)
  return body as T
}

export const getCreditOverview=()=>request<CreditOverview>('/api/credits/overview')
export interface CodeSubmission {id:string;status:'pending_review';createdAt:string}
export const getCodeSubmission=()=>request<{submission:CodeSubmission|null}>('/api/credits/code-submission')
export const submitWinveroCode=(csrfToken:string,words:string[])=>request<{submission:CodeSubmission}>('/api/credits/code-submission',{method:'POST',headers:{'x-csrf-token':csrfToken},body:JSON.stringify({words})})
export const unlockAccessCredits=(csrfToken:string,words:string[])=>request<CreditOverview>('/api/credits/unlock',{method:'POST',headers:{'x-csrf-token':csrfToken},body:JSON.stringify({words})})
export const submitTestCreditOperation=(csrfToken:string,kind:'deposit'|'withdrawal',asset:string,amount:string,requestId=crypto.randomUUID())=>request<CreditOverview>('/api/credits/test-operations',{method:'POST',headers:{'x-csrf-token':csrfToken},body:JSON.stringify({requestId,kind,asset,amount})})
