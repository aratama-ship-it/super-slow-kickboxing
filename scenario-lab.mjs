import {
  ARM_DEFLECT_TU,
  STEP,
  createMatch,
  currentDefense,
  deflectionRemaining,
  parryStatus,
  pauseMatch,
  requestAttack,
  requestDefense,
  startMatch,
  tick,
} from './core.mjs?v=0.11';

export const LAB_CASES=Object.freeze([
  Object.freeze({
    id:'jab-right-parry',number:'01',title:'相手の左ジャブ × 右手パーリング',
    question:'払ったとき、相手の左腕だけが4 TU弾かれ、自分の右手は払いの動作を終えて戻るか。',
    defense:'右手パーリング',defenseAt:1,
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','ジャブ開始1.0 TU後に右手パーリング','他の入力なし']),
    expected:'ダメージ0。相手の左腕だけが4 TU使用不能。自分の右手は弾かれず、払いから戻るまで別の動作を始めない。',
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
  event:{...event},
  playerHp:state.fighters[0].hp,
  attackerLeftDeflection:deflectionRemaining(state.fighters[1],'L'),
  defenderRightDeflection:deflectionRemaining(state.fighters[0],'R'),
  defenderRightParry:parryStatus(state.fighters[0],'R')?.phase||null,
});

function completeChecks(run){
  const {state,definition,impact}=run,event=impact?.event;
  if(definition.id==='jab-right-parry')return [
    {label:'右手パーリングが接触',pass:event?.type==='block'&&event?.defense==='parry'},
    {label:'自分のダメージは0',pass:event?.damage===0&&impact.playerHp===100},
    {label:'相手の左腕だけが4 TU弾かれた',pass:impact.attackerLeftDeflection>ARM_DEFLECT_TU-.2&&impact.defenderRightDeflection===0},
    {label:'自分の右手は弾かれず、払い動作を続けた',pass:['sweep','return'].includes(impact.defenderRightParry)&&impact.defenderRightDeflection===0},
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
  return {definition,caseIndex,state,status:'running',defenseIssued:false,impact:null,checks:[]};
}

export function advanceLabRun(run,dt=STEP){
  if(run.status!=='running')return run;
  const previousEventId=run.state.eventId;
  tick(run.state,dt,{cpuEnabled:false});
  if(run.definition.defenseAt!==null&&!run.defenseIssued&&run.state.time>=run.definition.defenseAt){
    const defense=requestDefense(run.state,0,'R','parry');
    if(!defense.ok)throw new Error(defense.message);
    run.defenseIssued=true;
  }
  if(!run.impact&&run.state.eventId>previousEventId){
    const event=run.state.events.at(-1);
    run.impact=captureImpact(run.state,event);
  }
  if(!run.impact)return run;
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
    return {phase:'rebound',label:remaining>0?'相手の左腕が弾かれ中 '+remaining.toFixed(1)+' TU':'復帰を確認中'};
  }
  if(run.definition.defenseAt!==null&&run.defenseIssued){
    const parry=parryStatus(run.state.fighters[0],'R');
    return {phase:'defense',label:parry?.phase==='prepare'?'右手の払いを準備中':parry?.phase==='sweep'?'右手で外へ払い中':'接触を確認中'};
  }
  return {phase:'attack',label:'相手の左ジャブが始動'};
}

export function runLabToCompletion(caseIndex,maxTime=20){
  const run=createLabRun(caseIndex);
  for(let elapsed=0;elapsed<maxTime&&run.status==='running';elapsed+=STEP)advanceLabRun(run,STEP);
  return run;
}
