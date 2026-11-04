import { createTelegramClient, loadTelegramConfig } from './telegram-client.mjs'

const config=loadTelegramConfig()
console.log(JSON.stringify({tokenValid:config.validToken,adminCount:config.adminChatIds.length,adminIdsValid:config.validChats}))
if(!config.validToken){process.exitCode=1}else{
  const telegram=createTelegramClient(config)
  try{
    const identity=await telegram('getMe'),webhook=await telegram('getWebhookInfo')
    const chats=[]
    for(const chatId of config.adminChatIds){
      try{const chat=await telegram('getChat',{chat_id:chatId});chats.push({accessible:true,type:chat.type})}catch(error){chats.push({accessible:false,error:error.message})}
    }
    console.log(JSON.stringify({connected:true,botUsername:identity.username,webhookConfigured:Boolean(webhook.url),pendingUpdates:webhook.pending_update_count,chats},null,2))
  }catch(error){console.error(error.message);process.exitCode=1}
}
