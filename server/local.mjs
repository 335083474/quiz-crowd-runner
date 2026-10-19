import http from 'node:http';
import {loadMiniMaxConfig} from './config.mjs';
import {createAIHandler} from './app.mjs';
const config=await loadMiniMaxConfig(),handle=createAIHandler(config,{allowedOrigins:(process.env.AI_ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
const port=Number(process.env.AI_PORT||5199);
http.createServer(async(req,res)=>{
 try{
  const buffers=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>65000){res.writeHead(413,{'Content-Type':'application/json'});res.end('{"error":"invalid_input"}');return;}buffers.push(chunk);}
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,signal:controller.signal,...['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(buffers)}});
  const response=await handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"server_error"}');}
}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({service:'quiz-runner-ai',port,provider:'minimax',configured:!!config.MINIMAX_API_KEY,model:config.MINIMAX_MODEL})));
