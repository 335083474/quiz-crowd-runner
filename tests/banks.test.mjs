import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateQuestions,parseBank,loadBanks,saveBank,roundQuestions,demoQuestions,BANK_STORAGE} from '../src/data/banks.mjs';
import {Game} from '../src/simulation/game.mjs';
import {t,setLocale,escapeHtml} from '../src/i18n.mjs';
const question={prompt:'2+2=?',options:['1','2','3','4'],answer:'D',explanation:'Four'};
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
test('JSON, CSV with quoted commas/newlines and numbered TXT normalize the same answer',()=>{
 assert.equal(parseBank(JSON.stringify({questions:[question]}))[0].answer,3);
 const csv='prompt,A,B,C,D,answer,explanation\n"What, exactly?",1,2,3,4,D,"Line 1\nLine 2"';const rows=parseBank(csv,'bank.csv');assert.equal(rows[0].prompt,'What, exactly?');assert.equal(rows[0].explanation,'Line 1\nLine 2');assert.equal(rows[0].answer,3);
 const txt='1. 2+2=?\nA. 1\nB. 2\nC. 3\nD. 4\n答案：D\n解析：四。\n\n2. 1+1=?\nA. 1\nB. 2\nC. 3\nD. 4\nAnswer: B';assert.deepEqual(parseBank(txt).map(q=>q.answer),[3,1]);
});
test('invalid question banks reject missing answers, duplicate IDs and malformed option counts',()=>{
 for(const q of [{...question,answer:4},{...question,answer:'1'},{...question,options:['a','b']},{...question,options:['a','b','c','']}])assert.throws(()=>validateQuestions([q]));
 assert.throws(()=>validateQuestions([{...question,id:'same'},{...question,id:'same'}]));assert.throws(()=>parseBank('plain question, no options'));assert.throws(()=>validateQuestions([]));
});
test('a failed import does not overwrite saved banks, stored corruption is ignored, and rounds are snapshots',()=>{
 const db=storage();saveBank(db,{id:'one',name:'Math',questions:[question]});assert.throws(()=>saveBank(db,{id:'two',name:'Broken',questions:[{...question,answer:8}]}));assert.equal(loadBanks(db).length,1);
 const round=roundQuestions(loadBanks(db)[0]);round[0].options[0]='Changed';assert.equal(loadBanks(db)[0].questions[0].options[0],'1');db.setItem(BANK_STORAGE,'{broken');assert.deepEqual(loadBanks(db),[]);
});
test('one-question banks finish the final castle and bank changes cannot replace a running round',()=>{
 const g=new Game(roundQuestions({questions:validateQuestions([question])}));assert.equal(g.routeDistance,48);g.start();assert.equal(g.setQuestions(demoQuestions()),false);assert.equal(g.questions.length,1);g.answer(3);for(let i=0;i<1000&&g.phase!=='result';i++)g.tick(.05);assert.equal(g.outcome,'victory');assert.equal(g.distance,48);
});
test('English demo, interface translations and HTML escaping retain quiz semantics',()=>{
 const zh=demoQuestions(),en=demoQuestions('en');assert.deepEqual(zh.map(q=>q.answer),en.map(q=>q.answer));assert.equal(en[0].options[2],'Pacific');setLocale('en');assert.equal(t('护盾 +{n}',{n:24}),'+24 shield');setLocale('zh-CN');assert.equal(t('护盾 +{n}',{n:24}),'护盾 +24');assert.equal(escapeHtml('<img src=x onerror="evil">'),'&lt;img src=x onerror=&quot;evil&quot;&gt;');
});
