import { randomUUID } from 'node:crypto'
import { createTelegramClient, loadTelegramConfig } from './telegram-client.mjs'

const config=loadTelegramConfig()
if(!config.enabled){console.error('Configurez TELEGRAM_BOT_TOKEN et TELEGRAM_ADMIN_CHAT_ID.');process.exitCode=1}else{
  const telegram=createTelegramClient(config),eventId=randomUUID()
  let delivered=0
  for(const chatId of config.adminChatIds){
    try{
      const result=await telegram('sendMessage',{chat_id:chatId,text:`Winvero · DIAGNOSTIC\nEvent: ${eventId}\nDate: ${new Date().toISOString()}\nTest de livraison uniquement. Aucun compte ni crédit modifié.`,disable_web_page_preview:true})
      delivered++
      console.log(`Diagnostic delivered (${delivered}/${config.adminChatIds.length}), message ${result.message_id}`)
    }catch(error){console.error(error.message);process.exitCode=1}
  }
  console.log(JSON.stringify({delivered,expected:config.adminChatIds.length,eventId}))
}
