import { runBot } from './bot-runtime.mjs'

runBot().catch(error=>{console.error(error.message);process.exitCode=1})
