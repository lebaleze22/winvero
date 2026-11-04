import { randomUUID } from 'node:crypto'
import argon2 from 'argon2'

export function createCodeSubmissions(db){
 const find=db.prepare('SELECT id,status,created_at FROM winvero_code_submissions WHERE user_id=?')
 const insert=db.prepare('INSERT INTO winvero_code_submissions(id,user_id,verifier,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING')
 const view=row=>row?{id:row.id,status:row.status,createdAt:row.created_at}:null
 return {
  get:userId=>view(find.get(userId)),
  async submit(userId,words){
   if(!Array.isArray(words)||words.length!==12||words.some(word=>typeof word!=='string'||!/^\p{L}{1,40}$/u.test(word.trim()))){return {error:'Saisissez les 12 mots du code émis par Winvero.',status:400}}
   if(find.get(userId))return {submission:view(find.get(userId))}
   // Store a verifier only: raw words must never enter storage, logs or notifications.
   const normalized=words.map(word=>word.trim().normalize('NFC')).join(' ')
   const verifier=await argon2.hash(normalized,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1})
   insert.run(randomUUID(),userId,verifier,new Date().toISOString())
   return {submission:view(find.get(userId))}
  }
 }
}
