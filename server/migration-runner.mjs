import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here=dirname(fileURLToPath(import.meta.url))
const migrationsDirectory=resolve(here,'migrations')

export function applyMigrations(db){
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)
  const applied=new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row=>row.version))
  const files=readdirSync(migrationsDirectory).filter(name=>/^\d+_.+\.sql$/.test(name)).sort()
  const completed=[]
  for(const file of files){
    const version=file.split('_')[0]
    if(applied.has(version))continue
    const sql=readFileSync(resolve(migrationsDirectory,file),'utf8')
    db.exec('BEGIN IMMEDIATE')
    try{
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run(version,new Date().toISOString())
      db.exec('COMMIT')
      completed.push(file)
    }catch(error){db.exec('ROLLBACK');throw new Error(`Migration ${file} échouée: ${error.message}`)}
  }
  return completed
}
