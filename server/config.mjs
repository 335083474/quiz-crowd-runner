import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export async function loadMiniMaxConfig(env=process.env){
 let config={};try{config=JSON.parse(await fs.readFile(path.join(env.MMX_CONFIG_DIR||path.join(os.homedir(),'.mmx'),'config.json'),'utf8'));}catch{}
 return {MINIMAX_API_KEY:env.MINIMAX_API_KEY||config.api_key||'',MINIMAX_REGION:env.MINIMAX_REGION||config.region||'cn',MINIMAX_MODEL:env.MINIMAX_MODEL||'MiniMax-M3'};
}
