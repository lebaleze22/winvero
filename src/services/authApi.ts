import { ApiError } from './apiError'
export { ApiError } from './apiError'

export interface AccountProfile {id:string;firstName:string;lastName:string;email:string;username:string;country:string;phone:string}
export interface AuthSession {account:AccountProfile;balance:number;csrfToken:string|null;expiresAt:string}

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,{...init,credentials:'include',headers:{'content-type':'application/json',...init?.headers}})
  const body=await response.json().catch(()=>({})) as {error?:string}
  if(!response.ok)throw new ApiError(body.error||'Service d’authentification indisponible',response.status)
  return body as T
}

export const registerAccount=(profile:Omit<AccountProfile,'id'> & {password:string})=>request<AuthSession>('/api/auth/register',{method:'POST',body:JSON.stringify(profile)})
export const loginAccount=(email:string,password:string)=>request<AuthSession>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})})
export const getCurrentSession=()=>request<AuthSession>('/api/auth/session')
export const logoutAccount=(csrfToken:string)=>request<{success:boolean}>('/api/auth/logout',{method:'POST',headers:{'x-csrf-token':csrfToken}})
