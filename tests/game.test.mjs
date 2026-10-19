import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,GATE_DISTANCE} from '../src/simulation/game.mjs';
function finishBattle(g,dt=.05){for(let i=0;i<10000&&['march','combat'].includes(g.phase);i++)g.tick(dt);}
test('six answer selections automatically complete the run and final castle',()=>{
  const g=new Game();g.start();
  for(let i=0;i<6;i++){
    assert.equal(g.phase,'question');assert.equal(g.index,i);
    g.answer(g.question.answer);assert.equal(g.phase,'march');finishBattle(g);
    assert.equal(g.phase,i<5?'question':'result');
  }
  assert.equal(g.outcome,'victory');assert.equal(g.correct,6);assert.equal(g.distance,168);assert.ok(g.troops>0);
});
test('wrong answers also launch immediately, reinforce enemies and preserve review history',()=>{
  const g=new Game();g.start();g.answer((g.question.answer+1)%4);
  assert.equal(g.summary.enemyBonus,10);assert.equal(g.phase,'march');finishBattle(g);
  assert.equal(g.phase,'question');assert.equal(g.index,1);
  g.answer((g.question.answer+1)%4);finishBattle(g);
  assert.equal(g.outcome,'defeat');assert.equal(g.troops,0);assert.equal(g.history.length,2);
  g.reset();assert.equal(g.troops,40);assert.equal(g.history.length,0);assert.equal(g.lastSegment,null);assert.equal(g.phase,'ready');
});
test('reward applies once, and invalid or paused answers do not mutate state',()=>{
  const g=new Game();g.start();g.paused=true;assert.equal(g.answer(2),false);
  g.paused=false;assert.equal(g.answer(-1),false);g.answer(g.question.answer);
  const n=g.troops;assert.equal(g.answer(g.question.answer),false);assert.equal(g.troops,n);
  g.paused=true;g.tick(100);assert.equal(g.elapsed,0);assert.equal(g.distance,0);
  assert.equal(g.troops,40);assert.equal(g.rewardSequence,0);
  g.paused=false;
  while(g.distance-g.marchStart<GATE_DISTANCE){
    assert.equal(g.troops,40);assert.equal(g.rewardSequence,0);g.tick(.01);
  }
  assert.equal(g.troops,58);assert.equal(g.rewardSequence,1);assert.equal(g.gateReward.before,40);assert.equal(g.gateReward.after,58);
  g.tick(.2);assert.equal(g.troops,58);assert.equal(g.rewardSequence,1);
});
test('all reward types activate at the gate, wrong answers grant nothing, and skipped frames cannot miss the gate',()=>{
  const g=new Game();g.start();g.answer(g.question.answer);g.tick(4);
  assert.equal(g.phase,'combat');assert.equal(g.troops,58);assert.equal(g.rewardSequence,1);
  finishBattle(g);g.answer(g.question.answer);assert.equal(g.shield,0);
  g.tick(1.1);assert.equal(g.gateCrossed,true);assert.equal(g.shield,24);assert.equal(g.gateReward.type,'shield');
  finishBattle(g);const before=g.troops;g.answer(g.question.answer);assert.equal(g.troops,before);
  g.tick(1.1);assert.equal(g.troops,before*2);assert.equal(g.gateReward.type,'multiply');
  finishBattle(g);const count=g.rewardSequence;g.answer((g.question.answer+1)%4);g.tick(1.1);
  assert.equal(g.gateCrossed,true);assert.equal(g.rewardSequence,count);assert.equal(g.gateReward,null);
});
test('shield absorbs damage first and automatic transitions are stable across frame rates',()=>{
  const run=dt=>{const g=new Game();g.start();g.answer(g.question.answer);finishBattle(g,dt);
    const n=g.troops;g.answer(g.question.answer);finishBattle(g,dt);
    assert.equal(g.phase,'question');assert.equal(g.index,2);assert.equal(g.troops,n);assert.equal(g.lastSegment.blocked,14);
    return [g.troops,g.shield,g.distance];};
  assert.deepEqual(run(.016),run(.1));
});
test('a wrong answer still permits a comeback without any continue actions',()=>{
  const g=new Game();g.start();for(let i=0;i<6;i++){g.answer(i===1?(g.question.answer+1)%4:g.question.answer);finishBattle(g);}
  assert.equal(g.outcome,'victory');assert.equal(g.correct,5);
});
test('continuous travel freezes on pause and persists when the next question appears automatically',()=>{
  const g=new Game();g.start();g.answer(g.question.answer);
  for(let i=0;i<15;i++)g.tick(.1);
  assert.ok(g.distance>5&&g.distance<24);const mid=g.distance;
  g.paused=true;g.tick(20);assert.equal(g.distance,mid);g.paused=false;
  let previous=mid;for(let i=0;i<100&&g.phase!=='question';i++){g.tick(.1);assert.ok(g.distance>=previous);previous=g.distance;}
  assert.equal(g.phase,'question');assert.equal(g.distance,24);
  g.tick(100);assert.equal(g.distance,24);assert.ok(g.worldDistance>100);assert.equal(g.phase,'question'); // Safe jogging never forces combat.
  g.answer(g.question.answer);finishBattle(g);assert.equal(g.distance,48);
  g.reset();assert.equal(g.distance,0);
});
test('reading jogs forward safely, pause freezes it, and answering accelerates without stopping',()=>{
  const g=new Game();g.start();for(let i=0;i<100;i++)g.tick(.1);
  assert.equal(g.phase,'question');assert.equal(g.history.length,0);assert.equal(g.troops,40);
  assert.ok(g.worldDistance>10);assert.ok(g.speed>1&&g.speed<2);
  const before={distance:g.worldDistance,speed:g.speed};g.paused=true;g.tick(20);
  assert.equal(g.worldDistance,before.distance);assert.equal(g.speed,before.speed);g.paused=false;
  g.answer(g.question.answer);assert.equal(g.worldDistance,before.distance);assert.equal(g.speed,before.speed);
  g.tick(.05);assert.ok(g.speed>before.speed);assert.ok(g.worldDistance>before.distance);
  finishBattle(g);assert.equal(g.phase,'question');assert.equal(g.distance,24);assert.ok(Math.abs(g.lastSegment.worldEnd-before.distance-24)<1e-9);
});
test('jog distance is independent of frame rate, long reading never damages the army, and reset clears travel',()=>{
  const run=dt=>{const g=new Game();g.start();for(let i=0;i<Math.round(8/dt);i++)g.tick(dt);return g.worldDistance;};
  assert.ok(Math.abs(run(.016)-run(.1))<1e-9);
  const g=new Game();g.start();g.tick(3600);assert.equal(g.phase,'question');assert.equal(g.troops,40);assert.ok(g.worldDistance>4000);
  g.answer(g.question.answer);finishBattle(g);assert.equal(g.index,1);assert.equal(g.troops,50);
  g.reset();assert.equal(g.worldDistance,0);assert.equal(g.speed,0);
});
