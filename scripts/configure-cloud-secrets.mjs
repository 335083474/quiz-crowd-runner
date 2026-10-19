// Transfers the existing authorized MiniMax key through stdin, never CLI arguments or output.
import {spawn} from 'node:child_process';
import {loadMiniMaxConfig} from '../server/config.mjs';
const config=await loadMiniMaxConfig();if(!config.MINIMAX_API_KEY)throw Error('MiniMax not configured');
const wrangler=process.env.QUIZ_WRANGLER_BIN;if(!wrangler)throw Error('Set QUIZ_WRANGLER_BIN to the installed Wrangler CLI');
const child=spawn(process.execPath,[wrangler,'secret','bulk'],{cwd:new URL('..',import.meta.url),stdio:['pipe','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
child.stdout.resume();child.stderr.resume();child.stdin.end(JSON.stringify({MINIMAX_API_KEY:config.MINIMAX_API_KEY}));
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});if(code!==0)throw Error('Secret upload failed');console.log(JSON.stringify({configured:['MINIMAX_API_KEY'],secretValuesPrinted:false}));
