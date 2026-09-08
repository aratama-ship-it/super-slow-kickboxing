import {
  ARM_DEFLECT_TU,
  MOVES,
  PARRY,
  STEP,
  createMatch,
  currentDefense,
  deflectionRemaining,
  gloveLocal,
  visualGloveLocal,
  leadFootMotion,
  punchTravelProgress,
  parryStatus,
  pauseMatch,
  requestAttack,
  requestDefense,
  startMatch,
  tick,
} from './core.mjs?v=0.16';

export const LAB_CASES=Object.freeze([
  Object.freeze({
    id:'jab-right-parry',number:'01',title:'相手の左ジャブ × 右手パーリング',
    question:'両手の小さい動きに予備動作を紛れさせ、左拳と左前足を同時に進めて、進行80%付近の拳を右手で下へ外せるか。',
    defense:'右手パーリング',defenseAt:3,
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','開始から2.7 TUまでは両手の小動作だけ','2.7 TUの同じ固定tickで左拳と左前足が前進開始','開始3.0 TUで右手パーリング','拳の進行80〜82.5%で接触','他の入力なし']),
    expected:'左右の拳は構え中から小さく動き続け、ジャブ固有の引き動作を見せない。2.7 TUから左拳と左前足が同時に前へ出る。右手は内側へ入れず、ガード位置の真上から小さく落とす。相手の左拳は自分へ進みながら下へ外れ、ダメージ0。相手の左腕だけが4 TU使用不能。',
  }),
  Object.freeze({
    id:'jab-right-block',number:'02',title:'相手の左ジャブ × 右手ブロッキング',
    question:'受け止めたとき、どちらの腕も弾かれず、ジャブ側は通常の戻りへ進むか。',
    defense:'右手ブロッキング',defenseAt:null,
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','右手ブロッキングを先置き','他の入力なし']),
    expected:'仮ダメージ1。両者とも弾かれず、相手の左腕はジャブの通常の戻りへ進む。',
  }),
]);

const captureImpact=(state,event)=>({
  time:state.time,
  event:{...event},
  playerHp:state.fighters[0].hp,
  attackerLeftDeflection:deflectionRemaining(state.fighters[1],'L'),
  defenderRightDeflection:deflectionRemaining(state.fighters[0],'R'),
  defenderRightParry:parryStatus(state.fighters[0],'R')?.phase||null,
  attackerLeftGlove:gloveLocal(state.fighters[1],'L').slice(),
  attackerLeadFoot:leadFootMotion(state.fighters[1]),
  defenderRightGlove:gloveLocal(state.fighters[0],'R').slice(),
});

const captureRebound=(state,impact)=>{
  const glove=gloveLocal(state.fighters[1],'L').slice();
  return {
    time:state.time,attackerLeftGlove:glove,
    forward:glove[2]-impact.attackerLeftGlove[2],
    downward:impact.attackerLeftGlove[1]-glove[1],
  };
};

const motionRange=()=>({min:null,max:null,range:0});
function sampleMotion(tracker,pose){
  if(!tracker.min){tracker.min=pose.slice();tracker.max=pose.slice();return;}
  for(let i=0;i<3;i++){tracker.min[i]=Math.min(tracker.min[i],pose[i]);tracker.max[i]=Math.max(tracker.max[i],pose[i]);}
  tracker.range=Math.hypot(...tracker.max.map((v,i)=>v-tracker.min[i]));
}

function completeChecks(run){
  const {state,definition,impact}=run,event=impact?.event;
  if(definition.id==='jab-right-parry')return [
    {label:'ジャブが出る前も左右の拳が小さく動き続けた',pass:run.preCueMotion.samples>=120&&run.preCueMotion.L.range>=.02&&run.preCueMotion.R.range>=.02},
    {label:'左拳と左前足が同じ固定tickで前進を開始',pass:run.punchStartAt!==null&&run.leadFootStartAt!==null&&Math.abs(run.punchStartAt-run.leadFootStartAt)<STEP/2},
    {label:'ジャブの進行80%到達後に接触',pass:run.defenseIssuedAt>MOVES.jab.cue&&run.leadFootPeak>=.075&&event?.type==='block'&&event?.defense==='parry'&&event.punchProgress>=PARRY.contactProgress.jab&&event.punchProgress<=PARRY.contactProgress.jab+PARRY.progressTolerance},
    {label:'右手を内側へ入れず、真上から小さく下ろした',pass:run.parryStart&&run.tapStart&&impact.defenderRightParry==='tap'&&run.tapStart[1]-run.parryStart[1]>=.04&&run.tapStart[1]-run.parryStart[1]<=.07&&run.tapStart[1]-impact.defenderRightGlove[1]>=.04&&run.tapStart[1]-impact.defenderRightGlove[1]<=.08&&Math.abs(run.parryStart[0]-run.tapStart[0])<.01&&Math.abs(run.tapStart[0]-impact.defenderRightGlove[0])<.01},
    {label:'自分はダメージ0、右腕は弾かれない',pass:event?.damage===0&&impact.playerHp===100&&impact.defenderRightDeflection===0},
    {label:'相手の左拳だけが前進しながら下へ弾かれた',pass:impact.attackerLeftDeflection>ARM_DEFLECT_TU-.2&&run.rebound?.forward>=PARRY.deflectForward-.02&&run.rebound?.downward>=PARRY.deflectDrop-.02},
    {label:'両者の該当腕が規定の動作を終えて復帰',pass:deflectionRemaining(state.fighters[1],'L')===0&&!parryStatus(state.fighters[0],'R')&&currentDefense(state.fighters[0],'R')==='block'},
  ];
  return [
    {label:'右手ブロッキングで接触',pass:event?.type==='block'&&event?.defense==='block'},
    {label:'仮ダメージは1',pass:event?.damage===1&&impact.playerHp===99},
    {label:'相手の左腕は弾かれない',pass:impact.attackerLeftDeflection===0},
    {label:'自分の右腕も弾かれない',pass:impact.defenderRightDeflection===0},
    {label:'相手のジャブが通常の戻りを完了',pass:state.fighters[1].attack===null&&currentDefense(state.fighters[0],'R')==='block'},
  ];
}

