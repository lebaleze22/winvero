// Preloaded only by the isolated integration-test server. No live Telegram traffic.
if(process.env.NODE_ENV!=='test')throw new Error('Test transport must not run outside tests')
const originalFetch=globalThis.fetch
globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://api.telegram.org/bot'))return new Response(JSON.stringify({ok:true,result:{message_id:1}}),{status:200})
  return originalFetch(url,options)
}
