import {t} from './i18n.mjs';
export type AISettings={base:string,model:string};
const key='quiz-runner-ai-v1';
const defaultBase=import.meta.env.VITE_AI_BASE_URL||'';
export function validateBase(value:string){const base=value.trim().replace(/\/+$/,'');if(!base)return '';let u:URL;try{u=new URL(base);}catch{throw Error(t('服务地址应为 HTTPS，或本机 HTTP 地址。'));}if(u.username||u.password||u.search||u.hash||(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error(t('服务地址应为 HTTPS，或本机 HTTP 地址。'));return base;}
export function loadAI():AISettings{try{const v=JSON.parse(localStorage.getItem(key)||'{}');return {base:validateBase(typeof v.base==='string'&&v.base?v.base:defaultBase),model:['MiniMax-M3','MiniMax-M2.5-highspeed','MiniMax-M2.5'].includes(v.model)?v.model:'MiniMax-M3'};}catch{return {base:defaultBase,model:'MiniMax-M3'};}}
export function saveAI(value:AISettings){const settings={base:validateBase(value.base),model:value.model};localStorage.setItem(key,JSON.stringify(settings));return settings;}
export async function requestAI(action:'status'|'parse'|'explain',body?:unknown,signal?:AbortSignal){
 const config=loadAI();const response=await fetch(`${config.base}/api/${action}`,{method:action==='status'?'GET':'POST',headers:action==='status'?{}:{'Content-Type':'application/json'},...action==='status'?{}:{body:JSON.stringify({...body as object,model:config.model})},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(100000)]):AbortSignal.timeout(100000)}).catch(()=>{throw Error(t(signal?.aborted?'已取消解析':'AI 服务未连接或请求失败，请在设置里检查连接。'));});
 let data:any;try{data=await response.json();}catch{throw Error(t('AI 服务未连接或请求失败，请在设置里检查连接。'));}
 if(!response.ok)throw Error(t(data.error==='rate_limit'?'请求过于频繁，请稍后再试。':data.error==='invalid_response'?'AI 返回格式不正确，请重试。':'AI 服务未连接或请求失败，请在设置里检查连接。'));
 return data;
}
