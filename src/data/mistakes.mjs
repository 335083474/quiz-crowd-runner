import {validateQuestions,roundQuestions,demoQuestions,answerIndices} from './banks.mjs';

export const MISTAKE_STORAGE='quiz-runner-mistakes-v1';
export const REVIEW_INTERVALS=[10*60_000,24*3600_000,3*24*3600_000,7*24*3600_000,14*24*3600_000,30*24*3600_000];
const storageError='错题本无法读取，请先导出备份，不会覆盖原记录。';
const copy=value=>JSON.parse(JSON.stringify(value));
export function questionKey(bankId,q){
 // Content is part of identity: a changed question/key must not inherit old progress.
 const content=JSON.stringify([bankId,q.id,q.prompt,q.options,Array.isArray(q.answer),answerIndices(q.answer).slice().sort((a,b)=>a-b)]);
 let a=2166136261,b=5381;for(let i=0;i<content.length;i++){a=Math.imul(a^content.charCodeAt(i),16777619);b=Math.imul(b,33)^content.charCodeAt(i);}
 return 'm-'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export function loadMistakes(storage){
 const raw=storage.getItem(MISTAKE_STORAGE);if(!raw)return [];
 try{
  const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.entries))throw Error();
  const keys=new Set();return data.entries.map(entry=>{
   const question=validateQuestions([entry.question])[0];
   if(typeof entry.bankId!=='string'||typeof entry.bankName!=='string'||entry.key!==questionKey(entry.bankId,question)||keys.has(entry.key))throw Error();keys.add(entry.key);
   for(const field of ['dueAt','firstWrongAt','lastWrongAt','lastAnsweredAt'])if(!Number.isFinite(entry[field])||entry[field]<0)throw Error();
   for(const field of ['stage','wrongCount','correctReviews'])if(!Number.isInteger(entry[field])||entry[field]<0)throw Error();
   if(entry.stage>=REVIEW_INTERVALS.length||!entry.wrongCount)throw Error();
   for(const answer of [entry.lastSelected,entry.lastWrongSelected??entry.lastSelected]){const selected=answerIndices(answer);if(!selected.length||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=question.options.length)||Array.isArray(question.answer)!==Array.isArray(answer))throw Error();}
   return {...entry,question};
  });
 }catch{throw Error(storageError);}
}
export function dueMistakes(entries,now=Date.now()){return entries.filter(e=>e.dueAt<=now).sort((a,b)=>a.dueAt-b.dueAt||a.firstWrongAt-b.firstWrongAt);}
export function recordAnswer(storage,question,selected,bank,{now=Date.now(),review=false}={}){
 const q=validateQuestions([question])[0],values=answerIndices(selected),expected=answerIndices(q.answer);
 if(!values.length||new Set(values).size!==values.length||values.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length)||Array.isArray(q.answer)!==Array.isArray(selected))throw Error('无效答案');
 const correct=values.length===expected.length&&values.every(i=>expected.includes(i));
 const entries=loadMistakes(storage),key=questionKey(bank.id,q),index=entries.findIndex(e=>e.key===key),old=entries[index];
 if(correct&&!old)return {correct,tracked:false};
 const entry=old?copy(old):{key,question:q,bankId:bank.id,bankName:bank.name,firstWrongAt:now,wrongCount:0,correctReviews:0,stage:0};
 entry.lastSelected=copy(selected);entry.lastAnsweredAt=now;
 if(!correct){entry.wrongCount++;entry.lastWrongSelected=copy(selected);entry.stage=0;entry.lastWrongAt=now;entry.dueAt=now+REVIEW_INTERVALS[0];}
 else if(review||old.dueAt<=now){entry.stage=Math.min(entry.stage+1,REVIEW_INTERVALS.length-1);entry.correctReviews++;entry.dueAt=now+REVIEW_INTERVALS[entry.stage];}
 if(index<0)entries.push(entry);else entries[index]=entry;
 // One atomic write. On quota failure the old notebook remains intact.
 try{storage.setItem(MISTAKE_STORAGE,JSON.stringify({version:1,entries}));}catch{throw Error('错题本保存失败，请先导出备份并检查浏览器存储空间。');}
 return {correct,tracked:true,added:!old,rescheduled:!correct||review||old.dueAt<=now,entry:copy(entry)};
}
export function dueForBank(entries,bank,locale='zh-CN',now=Date.now()){
 const bankId=bank?.id??'demo',source=bank?.questions??demoQuestions(locale),available=new Set(source.map(q=>questionKey(bankId,q)));
 return dueMistakes(entries,now).filter(e=>e.bankId===bankId&&available.has(e.key));
}
export function practiceRound(bank,locale,entries,now=Date.now(),random=Math.random){
 const bankId=bank?.id??'demo',source=bank?.questions??demoQuestions(locale),available=new Map(source.map(q=>[questionKey(bankId,q),q]));
 const due=dueForBank(entries,bank,locale,now).slice(0,2);
 const base=roundQuestions(bank,locale,random);if(!due.length)return base;
 const priority=due.map(entry=>({...available.get(entry.key),reviewKey:entry.key})),keys=new Set(priority.map(q=>q.id));
 const rows=[...priority,...base.filter(q=>!keys.has(q.id))].slice(0,6);
 return roundQuestions({questions:rows},locale,()=>.999999);
}
export function reviewRound(entries,locale='zh-CN'){
 const rows=entries.slice(0,6).map(entry=>({...copy(entry.question),reviewKey:entry.key,reviewBank:{id:entry.bankId,name:entry.bankName}}));
 return rows.length?roundQuestions({questions:rows},locale,()=>.999999):[];
}
