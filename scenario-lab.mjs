import {
  ARM_DEFLECT_TU,
  MOVES,
  PARRY,
  STEP,
  createMatch,
  currentDefense,
  deflectionRemaining,
  gloveLocal,
  parryStatus,
  pauseMatch,
  requestAttack,
  requestDefense,
  startMatch,
  tick,
} from './core.mjs?v=0.13';

export const LAB_CASES=Object.freeze([
  Object.freeze({
    id:'jab-right-parry',number:'01',title:'相手の左ジャブ × 右手パーリング',
    question:'ジャブが見えてから、右手を真上から小さく落として進行70%付近の拳を下へ外せるか。',
    defense:'右手パーリング',defenseAt:3,
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','ジャブの軌道が見える2.7 TU後まで待つ','開始3.0 TUで右手パーリング','拳の進行69〜72%付近で接触','他の入力なし']),
    expected:'右手は内側へ入れず、ガード位置の真上から小さく落とす。相手の左拳は自分へ進みながら下へ外れ、ダメージ0。相手の左腕だけが4 TU使用不能。',
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

function completeChecks(run){
  const {state,definition,impact}=run,event=impact?.event;
  if(definition.id==='jab-right-parry')return [
    {label:'ジャブが見えてから入力し、進行70%付近で接触',pass:run.defenseIssuedAt>MOVES.jab.cue&&event?.type==='block'&&event?.defense==='parry'&&Math.abs(event.punchProgress-PARRY.contactProgress)<=PARRY.progressTolerance},
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
  return {definition,caseIndex,state,status:'running',defenseIssued:false,defenseIssuedAt:null,parryStart:null,tapStart:null,impact:null,rebound:null,checks:[]};
}

export function advanceLabRun(run,dt=STEP){
  if(run.status!=='running')return run;
  const previousEventId=run.state.eventId;
  tick(run.state,dt,{cpuEnabled:false});
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
  return {phase:'attack',label:'相手の左ジャブが始動'};
}

export function runLabToCompletion(caseIndex,maxTime=20){
  const run=createLabRun(caseIndex);
  for(let elapsed=0;elapsed<maxTime&&run.status==='running';elapsed+=STEP)advanceLabRun(run,STEP);
  return run;
}
