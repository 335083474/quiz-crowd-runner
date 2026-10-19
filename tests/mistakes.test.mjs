import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordAnswer,loadMistakes,dueMistakes,dueForBank,practiceRound,reviewRound,questionKey,MISTAKE_STORAGE,REVIEW_INTERVALS} from '../src/data/mistakes.mjs';
import {demoQuestions} from '../src/data/banks.mjs';
const bank={id:'one',name:'First bank'},q=demoQuestions()[0],at=1_000_000;
function storage(){const rows=new Map();return {getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)};}

test('wrong answers are saved immediately, deduplicated and survive storage reload; new correct answers are not added',()=>{
 const db=storage();assert.equal(recordAnswer(db,q,q.answer,bank,{now:at}).tracked,false);assert.equal(db.getItem(MISTAKE_STORAGE),null);
 const first=recordAnswer(db,q,0,bank,{now:at});assert.equal(first.added,true);assert.equal(first.entry.dueAt,at+600_000);assert.equal(first.entry.wrongCount,1);
 q.options[0]='changed externally';assert.notEqual(loadMistakes(db)[0].question.options[0],q.options[0]);q.options[0]=demoQuestions()[0].options[0];
 const again=recordAnswer(db,q,1,bank,{now:at+30_000});assert.equal(again.added,false);assert.equal(loadMistakes(db).length,1);assert.equal(again.entry.wrongCount,2);assert.equal(again.entry.dueAt,at+630_000);
 assert.equal(dueMistakes(loadMistakes(db),at+629_999).length,0);assert.equal(dueMistakes(loadMistakes(db),at+630_000).length,1);
});

test('correct spaced reviews advance 1/3/7/14/30 days; an early ordinary answer cannot advance them and another mistake resets to 10 minutes',()=>{
 const db=storage();let entry=recordAnswer(db,q,0,bank,{now:at}).entry;
 const early=recordAnswer(db,q,q.answer,bank,{now:at+1});assert.equal(early.rescheduled,false);assert.equal(early.entry.dueAt,entry.dueAt);assert.equal(early.entry.correctReviews,0);
 for(let i=1;i<=6;i++){
  const now=entry.dueAt;entry=recordAnswer(db,q,q.answer,bank,{now}).entry;
  assert.equal(entry.stage,Math.min(i,5));assert.equal(entry.dueAt,now+REVIEW_INTERVALS[Math.min(i,5)]);assert.equal(entry.correctReviews,i);
 }
 assert.equal(entry.wrongCount,1);assert.equal(entry.lastWrongSelected,0);
 entry=recordAnswer(db,q,1,bank,{now:entry.dueAt-1}).entry;assert.equal(entry.stage,0);assert.equal(entry.wrongCount,2);assert.equal(entry.dueAt,entry.lastAnsweredAt+600_000);assert.equal(entry.lastWrongSelected,1);
 const manual=recordAnswer(db,q,q.answer,bank,{now:entry.lastAnsweredAt+1,review:true});assert.equal(manual.rescheduled,true);assert.equal(manual.entry.stage,1);
});

test('identity separates banks and changed content or keys; multiple-choice wrong sets and judgment answers persist correctly',()=>{
 const db=storage();recordAnswer(db,q,0,bank,{now:at});recordAnswer(db,q,0,{id:'two',name:'Second'},{now:at});recordAnswer(db,{...q,prompt:'New question'},0,bank,{now:at});
 assert.equal(loadMistakes(db).length,3);assert.notEqual(questionKey(bank.id,q),questionKey(bank.id,{...q,answer:3}));
 const multi={id:'multi',prompt:'Choose two',options:['a','b','c','d'],answer:[0,2]};const selected=[2];const wrong=recordAnswer(db,multi,selected,bank,{now:at});selected.push(0);assert.deepEqual(loadMistakes(db).find(e=>e.key===wrong.entry.key).lastSelected,[2]);
 assert.equal(recordAnswer(db,multi,[2,0],bank,{now:at+600_000}).correct,true);
 assert.throws(()=>recordAnswer(db,multi,[2,2],bank));assert.throws(()=>recordAnswer(db,multi,2,bank));
 const tf={id:'bool',prompt:'True or false',options:['true','false'],answer:1};assert.equal(recordAnswer(db,tf,0,bank,{now:at}).tracked,true);
});

test('only up to two due, unchanged questions from the active bank lead a normal round; orphaned records remain manually reviewable',()=>{
 const db=storage(),questions=demoQuestions();for(const question of questions)recordAnswer(db,question,(question.answer+1)%4,bank,{now:at});
 recordAnswer(db,q,0,{id:'other',name:'Other bank'},{now:at-100});const entries=loadMistakes(db),full={...bank,questions};
 assert.equal(dueForBank(entries,full,'zh-CN',at+599_999).length,0);assert.equal(dueForBank(entries,full,'zh-CN',at+600_000).length,6);
 const round=practiceRound(full,'zh-CN',entries,at+600_000,()=>.5);assert.equal(round.length,6);assert.equal(new Set(round.map(q=>q.id)).size,6);assert.deepEqual(round.filter(q=>q.reviewKey).map(q=>q.id),questions.slice(0,2).map(q=>q.id));assert.equal(round[0].reward.value,18);assert.equal(round[1].reward.type,'shield');
 assert.equal(practiceRound(full,'zh-CN',entries,at+1).filter(q=>q.reviewKey).length,0);
 assert.equal(dueForBank(entries,{...full,questions:[{...q,prompt:'edited'}]},'zh-CN',at+600_000).length,0);
 const review=reviewRound(entries);assert.equal(review.length,6);assert.equal(review[0].reviewBank.id,'one');review[0].options[0]='mutated';assert.notEqual(entries[0].question.options[0],'mutated');assert.deepEqual(reviewRound([]),[]);
});

test('corrupt notebooks and full storage never silently overwrite previous records',()=>{
 const db=storage();db.setItem(MISTAKE_STORAGE,'broken');assert.throws(()=>loadMistakes(db));assert.throws(()=>recordAnswer(db,q,0,bank));assert.equal(db.getItem(MISTAKE_STORAGE),'broken');
 const good=storage();recordAnswer(good,q,0,bank,{now:at});const original=good.getItem(MISTAKE_STORAGE);const full={getItem:good.getItem,setItem:()=>{throw Error('QuotaExceeded');}};assert.throws(()=>recordAnswer(full,q,1,bank,{now:at+1}));assert.equal(good.getItem(MISTAKE_STORAGE),original);
});
