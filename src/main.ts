import './style.css';
import {Game,MARCH_DISTANCE,MARCH_DURATION,ROUTE_DISTANCE} from './simulation/game.mjs';
import {questions,rewardLabel} from './data/questions.mjs';
import {World} from './render/world';

const icon=(name:string)=>({shield:'◈',troops:'♟',flag:'⚑',sound:'♪',pause:'Ⅱ'}[name]??name);
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<main id="game-shell">
 <div id="world"></div><div class="vignette"></div>
 <header class="topbar"><a class="wordmark" href="./" aria-label="答题冲锋首页"><span class="mark">⚑</span><span>答题冲锋<small>QUIZ & CONQUER</small></span></a><div class="tools"><button id="sound" class="round" title="开启声音" aria-label="开启声音" aria-pressed="false">♪<span class="sound-slash"></span></button><button id="pause" class="round" aria-label="暂停游戏" title="暂停游戏">Ⅱ</button></div></header>
 <div class="hud" id="hud"><div class="stat blue-stat"><span class="stat-icon">♟</span><div><small>我的兵力</small><strong id="troop-count">40</strong></div><span class="stat-change" id="troop-change"></span></div><div class="stat shield-stat"><span class="stat-icon">◈</span><div><small>护盾</small><strong id="shield-count">0</strong></div></div></div>
 <nav class="progress" aria-label="关卡进度"><div class="progress-label"><span id="progress-label">准备出征</span><span>终点城堡 ⚑</span></div><div class="steps">${questions.map((_,i)=>`<span class="step" data-step="${i}"></span>`).join('')}<span class="castle-dot">♜</span></div></nav>
 <div class="enemy-tag" id="enemy-tag"><span>敌方防线</span><strong>12</strong></div>
 <div id="army-label" class="army-label" aria-hidden="true"><strong id="army-count" class="army-number">40</strong><span class="army-delta" hidden></span></div>
 <div class="toast" id="toast" role="status" aria-live="polite"></div>
 <section class="panel intro-panel" id="panel"></section>
 <div class="battle-caption" id="battle-caption" hidden><span class="pulse"></span><span id="battle-label">蓝军前进中</span><small id="battle-detail">准备迎战下一道防线</small><p id="battle-explanation" hidden></p><div class="run-track"><i id="run-fill"></i></div></div>
 <footer class="footer"><span>答对一题，向前一步。</span><button id="help">玩法说明</button></footer>
 <div class="modal-backdrop" id="modal" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></section></div>
 <div id="loading"><div class="loading-flag">⚑</div><strong>正在集结蓝军</strong><span>装载城堡与跑道…</span></div>
