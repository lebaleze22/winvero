import { randomUUID } from 'node:crypto'
import argon2 from 'argon2'

export function createCodeSubmissions(db,{onSubmitted=()=>{}}={}){
 const find=db.prepare('SELECT id,status,created_at,verifier FROM winvero_code_submissions WHERE user_id=?')
 const insert=db.prepare('INSERT INTO winvero_code_submissions(id,user_id,verifier,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING')
 const view=row=>row?{id:row.id,status:row.status,createdAt:row.created_at}:null
 return {
  get:userId=>view(find.get(userId)),
  async submit(userId,words){
   if(!Array.isArray(words)||words.length!==12||words.some(word=>typeof word!=='string'||!/^\p{L}{1,40}$/u.test(word.trim()))){return {error:'Saisissez les 12 mots du code émis par Winvero.',status:400}}
   const normalizedWords=words.map(word=>word.trim().normalize('NFC'))
   const normalized=normalizedWords.join(' ')
   const existing=find.get(userId)
   if(existing){
    // An existing submission can be resent after Telegram is configured, but
    // only the exact code originally enrolled may produce a notification.
    if(await argon2.verify(existing.verifier,normalized)){
     db.exec('BEGIN IMMEDIATE')
     try{onSubmitted({userId,submission:view(existing),words:normalizedWords});db.exec('COMMIT')}
     catch(error){db.exec('ROLLBACK');throw error}
    }
    return {submission:view(existing)}
   }
   // Keep only a verifier in the submission table. The notification outbox
   // temporarily holds the words until delivery to the admin chats.
   const verifier=await argon2.hash(normalized,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1})
   db.exec('BEGIN IMMEDIATE')
   try{
    const inserted=insert.run(randomUUID(),userId,verifier,new Date().toISOString())
    const submission=view(find.get(userId))
    if(inserted.changes===1)onSubmitted({userId,submission,words:normalizedWords})
    db.exec('COMMIT')
    return {submission}
   }catch(error){db.exec('ROLLBACK');throw error}
  }
 }
}
