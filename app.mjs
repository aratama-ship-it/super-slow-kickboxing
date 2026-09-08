import {createMatch,startMatch,pauseMatch,tick,STEP,MOVES,DEFENSES,distance,currentDefense,requestAttack,requestDefense,requestFeint,requestStep,requestSlip,attackStatus} from './core.mjs?v=0.5';
import {KEY_BINDINGS,DEFAULT_KEYMAP,normalizeKeymap,assignKey,keyLabel,isAssignableKey} from './keymap.mjs?v=0.5';
const $=id=>document.getElementById(id);
let state=createMatch(),target='head',view=null,lastFrame=0,accumulator=0,lastUi=-1,lastEvent=0,dirty=true;
let pauseReason='再開すると、同じ姿勢から続きます。';
const KEY_STORAGE='super-slow-boxing.keymap.v2';
let keyMap=loadSavedKeys(),listeningAction=null;
const actionButtons=[...document.querySelectorAll('[data-attack],[data-defense],[data-step],[data-slip],#feint')];
function applyResult(r){$('input-feedback').textContent=r.message;dirty=true;updateUI();}
function loadSavedKeys(){
  try{return normalizeKeymap(localStorage.getItem(KEY_STORAGE));}catch{return {...DEFAULT_KEYMAP};}
}
function persistKeys(){
  try{localStorage.setItem(KEY_STORAGE,JSON.stringify(keyMap));return true;}catch{return false;}
}
function bindingById(id){return KEY_BINDINGS.find(action=>action.id===id);}
function setKeyStatus(message){$('key-status').textContent=message;}
function refreshKeyLabels(){
  for(const action of KEY_BINDINGS){
    const label=keyLabel(keyMap[action.id]);
    const control=document.querySelector(action.selector)?.querySelector('kbd');
    if(control)control.textContent=label;
    const editor=document.querySelector(`[data-key-bind="${action.id}"]`);
    if(editor){
      const recording=listeningAction===action.id;
      editor.setAttribute('aria-pressed',String(recording));editor.classList.toggle('recording',recording);
      editor.querySelector('kbd').textContent=recording?'キーを押す…':label;
    }
  }
}
function buildKeySettings(){
  const grid=$('key-grid');
  for(const groupName of [...new Set(KEY_BINDINGS.map(action=>action.group))]){
    const group=document.createElement('section');group.className='key-map-group';
    const title=document.createElement('h3');title.textContent=groupName;group.append(title);
    const list=document.createElement('div');list.className='key-map-list';group.append(list);
    for(const action of KEY_BINDINGS.filter(item=>item.group===groupName)){
      const row=document.createElement('div');row.className='key-map-row';
      const label=document.createElement('span');label.textContent=action.label;
      const button=document.createElement('button');button.type='button';button.dataset.keyBind=action.id;button.setAttribute('aria-label',action.label+'のキーを変更');
      const key=document.createElement('kbd');button.append(key);button.addEventListener('click',()=>{
        listeningAction=listeningAction===action.id?null:action.id;
        setKeyStatus(listeningAction?action.label+'に割り当てるキーを押してください。Escで中止できます。':'キーの登録を中止しました。');
        refreshKeyLabels();
      });
      row.append(label,button);list.append(row);
    }
    grid.append(group);
  }
  refreshKeyLabels();
}
function setKeySettingsOpen(open){
  $('key-settings').hidden=!open;$('key-settings-toggle').setAttribute('aria-expanded',String(open));
  if(open){
    if(!$('help').hidden){$('help').hidden=true;$('help-toggle').setAttribute('aria-expanded','false');}
    pause('キー設定を確認中です。再開すると同じ姿勢から続きます。');
  }else if(listeningAction){listeningAction=null;setKeyStatus('キーの登録を中止しました。');refreshKeyLabels();}
}
function restoreDefaultKeys(){
  keyMap={...DEFAULT_KEYMAP};listeningAction=null;
  let saved=true;try{localStorage.removeItem(KEY_STORAGE);}catch{saved=false;}
  setKeyStatus(saved?'初期設定へ戻しました。':'初期設定へ戻しました。このタブを閉じるまで有効です。');refreshKeyLabels();
}
function runKeyAction(action){
  if(action.kind==='attack')applyResult(requestAttack(state,0,action.value,target));
  else if(action.kind==='defense')applyResult(requestDefense(state,0,action.side,action.value));
  else if(action.kind==='step')applyResult(requestStep(state,0,action.value));
  else if(action.kind==='slip')applyResult(requestSlip(state,0,action.value));
  else if(action.kind==='feint')applyResult(requestFeint(state,0));
  else if(action.kind==='pause')togglePause();
}
function captureKey(e){
  e.preventDefault();e.stopPropagation();
  if(e.repeat)return;
  if(e.code==='Escape'){
    listeningAction=null;setKeyStatus('キーの登録を中止しました。');refreshKeyLabels();return;
  }
  if(!isAssignableKey(e.code)){
    setKeyStatus('そのキーは登録できません。文字・数字・矢印など、単独の操作キーを押してください。');return;
  }
  const action=bindingById(listeningAction),result=assignKey(keyMap,listeningAction,e.code);keyMap=result.map;
  const swapped=result.swappedActionId?bindingById(result.swappedActionId):null,saved=persistKeys();
  let message=action.label+'を '+keyLabel(e.code)+' に変更しました。';
  if(swapped)message+=' '+swapped.label+'は '+keyLabel(result.previousCode)+' に入れ替えました。';
  if(!saved)message+=' このタブを閉じるまで有効です。';
  listeningAction=null;setKeyStatus(message);refreshKeyLabels();
}
function reset(){state=createMatch({mode:$('mode').value,seed:Date.now()>>>0});accumulator=0;lastEvent=0;lastUi=-1;$('input-feedback').textContent='開始して、攻撃や守りを選んでください。';$('hit-feedback').textContent='命中・防御の理由をここに表示します。';$('hit-feedback').removeAttribute('data-impact');dirty=true;updateUI();}
function pause(reason){if(state.phase==='running'){pauseMatch(state);pauseReason=reason||'再開すると、同じ姿勢から続きます。';accumulator=0;dirty=true;updateUI();}}
function togglePause(){if(state.phase==='running')pause();else if(state.phase==='paused')resume();}
function resume(){if(!view)return;startMatch(state);lastFrame=performance.now();accumulator=0;$('input-feedback').textContent='守りを先に置き、相手の動きを見てみてください。';dirty=true;updateUI();}
function selectTarget(next){target=next;document.querySelectorAll('[data-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.target===target)));dirty=true;}
document.querySelectorAll('[data-attack]').forEach(b=>b.addEventListener('click',()=>applyResult(requestAttack(state,0,b.dataset.attack,target))));
document.querySelectorAll('[data-defense]').forEach(b=>b.addEventListener('click',()=>applyResult(requestDefense(state,0,b.dataset.defenseSide,b.dataset.defense))));
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>applyResult(requestStep(state,0,b.dataset.step))));
document.querySelectorAll('[data-slip]').forEach(b=>b.addEventListener('click',()=>applyResult(requestSlip(state,0,b.dataset.slip))));
document.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',()=>selectTarget(b.dataset.target)));
$('feint').addEventListener('click',()=>applyResult(requestFeint(state,0)));
$('clear-queue').addEventListener('click',()=>{state.fighters[0].queue=null;applyResult({message:'予約を消しました'});});
$('start').addEventListener('click',()=>{if(state.phase==='ended')reset();resume();});
$('restart').addEventListener('click',reset);$('pause').addEventListener('click',togglePause);
$('mode').addEventListener('change',reset);
$('speed').addEventListener('change',()=>{accumulator=0;dirty=true;updateUI();});
$('help-toggle').addEventListener('click',()=>{const open=$('help').hidden;if(open)setKeySettingsOpen(false);$('help').hidden=!open;$('help-toggle').setAttribute('aria-expanded',String(open));if(open)pause('遊び方を確認中です。再開すると同じ姿勢から続きます。');});
$('key-settings-toggle').addEventListener('click',()=>setKeySettingsOpen($('key-settings').hidden));
$('key-settings-close').addEventListener('click',()=>setKeySettingsOpen(false));
$('key-reset').addEventListener('click',restoreDefaultKeys);
document.addEventListener('keydown',e=>{
  if(listeningAction){captureKey(e);return;}
  const tag=e.target?.tagName;
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.isComposing||['INPUT','SELECT','TEXTAREA'].includes(tag))return;
  const action=KEY_BINDINGS.find(item=>keyMap[item.id]===e.code);if(!action)return;
  if(['BUTTON','A'].includes(tag)&&['Space','Enter'].includes(e.code))return;
  e.preventDefault();runKeyAction(action);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('画面を離れたため、一時停止しました。');});
