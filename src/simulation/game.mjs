import {questions} from '../data/questions.mjs';
export const MARCH_DISTANCE=24;
export const MARCH_DURATION=3.2;
export const ROUTE_DISTANCE=MARCH_DISTANCE*(questions.length+1);
export const JOG_SPEED=1.25;
export const GATE_DISTANCE=6;
export class Game {
  phase='ready'; index=0; troops=40; shield=0; correct=0; selected=null; elapsed=0; paused=false; final=false;
  distance=0; marchStart=0;
  jogDistance=0;speed=0;marchInitialSpeed=0;
  gateCrossed=false;rewardSequence=0;
  /** @type {{index:number,type:string,value:number,before:number,after:number,shieldBefore:number,shieldAfter:number,gained:number,worldZ:number}|null} */
  gateReward=null;
  /** @type {Array<{id:string,selected:number|number[],correct:boolean}>} */
  history=[];
  /** @type {string|null} */
  outcome=null;
  /** @type {{initialTroops:number,initialShield:number,damage:number,applied:number}|null} */
  combat=null;
  /** @type {{ok:boolean,gained:number,blocked:number,lost:number,enemyBonus:number}|null} */
  summary=null;
  /** @type {{index:number,worldEnd:number,ok:boolean,gained:number,blocked:number,lost:number,enemyBonus:number}|null} */
  lastSegment=null;
  /** @param {any[]} bank */
  constructor(bank=questions){ this.questions=bank;this.reset(); }
  setQuestions(bank){if(!['ready','result'].includes(this.phase))return false;if(!Array.isArray(bank)||bank.length<1||bank.length>6)throw Error('Invalid round');this.questions=bank;this.reset();return true;}
  get routeDistance(){return MARCH_DISTANCE*(this.questions.length+1);}
  reset(){ this.phase='ready';this.index=0;this.troops=40;this.shield=0;this.correct=0;this.history=[];this.selected=null;this.elapsed=0;this.paused=false;this.final=false;this.outcome=null;this.combat=null;this.summary=null;this.lastSegment=null;this.distance=0;this.marchStart=0;this.jogDistance=0;this.speed=0;this.marchInitialSpeed=0;this.gateCrossed=false;this.rewardSequence=0;this.gateReward=null; }
  get worldDistance(){ return this.distance+this.jogDistance; }
  get question(){ return this.questions[this.index]; }
  start(){ if(this.phase==='ready')this.phase='question'; }
  answer(option){
    if(this.phase!=='question'||this.paused)return false;
    const q=this.question,values=Array.isArray(option)?option:[option];
    if(!values.length||new Set(values).size!==values.length||values.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length)||Array.isArray(q.answer)!==Array.isArray(option))return false;
    const selected=Array.isArray(option)?[...option].sort((a,b)=>a-b):option;
    this.selected=selected;const expected=Array.isArray(q.answer)?q.answer:[q.answer],ok=values.length===expected.length&&values.every(i=>expected.includes(i));
    this.history.push({id:q.id,selected,correct:ok}); if(ok)this.correct++;
    this.summary={ok,gained:0,blocked:0,lost:0,enemyBonus:ok?0:10};
    this.startMarch(); return true;
  }
  crossGate(){
    if(this.gateCrossed||this.final)return;
    this.gateCrossed=true;
    if(!this.summary?.ok)return;
    const reward=this.question.reward,before=this.troops,shieldBefore=this.shield;
    if(reward.type==='shield')this.shield+=reward.value;
    else if(reward.type==='multiply')this.troops*=reward.value;
    else this.troops+=reward.value;
    this.summary.gained=this.troops-before;
    this.gateReward={index:this.index,type:reward.type,value:reward.value,before,after:this.troops,shieldBefore,shieldAfter:this.shield,gained:this.summary.gained,worldZ:3-this.marchStart-this.jogDistance-GATE_DISTANCE};
    this.rewardSequence++;
  }
  startMarch(){
    this.phase='march';this.elapsed=0;this.marchStart=this.distance;this.marchInitialSpeed=this.speed;this.gateCrossed=this.final;
  }
  finishSegment(blocked,lost){
    this.summary.blocked=blocked;this.summary.lost=lost;
    this.lastSegment={index:this.index,worldEnd:this.worldDistance,...this.summary};
    if(this.index===this.questions.length-1){this.final=true;this.startMarch();}
    else {this.index++;this.phase='question';this.elapsed=0;this.selected=null;this.summary=null;this.gateCrossed=false;this.gateReward=null;}
  }
  beginCombat(){
    const damage=this.final?44:this.question.loss+(this.summary?.enemyBonus??0);
    this.combat={initialTroops:this.troops,initialShield:this.shield,damage,applied:0};
    this.phase='combat';this.elapsed=0;this.speed=0;
  }
  tick(dt){
    if(this.paused||!Number.isFinite(dt)||dt<=0)return;
    if(this.phase==='question'){
      // Safe approach extends while reading. No timer, damage, or forced answer.
      const decay=Math.exp(-4*dt);
      this.jogDistance+=JOG_SPEED*dt+(this.speed-JOG_SPEED)*(1-decay)/4;
      this.speed=JOG_SPEED+(this.speed-JOG_SPEED)*decay;
    }
    else if(this.phase==='march'){
      this.elapsed+=dt;
      const t=Math.min(this.elapsed,MARCH_DURATION),accel=.5,decel=.4,s0=this.marchInitialSpeed;
      const peak=(MARCH_DISTANCE-s0*accel/2)/(MARCH_DURATION-(accel+decel)/2);
      const accelDistance=(s0+peak)*accel/2;
      let travelled;
      if(t<accel){travelled=s0*t+(peak-s0)*t*t/(2*accel);this.speed=s0+(peak-s0)*t/accel;}
      else if(t<MARCH_DURATION-decel){travelled=accelDistance+peak*(t-accel);this.speed=peak;}
      else{const u=t-(MARCH_DURATION-decel);travelled=accelDistance+peak*(MARCH_DURATION-decel-accel)+peak*u-peak*u*u/(2*decel);this.speed=peak*(1-u/decel);}
      this.distance=this.marchStart+travelled;
      if(this.distance-this.marchStart>=GATE_DISTANCE)this.crossGate();
      if(this.elapsed>=MARCH_DURATION){this.distance=this.marchStart+MARCH_DISTANCE;this.beginCombat();}
    }
    else if(this.phase==='combat'){
      this.elapsed+=dt; const c=this.combat;
      const applied=Math.floor(c.damage*Math.min(this.elapsed/3.2,1)); c.applied=applied;
      const blocked=Math.min(c.initialShield,applied),lost=Math.min(c.initialTroops,Math.max(0,applied-blocked));
      this.shield=c.initialShield-blocked; this.troops=c.initialTroops-lost;
      if(this.troops===0){this.phase='result';this.outcome='defeat';}
      else if(this.elapsed>=3.2){
        if(this.final){this.phase='result';this.outcome='victory';}
        else this.finishSegment(blocked,lost);
      }
    }
  }
}
