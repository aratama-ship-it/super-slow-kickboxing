import {createMatch,startMatch,pauseMatch,tick,STEP,MOVES,GUARDS,distance,currentGuard,requestAttack,requestGuard,requestFeint,requestStep,requestSlip,attackStatus} from './core.mjs';
const $=id=>document.getElementById(id);
let state=createMatch(),target='head',view=null,lastFrame=0,accumulator=0,lastUi=-1,lastEvent=0,dirty=true;
let pauseReason='再開すると、同じ姿勢から続きます。';
const actionButtons=[...document.querySelectorAll('[data-attack],[data-guard],[data-step],[data-slip],#feint')];
function applyResult(r){$('input-feedback').textContent=r.message;dirty=true;updateUI();}
function reset(){state=createMatch({mode:$('mode').value,seed:Date.now()>>>0});accumulator=0;lastEvent=0;lastUi=-1;$('input-feedback').textContent='開始して、攻撃や守りを選んでください。';$('hit-feedback').textContent='命中・防御の理由をここに表示します。';$('hit-feedback').removeAttribute('data-impact');dirty=true;updateUI();}
function pause(reason){if(state.phase==='running'){pauseMatch(state);pauseReason=reason||'再開すると、同じ姿勢から続きます。';accumulator=0;dirty=true;updateUI();}}
function togglePause(){if(state.phase==='running')pause();else if(state.phase==='paused')resume();}
function resume(){if(!view)return;startMatch(state);lastFrame=performance.now();accumulator=0;$('input-feedback').textContent='守りを先に置き、相手の動きを見てみてください。';dirty=true;updateUI();}
function selectTarget(next){target=next;document.querySelectorAll('[data-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.target===target)));dirty=true;}
document.querySelectorAll('[data-attack]').forEach(b=>b.addEventListener('click',()=>applyResult(requestAttack(state,0,b.dataset.attack,target))));
document.querySelectorAll('[data-guard]').forEach(b=>b.addEventListener('click',()=>applyResult(requestGuard(state,0,b.dataset.guard))));
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>applyResult(requestStep(state,0,b.dataset.step))));
document.querySelectorAll('[data-slip]').forEach(b=>b.addEventListener('click',()=>applyResult(requestSlip(state,0,b.dataset.slip))));
document.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',()=>selectTarget(b.dataset.target)));
$('feint').addEventListener('click',()=>applyResult(requestFeint(state,0)));
$('clear-queue').addEventListener('click',()=>{state.fighters[0].queue=null;applyResult({message:'予約を消しました'});});
$('start').addEventListener('click',()=>{if(state.phase==='ended')reset();resume();});
$('restart').addEventListener('click',reset);$('pause').addEventListener('click',togglePause);
$('mode').addEventListener('change',reset);
$('speed').addEventListener('change',()=>{accumulator=0;dirty=true;updateUI();});
$('help-toggle').addEventListener('click',()=>{const open=$('help').hidden;$('help').hidden=!open;$('help-toggle').setAttribute('aria-expanded',String(open));if(open)pause('遊び方を確認中です。再開すると同じ姿勢から続きます。');});
const attackKeys={KeyJ:'jab',KeyK:'cross',KeyU:'hookL',KeyI:'hookR',KeyN:'upperL',KeyM:'upperR'};
document.addEventListener('keydown',e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.isComposing||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.code==='Space'){if(['BUTTON','A'].includes(e.target.tagName))return;e.preventDefault();togglePause();return;}
  if(attackKeys[e.code]){e.preventDefault();applyResult(requestAttack(state,0,attackKeys[e.code],target));}
  else if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code)){e.preventDefault();applyResult(requestGuard(state,0,['high','shell','body','open'][Number(e.code.slice(-1))-1]));}
  else if(e.code==='KeyF'){e.preventDefault();applyResult(requestFeint(state,0));}
  else if(['KeyW','KeyS'].includes(e.code)){e.preventDefault();applyResult(requestStep(state,0,e.code==='KeyW'?'in':'out'));}
  else if(['KeyA','KeyD'].includes(e.code)){e.preventDefault();applyResult(requestSlip(state,0,e.code==='KeyA'?'L':'R'));}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('画面を離れたため、一時停止しました。');});
