import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { resolve } from 'node:path'

test('API adapters expose HTTP status, preserve messages and network errors',async()=>{
  const bundled=await build({stdin:{contents:`export { ApiError } from './src/services/apiError'; export { getCurrentSession } from './src/services/authApi'; export { getCreditOverview } from './src/services/creditApi'; export { getGameRules } from './src/services/gameApi';`,resolveDir:resolve(import.meta.dirname,'..'),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false})
  const api=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
  const previousFetch=globalThis.fetch
  try{
    for(const call of [api.getCurrentSession,api.getCreditOverview,api.getGameRules]){
      for(const status of [400,401,403,409,429,500]){
        globalThis.fetch=async()=>new Response(JSON.stringify({error:'Server message'}),{status})
        await assert.rejects(call(),error=>error instanceof api.ApiError&&error instanceof Error&&error.status===status&&error.message==='Server message')
      }
      globalThis.fetch=async()=>new Response('not JSON',{status:503})
      await assert.rejects(call(),error=>error instanceof api.ApiError&&error.status===503&&Boolean(error.message))
      const networkError=new TypeError('fetch failed')
      globalThis.fetch=async()=>{throw networkError}
      await assert.rejects(call(),error=>error===networkError&&!(error instanceof api.ApiError))
      globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{status:200})
      assert.deepEqual(await call(),{ok:true})
    }
  }finally{globalThis.fetch=previousFetch}
})
