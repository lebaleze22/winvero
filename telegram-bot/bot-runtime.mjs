import http from 'node:http'
import { createTelegramClient, loadTelegramConfig } from './telegram-client.mjs'

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))

export function createBot({config=loadTelegramConfig(),telegram=createTelegramClient(config),fetchImpl=fetch}={}){
  const send=(chatId,text)=>telegram('sendMessage',{chat_id:chatId,text,parse_mode:'HTML',disable_web_page_preview:true})
  const api=async path=>{
    const response=await fetchImpl(`${config.apiUrl}${path}`,{signal:AbortSignal.timeout(5000)})
    if(!response.ok)throw new Error('API indisponible')
    return response.json()
  }
  return {
    async handle(message){
      const chatId=message.chat.id,command=(message.text||'').trim().split(/\s+/)[0].toLowerCase().split('@')[0]
      if(command==='/whoami'){
        await send(chatId,`<b>Identifiant de ce chat</b>\n<code>${escapeHtml(chatId)}</code>\nAjoutez cet identifiant à TELEGRAM_ADMIN_CHAT_ID puis redémarrez les services.`)
        return
      }
      if(!config.adminChatIds.includes(String(chatId))){await send(chatId,'⛔ Accès non autorisé.');return}
      let text
      switch(command){
        case '/start':case '/help':text='<b>WINVERO CONTROL</b>\n/status — état réel de l’API\n/games — catalogue serveur\n/open — ouvrir l’application\n/campaign — campagne\n/whoami — identifiant du chat';break
        case '/open':text=`<b>Ouvrir Winvero</b>\n${escapeHtml(config.publicUrl)}`;break
        case '/campaign':text='<b>Winvero</b>\nJeux en crédits fictifs WVC. Aucun fonds réel.';break
        case '/status':
          try{const health=await api('/api/health');text=health.ok?'<b>État Winvero</b>\n🟢 API joignable\nCrédits fictifs WVC · validation requise pour jouer':'<b>État Winvero</b>\n🔴 API en erreur'}
          catch{text='<b>État Winvero</b>\n🔴 API indisponible'}
          break
        case '/games':
          try{const rules=await api('/api/game-rules');text=`<b>Catalogue serveur</b>\n${Object.keys(rules).length} jeux\n${Object.keys(rules).map(escapeHtml).join(' · ')}`}
          catch{text='Catalogue indisponible : vérifiez le service API.'}
          break
        default:text='Commande inconnue. Utilisez /help.'
      }
      await send(chatId,text)
    },
    async configure(){
      const identity=await telegram('getMe'),webhook=await telegram('getWebhookInfo')
      if(webhook.url)throw new Error('Un webhook Telegram est actif : le polling ne peut pas démarrer. Désactivez le webhook ou utilisez son service existant.')
      await telegram('setMyCommands',{commands:[{command:'status',description:'État réel de Winvero'},{command:'games',description:'Catalogue serveur'},{command:'open',description:'Ouvrir Winvero'},{command:'campaign',description:'Campagne'},{command:'whoami',description:'Afficher le Chat ID'},{command:'help',description:'Aide'}]})
      return identity
    },
  }
}

export async function runBot(){
  const config=loadTelegramConfig()
  if(!config.validToken)throw new Error('TELEGRAM_BOT_TOKEN absent ou mal formé')
  if(config.adminChatIds.length&&!config.validChats)throw new Error('TELEGRAM_ADMIN_CHAT_ID mal formé')
  const telegram=createTelegramClient(config),bot=createBot({config,telegram})
  const identity=await bot.configure()
  let offset=0,running=true,lastError=null,lastPollAt=null
  const server=http.createServer((req,res)=>{
    res.setHeader('content-type','application/json; charset=utf-8')
    if(req.method==='GET'&&req.url==='/api/health'){res.writeHead(lastError?503:200);res.end(JSON.stringify({ok:!lastError,polling:true,lastPollAt,error:lastError}));return}
    if(req.method==='POST'&&['/api/profile-submitted','/api/wallet-submitted','/api/training-code-simulation'].includes(req.url)){res.writeHead(410);res.end(JSON.stringify({error:'Notifications produites par le serveur authentifié uniquement.'}));return}
    res.writeHead(404);res.end(JSON.stringify({error:'Route introuvable'}))
  })
  await new Promise((resolvePromise,reject)=>{server.once('error',reject);server.listen(Number(process.env.PORT||3001),'127.0.0.1',resolvePromise)})
  console.log(`Bot @${identity.username} connecté; commandes en polling, API locale sur ${process.env.PORT||3001}.`)
  if(!config.adminChatIds.length)console.warn('Configuration initiale : seul /whoami est accessible. Configurez TELEGRAM_ADMIN_CHAT_ID puis redémarrez.')
  const stop=()=>{running=false;server.close()}
  process.once('SIGINT',stop);process.once('SIGTERM',stop)
  while(running){
    try{
      const updates=await telegram('getUpdates',{offset,timeout:30,allowed_updates:['message']})
      lastPollAt=new Date().toISOString();lastError=null
      for(const update of updates){
        if(!running)break
        if(update.message)await bot.handle(update.message)
        offset=update.update_id+1
      }
    }catch(error){
      lastError=error.status?String(error.status):'command_failed'
      console.error(`Telegram polling/command failure: ${lastError}`)
      if(error.status===409){stop();throw new Error('Conflit Telegram : un autre poller ou webhook utilise déjà ce bot.')}
      if(running)await new Promise(resolvePromise=>setTimeout(resolvePromise,Math.min(60000,Math.max(3000,(error.retryAfter||0)*1000))))
    }
  }
}