window.addEventListener('blur',()=>pause('別のウインドウへ移ったため、一時停止しました。'));
function handState(f,side){
  if(f.attack&&MOVES[f.attack.id].side===side)return attackStatus(f).name;
  if(f.guard.t<3)return GUARDS[f.guard.to]+'へ移動中';
  return GUARDS[currentGuard(f)];
}
function updateUI(){
  const [p,cpu]=state.fighters;
  $('player-hp').value=p.hp;$('cpu-hp').value=cpu.hp;$('player-hp-label').textContent=Math.ceil(p.hp);$('cpu-hp-label').textContent=Math.ceil(cpu.hp);
  $('stamina').value=p.stamina;$('stamina-label').textContent=Math.round(p.stamina);
  const seconds=Math.max(0,Math.ceil((state.duration-state.time)*.1/Number($('speed').value)));
  $('clock').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$('clock-kind').textContent='いまの速度での残り時間';
  const d=distance(state);$('distance').textContent=d>1.65?'遠い間合い':d<1.12?'近い間合い':'パンチの間合い';
  $('left-state').textContent=handState(p,'L');$('right-state').textContent=handState(p,'R');
  $('queue').textContent=p.queue?MOVES[p.queue.id].name+' → '+(p.queue.target==='head'?'頭':'胴'):'予約なし';
  $('clear-queue').disabled=!p.queue||state.phase!=='running';
  document.querySelectorAll('[data-guard]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guard===p.guard.to)));
  actionButtons.forEach(b=>b.disabled=state.phase!=='running');
  const a=p.attack,m=a?MOVES[a.id]:null;
  $('feint-window').textContent=!a?'打ち始めの区間だけ引き返せます。':a.feint?'引いています。次の技は戻ってから。':a.t<m.cancel*(a.wind/m.wind)?'いまは「引く」を選べます。':'打ち切る区間です。戻りを待ちます。';
  $('pause').disabled=!['running','paused'].includes(state.phase);$('pause').firstChild.textContent=state.phase==='paused'?'再開 ':'一時停止 ';
  const newest=state.events.at(-1);
  if(newest&&newest.id!==lastEvent){
    lastEvent=newest.id;const who=newest.who===0?'あなた':'CPU';
    $('hit-feedback').textContent=who+'の'+MOVES[newest.move].name+'：'+newest.reason+(newest.damage?'（'+newest.damage+'ダメージ）':'');
    $('hit-feedback').dataset.impact=newest.type;
  }
  $('overlay').hidden=state.phase==='running';
  if(state.phase==='ready'){
    $('overlay-tag').textContent='まずは、守りを先に置く。';$('overlay-title').textContent='相手の戻りを狙ってみる';
    $('overlay-description').textContent=$('mode').value==='dummy'?'動かない相手で、パンチの射程とガードを確認できます。画面の相手を見ながら技を選んでください。':'前を守ってジャブに備え、相手が頭を固めたら胴へ。相手が大きく打ち始めたら、空く側を早いパンチで狙ってみます。';
    if(view){$('start').textContent='ラウンドを始める';$('start').disabled=false;}
  }else if(state.phase==='paused'){
    $('overlay-tag').textContent='CPU練習 / 一時停止';$('overlay-title').textContent='ここから考え直せます';$('overlay-description').textContent=pauseReason;$('start').textContent='ラウンドを再開する';
  }else if(state.phase==='ended'){
    $('overlay-tag').textContent=p.hp<=0||cpu.hp<=0?'ラウンド終了 / KO':'ラウンド終了 / 時間切れ';
    $('overlay-title').textContent=state.winner==='draw'?'引き分け':state.winner===0?'あなたの勝ち':'CPUの勝ち';
    $('overlay-description').textContent='あなたの有効打 '+p.stats.hits+'回 / 防いだ攻撃 '+p.stats.blocks+'回 / 与えたダメージ '+p.stats.damage+'。技が当たった理由を振り返り、もう一度試せます。';
    $('start').textContent='もう1ラウンド';
  }
}
async function boot(){
  try{const {createView}=await import('./view.mjs');view=createView($('stage'));view.render(state);updateUI();}
  catch(error){$('load-error').hidden=false;$('load-error').textContent='3D画面を起動できませんでした。WebGLに対応したブラウザで、このページを開き直してください。';$('start').textContent='3Dの起動に失敗';console.error(error);}
  requestAnimationFrame(frame);
}
function frame(now){
  const delta=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
  if(state.phase==='running'){
    accumulator+=delta*(Number($('speed').value)/.1);
    while(accumulator>=STEP){tick(state,STEP);accumulator-=STEP;}
    dirty=true;
  }
  if(dirty){if(view)view.render(state);if(now-lastUi>100||state.phase!=='running'){updateUI();lastUi=now;}dirty=false;}
  requestAnimationFrame(frame);
}
if(new URLSearchParams(location.search).has('test')){
  window.__boxingTest={snapshot:()=>structuredClone(state),advance(t,cpuEnabled=false){for(let n=0;n<Math.round(t/STEP);n++)tick(state,STEP,{cpuEnabled});updateUI();if(view)view.render(state);},reset(options){state=createMatch(options);lastEvent=0;updateUI();if(view)view.render(state);},ready:()=>!!view};
}
updateUI();boot();