export function createLabRun(caseIndex=0){
  const definition=LAB_CASES[caseIndex];
  if(!definition)throw new RangeError('Unknown lab case');
  const state=createMatch({mode:'dummy',seed:31001+caseIndex,duration:30});
  startMatch(state);
  const started=requestAttack(state,1,'jab','head');
  if(!started.ok)throw new Error(started.message);
  return {definition,caseIndex,state,status:'running',defenseIssued:false,defenseIssuedAt:null,parryStart:null,tapStart:null,preCueMotion:{samples:0,L:motionRange(),R:motionRange()},punchStartAt:null,leadFootStartAt:null,leadFootPeak:0,impact:null,rebound:null,checks:[]};
}

export function advanceLabRun(run,dt=STEP){
  if(run.status!=='running')return run;
  const previousEventId=run.state.eventId;
  tick(run.state,dt,{cpuEnabled:false});
  const attacker=run.state.fighters[1],foot=leadFootMotion(attacker),punchProgress=punchTravelProgress(attacker);
  if(attacker.attack?.t<MOVES.jab.cue){
    sampleMotion(run.preCueMotion.L,visualGloveLocal(attacker,'L',run.state.time));sampleMotion(run.preCueMotion.R,visualGloveLocal(attacker,'R',run.state.time));run.preCueMotion.samples++;
  }
  if(punchProgress>0&&run.punchStartAt===null)run.punchStartAt=run.state.time;
  if(foot.forward>0&&run.leadFootStartAt===null)run.leadFootStartAt=run.state.time;
  run.leadFootPeak=Math.max(run.leadFootPeak,foot.forward);
  if(run.definition.defenseAt!==null&&!run.defenseIssued&&run.state.time>=run.definition.defenseAt){
    run.parryStart=gloveLocal(run.state.fighters[0],'R').slice();
    const defense=requestDefense(run.state,0,'R','parry');
    if(!defense.ok)throw new Error(defense.message);
    run.defenseIssued=true;
    run.defenseIssuedAt=run.state.time;
  }
  if(!run.tapStart&&parryStatus(run.state.fighters[0],'R')?.phase==='tap')run.tapStart=gloveLocal(run.state.fighters[0],'R').slice();
  if(!run.impact&&run.state.eventId>previousEventId){
    const event=run.state.events.at(-1);
    run.impact=captureImpact(run.state,event);
  }
  if(!run.impact)return run;
  if(!run.rebound&&run.definition.id==='jab-right-parry'&&run.state.fighters[1].deflection.L?.t>=PARRY.deflectPeak)run.rebound=captureRebound(run.state,run.impact);
  const recovered=run.definition.id==='jab-right-parry'
    ? deflectionRemaining(run.state.fighters[1],'L')===0&&!parryStatus(run.state.fighters[0],'R')
    : run.state.fighters[1].attack===null;
  if(recovered){
    run.status='complete';
    run.checks=completeChecks(run);
    pauseMatch(run.state);
  }
  return run;
}

export function labProgress(run){
  if(!run)return {phase:'ready',label:'再生前'};
  if(run.status==='complete')return {phase:'complete',label:'復帰まで確認'};
  if(run.impact){
    const remaining=run.definition.id==='jab-right-parry'?deflectionRemaining(run.state.fighters[1],'L'):0;
    return {phase:'rebound',label:remaining>0?(run.rebound?'相手の左拳が前進しながら下へ弾かれ中 ':'相手の左拳を下へ弾いている ')+remaining.toFixed(1)+' TU':'復帰を確認中'};
  }
  if(run.definition.defenseAt!==null&&run.defenseIssued){
    const parry=parryStatus(run.state.fighters[0],'R');
    return {phase:'defense',label:parry?.phase==='prepare'?'右手を少し上へ準備中':parry?.phase==='tap'?'右手を上から小さく落としている':'接触を確認中'};
  }
  const attack=run.state.fighters[1].attack;
  return {phase:'attack',label:attack?.t<MOVES.jab.cue?'相手の両手が小さく動き続けている':'相手の左拳と左前足が同時に前進'};
}

export function runLabToCompletion(caseIndex,maxTime=20){
  const run=createLabRun(caseIndex);
  for(let elapsed=0;elapsed<maxTime&&run.status==='running';elapsed+=STEP)advanceLabRun(run,STEP);
  return run;
}
