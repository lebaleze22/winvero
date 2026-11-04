/** Vérifie dans le navigateur que SHA-256(graine serveur) correspond à l'engagement publié avant la partie. */
export async function verifyCommitment(serverSeed:string,serverSeedHash:string):Promise<boolean>{
 try{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serverSeed))
  const hex=[...new Uint8Array(digest)].map((byte)=>byte.toString(16).padStart(2,'0')).join('')
  return hex===serverSeedHash.toLowerCase()
 }catch{return false}
}
