import { db } from './db.mjs'
import { loadTelegramConfig } from '../telegram-bot/telegram-client.mjs'
import { createTelegramNotifications } from './telegram-notifications.mjs'

try{
  const notifier=createTelegramNotifications(db,loadTelegramConfig())
  console.log(JSON.stringify({...notifier.status(),recent:db.prepare('SELECT event_key,attempts,delivered_at,last_error FROM telegram_outbox ORDER BY created_at DESC LIMIT 10').all()},null,2))
}finally{db.close()}