</main>`;
const $=(s:string)=>document.querySelector<HTMLElement>(s)!;
const game=new Game();
let world:World;
let muted=true, audio:AudioContext|null=null, lastKey='', lastTroops=40, lastShield=0, toastTimer=0,lastCleared=-1,lastReward=0;
let modalReturnFocus:HTMLElement|null=null;
function sound(ok:boolean){if(muted)return;try{audio??=new AudioContext();void audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.type='sine';osc.frequency.setValueAtTime(ok?660:180,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(ok?990:100,audio.currentTime+.16);gain.gain.setValueAtTime(.06,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.23);osc.start();osc.stop(audio.currentTime+.24);}catch{}}
function toast(text:string,reward=false){$('#toast').textContent=text;$('#toast').classList.toggle('reward-result',reward);$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('#toast').classList.remove('show'),2300);}
function primary(label:string,action:string){return `<button class="primary" data-action="${action}">${label}<span>→</span></button>`;}
function renderPanel(){
 const p=$('#panel'),q=game.question;
 p.className=`panel ${game.phase==='ready'?'intro-panel':''}`;p.hidden=['march','combat'].includes(game.phase);
 $('#battle-caption').hidden=!['march','combat'].includes(game.phase);
 if(game.phase==='ready')p.innerHTML=`<div class="eyebrow"><span></span>知识就是战斗力</div><h1>答对，就壮大。<br><em>带着蓝军冲到底！</em></h1><p class="intro-copy">慢跑答题，选完加速冲锋。<br>一路突破防线，拿下终点城堡。</p><div class="intro-perks"><span>♟ 答对增兵</span><span>◈ 护盾护航</span><span>⚑ 自动连闯</span></div>${primary('开始冲锋','start')}<div class="panel-foot">6 道自写演示题 · 无答题限时 · 慢跑不停步</div>`;
 if(game.phase==='question')p.innerHTML=`<div class="question-top"><span class="eyebrow">第 ${String(game.index+1).padStart(2,'0')} / 06 题 <span class="topic">${q.topic}</span></span><span class="reward-pill">${q.reward.type==='shield'?'◈':'✦'} ${rewardLabel(q.reward)}</span></div><h2>${q.prompt}</h2><div class="answers">${q.options.map((o:string,i:number)=>`<button class="answer" data-answer="${i}"><span class="option-letter">${'ABCD'[i]}</span><span>${o}</span></button>`).join('')}</div><div class="question-hint">答对得奖励 · 答错敌军 +10 <span class="jog-note">慢跑中 · 不限时</span></div>`;
 if(game.phase==='result'){
   const win=game.outcome==='victory',mistakes=game.history.filter((h:any)=>!h.correct);
   p.innerHTML=`<div class="result-badge">${win?'⚑':'♡'}</div><div class="eyebrow">${win?'终点城堡已拿下':'本次远征结束'}</div><h1>${win?'蓝军，凯旋！':'整队，再出发。'}</h1><p class="result-copy">${win?'知识让你的队伍走到了最后。':'每一道错题，都是下一次的增援。'}</p><div class="segment-stats"><div><strong>${game.correct}<span>/6</span></strong><small>答对题数</small></div><div><strong>${game.troops}</strong><small>剩余兵力</small></div><div><strong>${game.history.length}</strong><small>完成题目</small></div></div><div class="result-actions">${primary('再冲一局','restart')}${mistakes.length?'<button class="secondary" data-action="review">查看错题解析</button>':''}</div><div class="panel-foot">综合常识演示 · 后续可替换为你的学科题库</div>`;
 }
}
function sync(){
 const g=game;$('#troop-count').textContent=String(g.troops);$('#army-count').textContent=String(g.troops);$('#shield-count').textContent=String(g.shield);
 $('#progress-label').textContent=g.phase==='ready'?'六道防线 · 一座城堡':g.final?'最终战 · 攻下城堡':`第 ${g.index+1} / 6 道防线`;
 document.querySelectorAll<HTMLElement>('.step').forEach((e,i)=>{e.classList.toggle('done',g.final||i<g.index);e.classList.toggle('current',!g.final&&i===g.index);});
 const tag=$('#enemy-tag');tag.hidden=g.phase==='result';tag.querySelector('span')!.textContent=g.final?'终点城堡':'敌方防线';
 const n=g.final?80:g.question.enemies+(g.summary?.enemyBonus??0);tag.querySelector('strong')!.textContent=g.phase==='combat'?String(Math.ceil(n*(1-Math.min(g.elapsed/3.2,1)))):String(n);
 $('#battle-label').textContent=g.phase==='march'?(g.final?'向城堡发起冲锋！':g.summary?.ok?g.gateCrossed?(g.question.reward.type==='shield'?'护盾已激活，冲锋！':'增兵到位，继续冲锋！'):'答对了，冲过屏障！':'敌军增援，继续冲锋！'):'正在突破防线';
 $('#battle-detail').textContent=g.phase==='march'?`已前进 ${Math.floor(g.worldDistance)} 米 · 距防线 ${Math.ceil(MARCH_DISTANCE-(g.distance-g.marchStart))} 米`:g.shield>0?'护盾正在抵挡攻击':'小兵正在攻打敌军';
 $('#run-fill').style.width=`${Math.min(g.elapsed/MARCH_DURATION,1)*100}%`;
 const explanation=$('#battle-explanation');explanation.hidden=g.final||g.summary?.ok!==false;
 if(!explanation.hidden)explanation.textContent=`正确答案：${g.question.options[g.question.answer]}。${g.question.explanation}`;
 if(g.lastSegment&&g.lastSegment.index!==lastCleared){lastCleared=g.lastSegment.index;toast(`第 ${lastCleared+1} 道防线突破 · 损耗 ${g.lastSegment.lost} 人`);}
 if(g.gateReward&&g.rewardSequence!==lastReward){lastReward=g.rewardSequence;const r=g.gateReward;toast(r.type==='shield'?`穿过屏障 · 护盾 +${r.value}`:`${r.type==='multiply'?'兵力翻倍':`增兵 +${r.gained}`} · ${r.before} → ${r.after} 人`,true);sound(true);}
 if(g.phase==='ready'||(g.phase==='question'&&g.index===0&&g.history.length===0)){lastCleared=-1;lastReward=0;$('#toast').classList.remove('show');}
 $('#game-shell').classList.toggle('is-running',g.phase==='march'&&!g.paused);
 const key=[g.phase,g.index,g.outcome].join(':');if(key!==lastKey){renderPanel();lastKey=key;}
 if(lastTroops!==g.troops){$('#troop-count').classList.remove('bump');void $('#troop-count').offsetWidth;$('#troop-count').classList.add('bump');lastTroops=g.troops;}
 lastShield=g.shield;
 ($('#pause') as HTMLButtonElement).disabled=['ready','result'].includes(g.phase);
}
function closeModal(){ $('#modal').hidden=true;game.paused=false;modalReturnFocus?.focus(); }
function openModal(html:string){modalReturnFocus=document.activeElement as HTMLElement;game.paused=true;$('#modal .modal').innerHTML=html;$('#modal').hidden=false;$('#modal button')?.focus();}
$('#panel').addEventListener('click',e=>{
 const target=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target)return;
 if(target.dataset.answer!==undefined){if(game.answer(Number(target.dataset.answer))){sound(game.summary!.ok);if(!game.summary!.ok)toast('敌军增援 +10');sync();}}
 else if(target.dataset.action==='start'){game.start();sound(true);sync();}
 else if(target.dataset.action==='restart'){game.reset();game.start();sync();}
 else if(target.dataset.action==='review'){
   const rows=game.history.filter((h:any)=>!h.correct).map((h:any)=>{const q=questions.find(q=>q.id===h.id)!;return `<article class="review-item"><strong>${q.prompt}</strong><small class="negative">你的答案：${q.options[h.selected]}</small><small class="positive">正确答案：${q.options[q.answer]}</small><p>${q.explanation}</p></article>`;}).join('');
   openModal(`<h2 id="modal-title">错题补给站</h2><div class="review-list">${rows}</div><button class="primary" data-close>记住了，继续加油 <span>✓</span></button>`);
 }
});
$('#pause').addEventListener('click',()=>openModal(`<div class="eyebrow">休整一下</div><h2 id="modal-title">冲锋已暂停</h2><p>你的队伍会在这里等你。</p><button class="primary" data-close>继续冲锋 <span>→</span></button><button class="secondary" id="restart-modal">重新开始本局</button>`));
$('#help').addEventListener('click',()=>openModal(`<div class="eyebrow">一分钟了解玩法</div><h2 id="modal-title">用知识，壮大蓝军。</h2><div class="help-lines"><p><b>01　慢跑答题，冲过奖励屏障</b>读题时安全慢跑，选完答案加速。答对后穿过半透明屏障，才会增兵、翻倍或获得护盾。</p><p><b>02　看清队伍变化</b>屏障标明奖励，穿过时小兵汇入队伍，人数显示前后变化。护盾先抵消损耗。</p><p><b>03　自动连闯到城堡</b>不需要点击出发或继续。六道防线后自动攻城，局末可回顾错题。</p></div><p class="subtle">读题不限时，不作答不会进入战斗。鼠标、触屏或键盘均可操作。</p><button class="primary" data-close>明白了 <span>✓</span></button><a class="license" href="${import.meta.env.BASE_URL}KENNEY-LICENSE.txt" target="_blank" rel="noopener">城堡素材：Kenney · CC0</a>`));
$('#modal').addEventListener('click',e=>{const el=e.target as HTMLElement;if(el.closest('[data-close]')||el.id==='modal')closeModal();if(el.id==='restart-modal'){closeModal();game.reset();game.start();sync();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal();if(e.key==='Tab'&&!$('#modal').hidden){const items=[...document.querySelectorAll<HTMLElement>('#modal button,#modal a')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
$('#sound').addEventListener('click',()=>{muted=!muted;$('#sound').classList.toggle('on',!muted);$('#sound').setAttribute('aria-pressed',String(!muted));$('#sound').setAttribute('aria-label',muted?'开启声音':'关闭声音');$('#sound').title=muted?'开启声音':'关闭声音';sound(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!['ready','result'].includes(game.phase)&&$('#modal').hidden)$('#pause').click();});
window.addEventListener('game-context-lost',()=>{openModal(`<h2 id="modal-title">画面暂时中断</h2><p>浏览器的图形连接已中断，请刷新页面重新集结。</p><button class="primary" onclick="location.reload()">刷新游戏</button>`);});
async function boot(){
 try{
   world=new World($('#world'),game);sync();
   let last=performance.now();const loop=(now:number)=>{const dt=Math.min((now-last)/1000,.05);last=now;game.tick(dt);sync();world.update(dt);requestAnimationFrame(loop);};requestAnimationFrame(loop);
   await world.load();$('#loading').hidden=true;
   // Read-only diagnostics for reproducible QA; no gameplay mutation shortcuts.
   (window as any).__gameDebug=()=>({phase:game.phase,index:game.index,troops:game.troops,shield:game.shield,correct:game.correct,paused:game.paused,outcome:game.outcome,distance:game.distance,jogDistance:game.jogDistance,worldDistance:game.worldDistance,speed:game.speed,stride:world.strideTime,gateCrossed:game.gateCrossed,rewardSequence:game.rewardSequence,gateReward:game.gateReward,gateOpacity:(world.gateMembrane.material as any).opacity,routeDistance:ROUTE_DISTANCE,cameraZ:world.camera.position.z,towerZ:world.tower.position.z,modelsLoaded:world.modelsLoaded,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles});
 }catch(e){console.error(e);$('#loading').innerHTML=`<strong>暂时无法进入战场</strong><span>请确认浏览器支持 WebGL，并检查网络后重试。</span><button class="primary" onclick="location.reload()">重新加载</button>`;}
}
void boot();
