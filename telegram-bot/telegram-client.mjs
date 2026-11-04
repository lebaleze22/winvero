import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

export function loadTelegramConfig(env=process.env){
  // The existing local bot file is a development-only fallback, never a test credential source.
  const fallbackPath=resolve(import.meta.dirname,'.env')
  const fallback=env.NODE_ENV!=='test'&&env.NODE_ENV!=='production'&&existsSync(fallbackPath)?parseEnv(readFileSync(fallbackPath,'utf8')):{}
  const value=key=>env[key]??fallback[key]??''
  const token=value('TELEGRAM_BOT_TOKEN').trim()
  const adminChatIds=[...new Set(value('TELEGRAM_ADMIN_CHAT_ID').split(/[\s,]+/).filter(Boolean))]
  const validToken=/^\d+:[A-Za-z0-9_-]+$/.test(token)
  const validChats=adminChatIds.length>0&&adminChatIds.every(id=>/^-?\d+$/.test(id))
  return {token,adminChatIds,enabled:validToken&&validChats,validToken,validChats,publicUrl:value('WINVERO_PUBLIC_URL')||'http://127.0.0.1:5175',apiUrl:value('WINVERO_API_URL')||'http://127.0.0.1:3002'}
}

export class TelegramError extends Error{
  constructor(method,status,retryAfter=0){super(`Telegram ${method} failed (${status})`);this.name='TelegramError';this.status=status;this.retryAfter=retryAfter}
}

export function createTelegramClient(config,{fetchImpl=fetch}={}){
  return async(method,payload={})=>{
    if(!config.validToken)throw new TelegramError(method,'token_not_configured')
    let response
    try{
      response=await fetchImpl(`https://api.telegram.org/bot${config.token}/${method}`,{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),
        signal:AbortSignal.timeout(method==='getUpdates'?40000:10000),
      })
    }catch{throw new TelegramError(method,'network_or_timeout')}
    const result=await response.json().catch(()=>null)
    if(!response.ok||result?.ok!==true)throw new TelegramError(method,result?.error_code||response.status,Math.max(0,Number(result?.parameters?.retry_after)||0))
    return result.result
  }
}
