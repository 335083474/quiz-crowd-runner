import {createAIHandler} from './app.mjs';
import {createMiniMaxProvider} from './minimax.mjs';
export const RESERVE_SQL=`INSERT INTO ai_budget(day,calls,minute,minute_calls) VALUES(?,1,?,1)
 ON CONFLICT(day) DO UPDATE SET calls=calls+1,minute=excluded.minute,
 minute_calls=CASE WHEN minute=excluded.minute THEN minute_calls+1 ELSE 1 END
 WHERE calls<50 AND (minute<>excluded.minute OR minute_calls<6) RETURNING calls`;
export async function reserveCloudCall(db,now=Date.now()){
 if(!db)throw Object.assign(Error('provider_unavailable'),{status:503});
 const row=await db.prepare(RESERVE_SQL).bind(new Date(now).toISOString().slice(0,10),Math.floor(now/60000)).first();
 if(!row)throw Object.assign(Error('rate_limit'),{status:429});
}
export function createCloudWorker({provider=createMiniMaxProvider}={}){return {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 const allowed=new Set([url.origin,'https://335083474.github.io']);
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
 const json=(data,status)=>Response.json(data,{status,headers});
 if(origin&&!allowed.has(origin))return json({error:'origin_forbidden'},403);
 if(request.method==='POST'&&!origin)return json({error:'origin_forbidden'},403);
 if(request.method==='POST'){
  if(Number(request.headers.get('content-length')||0)>65000)return json({error:'invalid_input'},413);
  let size=0;const reader=request.body?.getReader(),parts=[];if(!reader)return json({error:'invalid_input'},400);
  for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>65000){await reader.cancel();return json({error:'invalid_input'},413);}parts.push(p.value);}
  request=new Request(request,{body:new Blob(parts)});
 }
 try{
  const infer=provider(env),handle=createAIHandler(env,{allowedOrigins:[...allowed],infer:async input=>{await reserveCloudCall(env.DB);return infer(input);}});
  return await handle(request);
 }catch{return json({error:'provider_unavailable'},503);}
}};}
export default createCloudWorker();
