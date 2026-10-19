import {questions as demo} from './questions.mjs';
import {englishDemo} from '../i18n.mjs';
export const BANK_STORAGE='quiz-runner-banks-v1', ACTIVE_STORAGE='quiz-runner-active-bank-v1';
export function demoQuestions(locale='zh-CN'){return demo.map((q,i)=>({...q,options:[...q.options],reward:{...q.reward},...(locale==='en'?{topic:englishDemo[i][0],prompt:englishDemo[i][1],options:[...englishDemo[i][2]],explanation:englishDemo[i][3]}:{})}));}
export function validateQuestions(input){
 const rows=Array.isArray(input)?input:input?.questions;
 if(!Array.isArray(rows)||!rows.length||rows.length>200)throw Error('题目必须是 1–200 道题的数组。');
 const ids=new Set();return rows.map((q,i)=>{
  if(!q||typeof q!=='object')throw Error('题目和四个选项均不能为空。');
  const prompt=q.prompt??q.question,options=q.options;
  if(typeof prompt!=='string'||!prompt.trim()||!Array.isArray(options)||![2,4].includes(options.length)||options.some(o=>typeof o!=='string'||!o.trim()))throw Error('题目需包含完整的 2 或 4 个选项。');
  let answer=q.answer;if(typeof answer==='string'&&/^[A-D]+$/i.test(answer.trim())){const values=[...answer.trim().toUpperCase()].map(c=>'ABCD'.indexOf(c));answer=values.length===1?values[0]:values;}
  const values=Array.isArray(answer)?answer:[answer];
  if(!values.length||new Set(values).size!==values.length||values.some(a=>!Number.isInteger(a)||a<0||a>=options.length))throw Error('答案必须对应有效选项，多选答案不能重复。');
  answer=Array.isArray(answer)?[...answer].sort((a,b)=>a-b):answer;
  const id=String(q.id??`q-${i+1}`),topic=String(q.topic??''),explanation=String(q.explanation??'');
  if(ids.has(id))throw Error('题目编号不能重复。');ids.add(id);
  if(prompt.length>1000||options.some(o=>o.length>300)||explanation.length>3000||topic.length>80||id.length>100)throw Error('文本过长，请缩短后再导入。');
  return {id,type:Array.isArray(answer)?'multiple':options.length===2?'boolean':'single',topic:topic.trim(),prompt:prompt.trim(),options:options.map(o=>o.trim()),answer,explanation:explanation.trim(),...(q.source?{source:{...q.source}}:{})};
 });
}
function csvRows(text){let rows=[],row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(value.replace(/\r$/,''));value='';if(c==='\n'){rows.push(row);row=[];}}else value+=c;}if(quoted)throw Error('无法识别格式，请使用模板或用 AI 整理。');row.push(value.replace(/\r$/,''));if(row.some(v=>v.trim()))rows.push(row);return rows.filter(r=>r.some(v=>v.trim()));}
export function parseBank(text,filename=''){
 text=text.replace(/^\uFEFF/,'').trim();if(!text)throw Error('无法识别格式，请使用模板或用 AI 整理。');
 if(text.startsWith('{')||text.startsWith('[')){let value;try{value=JSON.parse(text);}catch{throw Error('无法识别格式，请使用模板或用 AI 整理。');}return validateQuestions(value);}
 if(/\.csv$/i.test(filename)||/^\s*(?:prompt|question|题目),/i.test(text)){
  const rows=csvRows(text),header=rows.shift().map(v=>v.trim().toLowerCase()),field=(r,...names)=>r[header.findIndex(h=>names.includes(h))]??'';
  return validateQuestions(rows.map(r=>({prompt:field(r,'prompt','question','题目'),options:['a','b','c','d'].map(k=>field(r,k)),answer:field(r,'answer','答案').trim().match(/^[0-3]$/)?Number(field(r,'answer','答案')):field(r,'answer','答案'),topic:field(r,'topic','分类'),explanation:field(r,'explanation','解析')})));
 }
 const starts=[...text.matchAll(/(?:^|\n)\s*(?:\d+[.、)）]\s*|Q\d+[.:]\s*)/gi)];
 const blocks=starts.length?starts.map((m,i)=>text.slice(m.index,starts[i+1]?.index??text.length).trim()):[text];
 return validateQuestions(blocks.map(block=>{
  const opts=[...block.matchAll(/(?:^|\n)\s*([A-D])[.、:：)）]\s*(.+)/g)];
  const ans=block.match(/(?:答案|answer)\s*[:：]\s*([A-D])/i),exp=block.match(/(?:解析|explanation)\s*[:：]\s*([\s\S]*)/i);
  if(opts.length!==4||!ans||opts.map(x=>x[1]).join('')!=='ABCD')throw Error('无法识别格式，请使用模板或用 AI 整理。');
  return {prompt:block.slice(0,opts[0].index).replace(/^(?:\d+[.、)）]\s*|Q\d+[.:]\s*)/i,'').trim(),options:opts.map(m=>m[2].trim()),answer:ans[1].toUpperCase(),explanation:exp?.[1]?.trim()??''};
 }));
}
export function loadBanks(storage){try{const rows=JSON.parse(storage.getItem(BANK_STORAGE)||'[]');if(!Array.isArray(rows))return [];return rows.slice(0,10).flatMap(b=>{try{if(typeof b.id!=='string'||typeof b.name!=='string')return [];return [{id:b.id,name:b.name.slice(0,80),questions:validateQuestions(b.questions)}];}catch{return [];}});}catch{return [];}}
export function saveBank(storage,bank){const banks=loadBanks(storage);if(banks.length>=10)throw Error('最多保存 10 个自定义题库。');const item={id:bank.id,name:String(bank.name).trim().slice(0,80),questions:validateQuestions(bank.questions)};storage.setItem(BANK_STORAGE,JSON.stringify([...banks,item]));return item;}
export function answerIndices(answer){return Array.isArray(answer)?answer:[answer];}
export function answerText(q,answer=q.answer){return answerIndices(answer).map(i=>`${'ABCD'[i]}. ${q.options[i]}`).join('；');}
export function roundQuestions(bank,locale='zh-CN',random=Math.random){const source=bank?.questions??demoQuestions(locale),rows=source.map(q=>({...q,options:[...q.options],answer:Array.isArray(q.answer)?[...q.answer]:q.answer,...(q.source?{source:{...q.source}}:{})}));if(bank)for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
 return rows.slice(0,6).map((q,i)=>({...q,reward:{...demo[i].reward},enemies:demo[i].enemies,loss:demo[i].loss}));}
export const templateBank={name:'我的题库',questions:[{id:'sample-1',topic:'数学',prompt:'2 + 2 = ?',options:['1','2','3','4'],answer:'D',explanation:'2 加 2 等于 4。'}]};
