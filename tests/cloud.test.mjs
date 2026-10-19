import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudWorker,reserveCloudCall,RESERVE_SQL} from '../server/cloud.mjs';
import {DatabaseSync} from 'node:sqlite';
const env={MINIMAX_API_KEY:'synthetic-key',MINIMAX_MODEL:'MiniMax-M3',DB:{prepare(sql){assert.equal(sql,RESERVE_SQL);return {bind(){return {first:async()=>({calls:1})};}};}}};
const makeRequest=(origin='https://335083474.github.io',body={text:'Question A B C D answer B'})=>new Request('https://quiz.example/api/parse',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('cloud AI reserves a shared persistent budget before any provider call',async()=>{
 let calls=0;const worker=createCloudWorker({provider:()=>async()=>{calls++;return {value:{questions:[{prompt:'2+2?',options:['1','2','3','4'],answer:3}]},model:'MiniMax-M3'};}});
 const r=await worker.fetch(makeRequest(),env);assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://335083474.github.io');assert.equal(calls,1);
 const exhausted={...env,DB:{prepare(){return {bind(){return {first:async()=>null};}};}}};const limited=await worker.fetch(makeRequest(),exhausted);assert.equal(limited.status,429);assert.equal(calls,1);
 assert.equal((await worker.fetch(makeRequest('https://evil.example'),env)).status,403);assert.equal((await worker.fetch(makeRequest(''),env)).status,403);
});
test('cloud refuses oversized or invalid requests without reserving the paid budget',async()=>{
 let reserved=0;const worker=createCloudWorker({provider:()=>async()=>{throw Error('must not call');}});const guarded={...env,DB:{prepare(){reserved++;throw Error();}}};assert.equal((await worker.fetch(makeRequest(undefined,{text:'x'.repeat(70000)}),guarded)).status,413);assert.equal((await worker.fetch(makeRequest(undefined,{text:''}),guarded)).status,400);assert.equal(reserved,0);
});
test('missing cloud budget storage fails closed',async()=>{await assert.rejects(()=>reserveCloudCall(null),/provider_unavailable/);});
test('the actual quota SQL enforces shared minute/day caps and opens a fresh day without resetting old usage',()=>{const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE ai_budget(day TEXT PRIMARY KEY,calls INTEGER,minute INTEGER,minute_calls INTEGER)');const stmt=db.prepare(RESERVE_SQL);for(let i=0;i<6;i++)assert(stmt.get('day-one',0));assert.equal(stmt.get('day-one',0),undefined);for(let i=6;i<50;i++)assert(stmt.get('day-one',i));assert.equal(stmt.get('day-one',999),undefined);assert(stmt.get('day-two',1000));assert.equal(db.prepare('SELECT calls FROM ai_budget WHERE day=?').get('day-one').calls,50);}finally{db.close();}});
