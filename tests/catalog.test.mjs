import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateQuestions,roundQuestions,answerText} from '../src/data/banks.mjs';
import {Game} from '../src/simulation/game.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../public/banks/'+name,import.meta.url),'utf8'));

test('every published paper validates and matches its catalog, with original answer provenance',()=>{
 const {items}=read('index.json'),ids=new Set();let total=0,blocked=0;
 assert.equal(items.length,49);
 for(const item of items){
  assert.ok(!ids.has(item.id));ids.add(item.id);
  const bank=read(item.id+'.json');assert.equal(bank.count,item.count);assert.equal(bank.questions.length,item.count);assert.equal(bank.aiProcessed,0);
  if(!item.count){assert.ok(['scanned','missing_answers','needs_review'].includes(item.status));blocked++;continue;}
  assert.equal(item.status,'ready');const qs=validateQuestions(bank.questions);total+=qs.length;
  for(const q of qs){
   assert.equal(q.source.sha256,bank.sourceHash);assert.equal(q.source.file,bank.sourceFile);assert.ok(q.source.number>0);
   assert.ok(['inline_answer','numbered_answer_key','option_marks','inline_judgment'].includes(q.source.answerOrigin));
   assert.ok(q.source.page===null||q.source.page>=1&&q.source.page<=bank.pages);
   assert.doesNotMatch([q.prompt,...q.options,q.explanation].join(' '),/扫码|网校|公众号|全班次|精讲冲刺|模考押题|参考答案|【答案】/);
  }
  for(const kind of ['single','multiple','boolean'])assert.equal(qs.filter(q=>q.type===kind).length,bank.types[kind]);
 }
 assert.equal(total,2711);assert.equal(blocked,8);
});

test('multiple answers require the full set, order is irrelevant and input arrays cannot change history',()=>{
 const bank={questions:validateQuestions([{id:'multi',prompt:'Choose two',options:['a','b','c','d'],answer:'BD'}])};
 const g=new Game(roundQuestions(bank));g.start();assert.equal(g.answer(1),false);assert.equal(g.answer([]),false);assert.equal(g.answer([1,1]),false);assert.equal(g.answer([4]),false);
 const selected=[3,1];assert.equal(g.answer(selected),true);selected[0]=0;assert.equal(g.summary.ok,true);assert.deepEqual(g.history[0].selected,[1,3]);
 g.reset();g.start();g.answer([1]);assert.equal(g.summary.ok,false);
 g.reset();g.start();g.answer([1,2,3]);assert.equal(g.summary.ok,false);
 assert.equal(answerText(bank.questions[0]),'B. b；D. d');
});

test('judgment questions accept only their two options and round snapshots preserve answer arrays and provenance',()=>{
 const bank={questions:validateQuestions([{id:'tf',prompt:'True or false',options:['正确','错误'],answer:'B',source:{number:7}},{id:'multi',prompt:'Two options',options:['a','b','c','d'],answer:[0,2]}])};
 const round=roundQuestions(bank,'zh-CN',()=>.999);round[1].answer.push(3);round[0].source.number=8;
 assert.deepEqual(bank.questions[1].answer,[0,2]);assert.equal(bank.questions[0].source.number,7);
 const g=new Game(roundQuestions({questions:[bank.questions[0]]}));g.start();assert.equal(g.answer(2),false);g.answer(1);assert.equal(g.summary.ok,true);
});