window.addEventListener('blur',()=>pause('別のウインドウへ移ったため、一時停止しました。'));
function handState(f,side){
  if(f.attack&&MOVES[f.attack.id].side===side)return attackStatus(f).name;
  const hand=f.defense[side];
  if(hand.t<3)return DEFENSES[hand.to]+'へ移動中';
  return DEFENSES[currentDefense(f,side)];
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
  document.querySelectorAll('[data-defense]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.defense===p.defense[b.dataset.defenseSide].to)));
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
    $('overlay-description').textContent=$('mode').value==='dummy'?'動かない相手で、パンチの射程と左右の守りを確認できます。画面の相手を見ながら技を選んでください。':'左右の手を先に置いてジャブに備え、相手が顔を固めたら胴へ。相手が片手で打ち始めたら、その手が守れない間を狙ってみます。';
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
  try{const {createView}=await import('./view.mjs?v=0.5');view=createView($('stage'));view.render(state);updateUI();}
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
  window.__boxingTest={snapshot:()=>structuredClone(state),keymap:()=>({...keyMap}),advance(t,cpuEnabled=false){for(let n=0;n<Math.round(t/STEP);n++)tick(state,STEP,{cpuEnabled});updateUI();if(view)view.render(state);},reset(options){state=createMatch(options);lastEvent=0;updateUI();if(view)view.render(state);},ready:()=>!!view};
}
buildKeySettings();updateUI();boot();
