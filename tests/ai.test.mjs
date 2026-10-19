import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAIHandler} from '../server/app.mjs';
import {createMiniMaxProvider} from '../server/minimax.mjs';
const config={MINIMAX_API_KEY:'synthetic-key',MINIMAX_REGION:'cn',MINIMAX_MODEL:'MiniMax-M3'};
const q={prompt:'2+2=?',options:['1','2','3','4'],answer:3};
const req=(path,body,headers={})=>new Request('http://127.0.0.1:5199/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',...headers}:headers,...body?{body:JSON.stringify(body)}:{}});
test('AI status exposes safe metadata only and refuses cross-site calls before inference',async()=>{
 let calls=0;const handle=createAIHandler(config,{infer:async()=>{calls++;return {value:{questions:[q]}};}});const status=await handle(req('status'));assert(!(await status.text()).includes('synthetic-key'));
 assert.equal((await handle(req('parse',{text:'q'},{Origin:'https://evil.example'}))).status,403);assert.equal(calls,0);
 assert.equal((await createAIHandler({})(req('parse',{text:'q'}))).status,503);
 const missing=await createAIHandler({},{allowedOrigins:['https://quiz.example']})(req('parse',{text:'q'},{Origin:'https://quiz.example'}));assert.equal(missing.headers.get('Access-Control-Allow-Origin'),'https://quiz.example');
});
test('parse/explain validate model output and reject incomplete banks instead of silently using them',async()=>{
 const handle=createAIHandler(config,{infer:async({system,prompt})=>({value:system.includes('Extract')?{questions:[q]}:{explanation:'2 + 2 = 4.'},model:'MiniMax-M3'})});
 const parsed=await handle(req('parse',{text:'2+2 A1 B2 C3 D4 answer D'}));assert.equal(parsed.status,200);assert.equal((await parsed.json()).questions[0].answer,3);
 const explained=await handle(req('explain',{question:q,locale:'en'}));assert.equal((await explained.json()).explanation,'2 + 2 = 4.');
 const invalid=createAIHandler(config,{infer:async()=>({value:{questions:[{...q,answer:null}]}})});assert.equal((await invalid(req('parse',{text:'q'}))).status,502);
 assert.equal((await handle(req('explain',{question:{...q,options:[]}}))).status,400);assert.equal((await handle(req('parse',{text:'q',model:'arbitrary-model'}))).status,400);
});
test('server rejects excess calls and never returns provider errors or credentials to the browser',async()=>{
 const handle=createAIHandler(config,{now:()=>100000,infer:async()=>({value:{explanation:'ok'}})});for(let i=0;i<6;i++)assert.equal((await handle(req('explain',{question:q}))).status,200);assert.equal((await handle(req('explain',{question:q}))).status,429);
 const failing=createAIHandler(config,{infer:async()=>{throw Error('provider contains synthetic-key');}});const r=await failing(req('explain',{question:q}));assert.equal(r.status,502);assert(!(await r.text()).includes('synthetic-key'));
});

test('explanation requests ask for plain language and a concrete everyday example, carrying selected mistakes and every correct choice',async()=>{
 let sent;const handle=createAIHandler(config,{infer:async input=>{sent=input;return {value:{explanation:'人话解释：先理解意思。\n\n生活例子：拿买菜来比。\n\n记住一句话：先想清楚再选。'}};}});
 const multi={prompt:'Choose two',options:['a','b','c','d'],answer:[0,2]};const response=await handle(req('explain',{question:multi,selected:[0,3]}));assert.equal(response.status,200);
 assert.match(sent.system,/complete beginner/);assert.match(sent.system,/ONE concrete, familiar example/);assert.match(sent.system,/人话解释/);assert.match(sent.system,/生活例子/);assert.match(sent.system,/记住一句话/);assert.match(sent.system,/source-year context/);assert.match(sent.system,/untrusted study material/);
 const input=JSON.parse(sent.prompt);assert.equal(input.answerKey,'A. a；C. c');assert.equal(input.selectedText,'A. a；D. d');assert.deepEqual(input.selected,[0,3]);
 await handle(req('explain',{question:q,locale:'en',selected:99}));assert.match(sent.system,/in English/);assert.equal(JSON.parse(sent.prompt).selected,null);
});
test('MiniMax transport uses the configured official region, handles SSE fragmentation and strips thinking',async()=>{
 let sent;const provider=createMiniMaxProvider(config,{fetchModel:async(url,options)=>{sent={url,options};const chunks=[{choices:[{delta:{content:'<think>private</think>{"expl'}}]},{choices:[{delta:{content:'anation":"four"}'},finish_reason:'stop'}],usage:{total_tokens:20}}];const text=chunks.map(p=>'data: '+JSON.stringify(p)+'\n\n').join('')+'data: [DONE]\n\n';return new Response(new ReadableStream({start(c){const bytes=new TextEncoder().encode(text);for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});}});
 const result=await provider({system:'Explain',prompt:'q'});assert.equal(result.value.explanation,'four');assert.equal(sent.url,'https://api.minimaxi.com/v1/chat/completions');assert.equal(JSON.parse(sent.options.body).thinking.type,'disabled');assert.equal(result.usage.total_tokens,20);
});
