import {
  ARM_DEFLECT_TU,
  HEAD_BLOCK,
  LEFT_BLOCK_TURN,
  MOVES,
  PARRY,
  STEP,
  TARGET_HEIGHT,
  JAB_BODY,
  createMatch,
  currentDefense,
  deflectionRemaining,
  gloveLocal,
  restingGlove,
  clamp,
  visualGloveLocal,
  leadFootMotion,
  jabBodyMotion,
  leftBlockMotion,
  punchTravelProgress,
  parryStatus,
  pauseMatch,
  requestAttack,
  requestDefense,
  startMatch,
  tick,
} from './core.mjs?v=0.45';

export const LAB_CASES=Object.freeze([
  Object.freeze({
    id:'jab-right-parry',number:'01',title:'相手の左ジャブ × 右手パーリング',
    question:'鼻から口の高さへ向かう左ジャブを、両手の小さい動きから左前足・腰・上体と同時に進め、進行80%付近で右手により下へ外せるか。',
    defense:'右手パーリング',defenseAt:3.15,
    conditions:Object.freeze(['パンチの間合い','相手は鼻から口の高さへ左ジャブ','開始から2.7 TUまでは両手の小動作だけ','2.7 TUの同じ固定tickで左拳・左前足・腰・上体が前進開始','腰3.5cm・胸5cm・頭4.5cm・体幹4°を前足と同期','開始3.15 TU・拳が約30%進んでから右手パーリング','拳の進行80〜82.5%で接触','他の入力なし']),
    expected:'左ジャブの拳中心は額より10cm低い顔中央へ向かう。左右の拳は構え中から小さく動き続け、ジャブ固有の引き動作を見せない。2.7 TUから左拳と左前足、腰、胸、頭、肩線が同時に小さく前へ出て、後ろ足は残る。右手は額につけたブロッキング位置から内側へ入れず、真上へ小さく上げて落とす。相手の左拳は自分へ進みながら下へ外れ、ダメージ0。相手の左腕だけが4 TU使用不能。',
  }),
  Object.freeze({
    id:'jab-right-block',number:'02',title:'相手の左ジャブ × 右手ブロッキング',
    question:'受け止めたとき、どちらの腕も弾かれず、ジャブ側は通常の戻りへ進むか。',
    defense:'右手ブロッキング',defenseAt:null,
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','右手ブロッキングを先置き','他の入力なし']),
    expected:'仮ダメージ1。両者とも弾かれず、相手の左腕はジャブの通常の戻りへ進む。',
  }),
  Object.freeze({
    id:'jab-left-block',number:'03',title:'相手の左ジャブ × 左手ブロッキング',
    question:'左手のグローブをジャブの進路に置き、拳を短く止めて打ってきた方向へ戻せるか。',
    defense:'左手ブロッキング＋体の右回旋',viewLabel:'左手 内側へ・体は右回旋',defenseAt:null,leftBlockAt:.75,
    initialGuard:Object.freeze({L:'body',R:'body'}),
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','開始時は両手とも腹の位置','0.75 TUから左手を顔へ上げ、体を右へ12°ひねってジャブの進路へ置く','右手は腹の高さを維持し、青い拳が赤い左グローブへ接近した時点で接触','他の入力なし']),
    expected:'左手が腹から顔へ上がる間に体が右へ回り、左拳がジャブの進路に入る。グローブ同士が触れると、青い拳と前足・腰は短く止まり、横へ流れず元の構えへ戻る。ダメージ0、両者の腕は弾かれない。止める長さとフォームの自然さは本人確認待ち。',
  }),
]);

const captureImpact=(state,event)=>({
  time:state.time,
  event:{...event},
  playerHp:state.fighters[0].hp,
  attackerLeftDeflection:deflectionRemaining(state.fighters[1],'L'),
  defenderLeftDeflection:deflectionRemaining(state.fighters[0],'L'),
  defenderRightDeflection:deflectionRemaining(state.fighters[0],'R'),
  defenderLeftDefense:currentDefense(state.fighters[0],'L'),
  defenderRightDefense:currentDefense(state.fighters[0],'R'),
  defenderRightParry:parryStatus(state.fighters[0],'R')?.phase||null,
  attackerLeftGlove:gloveLocal(state.fighters[1],'L').slice(),
  attackerLeadFoot:leadFootMotion(state.fighters[1]),
  attackerBody:jabBodyMotion(state.fighters[1]),
  defenderRightGlove:gloveLocal(state.fighters[0],'R').slice(),
  defenderLeftGlove:gloveLocal(state.fighters[0],'L').slice(),
  defenderTurn:leftBlockMotion(state.fighters[0]),
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
    {label:'左ジャブの拳中心が額より低い顔中央へ向かった',pass:impact?.attackerLeftGlove[1]<=TARGET_HEIGHT.head-.06},
    {label:'ジャブが出る前も左右の拳が小さく動き続けた',pass:run.preCueMotion.samples>=120&&run.preCueMotion.L.range>=.02&&run.preCueMotion.R.range>=.02},
    {label:'左拳と左前足が同じ固定tickで前進を開始',pass:run.punchStartAt!==null&&run.leadFootStartAt!==null&&Math.abs(run.punchStartAt-run.leadFootStartAt)<STEP/2},
    {label:'腰・胸・頭・肩線も同じ固定tickから小さく連動',pass:run.bodyStartAt!==null&&Math.abs(run.punchStartAt-run.bodyStartAt)<STEP/2&&run.bodyPeak.hip>=JAB_BODY.hipForward*.75&&run.bodyPeak.chest>=JAB_BODY.chestForward*.75&&run.bodyPeak.head>=JAB_BODY.headForward*.75&&run.bodyPeak.turn>=JAB_BODY.turn*.75},
    {label:'ジャブの進行80%到達後に接触',pass:run.defenseIssuedAt>MOVES.jab.cue&&run.leadFootPeak>=.075&&event?.type==='block'&&event?.defense==='parry'&&event.punchProgress>=PARRY.contactProgress.jab&&event.punchProgress<=PARRY.contactProgress.jab+PARRY.progressTolerance},
    {label:'右手を内側へ入れず、真上から小さく下ろした',pass:run.parryStart&&run.tapStart&&impact.defenderRightParry==='tap'&&run.tapStart[1]-run.parryStart[1]>=.04&&run.tapStart[1]-run.parryStart[1]<=.07&&run.tapStart[1]-impact.defenderRightGlove[1]>=.04&&run.tapStart[1]-impact.defenderRightGlove[1]<=.08&&Math.abs(run.parryStart[0]-run.tapStart[0])<.01&&Math.abs(run.tapStart[0]-impact.defenderRightGlove[0])<.01},
    {label:'自分はダメージ0、右腕は弾かれない',pass:event?.damage===0&&impact.playerHp===100&&impact.defenderRightDeflection===0},
    {label:'相手の左拳だけが前進しながら下へ弾かれた',pass:impact.attackerLeftDeflection>ARM_DEFLECT_TU-.2&&run.rebound?.forward>=PARRY.deflectForward-.02&&run.rebound?.downward>=PARRY.deflectDrop-.02},
    {label:'両者の該当腕と相手の足腰が規定の動作を終えて復帰',pass:deflectionRemaining(state.fighters[1],'L')===0&&!parryStatus(state.fighters[0],'R')&&currentDefense(state.fighters[0],'R')==='block'&&jabBodyMotion(state.fighters[1]).progress===0},
  ];
  if(definition.id==='jab-right-block')return [
    {label:'右手ブロッキングで接触',pass:event?.type==='block'&&event?.defense==='block'},
    {label:'仮ダメージは1',pass:event?.damage===1&&impact.playerHp===99},
    {label:'相手の左腕は弾かれない',pass:impact.attackerLeftDeflection===0},
    {label:'自分の右腕も弾かれない',pass:impact.defenderRightDeflection===0},
    {label:'相手のジャブが通常の戻りを完了',pass:state.fighters[1].attack===null&&currentDefense(state.fighters[0],'R')==='block'},
  ];
  return [
    {label:'左手は腹から進路へ上がり、右手は腹の高さを保った',pass:run.leftBlockIssuedAt!==null&&run.leftBlockStart&&run.leftBlockMidpointY>run.leftBlockStart[1]+.2&&run.leftBlockMidpointY<impact?.defenderLeftGlove[1]-.15&&impact.defenderLeftGlove[1]-run.leftBlockStart[1]>=.4&&run.rightGloveStart&&Math.abs(impact.defenderRightGlove[1]-run.rightGloveStart[1])<.01},
    {label:'青い拳が伸び切る前に赤い左グローブへ接触',pass:impact?.defenderLeftDefense==='block'&&impact?.defenderRightDefense==='body'&&impact.defenderTurn.progress>.9&&event?.punchProgress<1&&event?.gloveDistance<=LEFT_BLOCK_TURN.contactDistance&&event?.lineOffset<=LEFT_BLOCK_TURN.lineOffset},
    {label:'接触地点で短く止まり、横へ流れず元の方向へ戻った',pass:event?.type==='block'&&event?.technique==='left-turn'&&event?.blockSide==='L'&&event?.damage===0&&impact?.playerHp===100&&run.holdSamples>=10&&run.holdMaxMotion<1e-7&&run.forwardAfterBlockMax<1e-7&&run.returnPathError<1e-6&&run.retreatDistance>.4},
    {label:'相手の左腕も自分の左右の腕も弾かれない',pass:impact?.attackerLeftDeflection===0&&impact?.defenderLeftDeflection===0&&impact?.defenderRightDeflection===0},
    {label:'相手のジャブが構えへの戻りを完了',pass:state.fighters[1].attack===null&&currentDefense(state.fighters[0],'L')==='block'&&currentDefense(state.fighters[0],'R')==='body'},
  ];
}

export function createLabRun(caseIndex=0){
  const definition=LAB_CASES[caseIndex];
  if(!definition)throw new RangeError('Unknown lab case');
  const state=createMatch({mode:'dummy',seed:31001+caseIndex,duration:30});
  if(definition.initialGuard){
    for(const side of ['L','R']){
      const mode=definition.initialGuard[side];
      state.fighters[0].defense[side]={from:mode,to:mode,t:HEAD_BLOCK.transition};
    }
  }
  startMatch(state);
  const started=requestAttack(state,1,'jab','head');
  if(!started.ok)throw new Error(started.message);
  return {definition,caseIndex,state,status:'running',defenseIssued:false,defenseIssuedAt:null,leftBlockIssuedAt:null,leftBlockStart:null,leftBlockMidpointY:null,rightGloveStart:definition.initialGuard?gloveLocal(state.fighters[0],'R').slice():null,parryStart:null,tapStart:null,preCueMotion:{samples:0,L:motionRange(),R:motionRange()},punchStartAt:null,leadFootStartAt:null,bodyStartAt:null,leadFootPeak:0,bodyPeak:{hip:0,chest:0,head:0,turn:0},impact:null,rebound:null,holdSamples:0,holdMaxMotion:0,forwardAfterBlockMax:0,returnPathError:0,retreatDistance:0,checks:[]};
}

export function advanceLabRun(run,dt=STEP){
  if(run.status!=='running')return run;
  const previousEventId=run.state.eventId;
  tick(run.state,dt,{cpuEnabled:false});
  const attacker=run.state.fighters[1],foot=leadFootMotion(attacker),body=jabBodyMotion(attacker),punchProgress=punchTravelProgress(attacker);
  if(attacker.attack?.t<MOVES.jab.cue){
    sampleMotion(run.preCueMotion.L,visualGloveLocal(attacker,'L',run.state.time));sampleMotion(run.preCueMotion.R,visualGloveLocal(attacker,'R',run.state.time));run.preCueMotion.samples++;
  }
  if(punchProgress>0&&run.punchStartAt===null)run.punchStartAt=run.state.time;
  if(foot.forward>0&&run.leadFootStartAt===null)run.leadFootStartAt=run.state.time;
  if(body.progress>0&&run.bodyStartAt===null)run.bodyStartAt=run.state.time;
  run.leadFootPeak=Math.max(run.leadFootPeak,foot.forward);
  run.bodyPeak.hip=Math.max(run.bodyPeak.hip,body.hipForward);run.bodyPeak.chest=Math.max(run.bodyPeak.chest,body.chestForward);run.bodyPeak.head=Math.max(run.bodyPeak.head,body.headForward);run.bodyPeak.turn=Math.max(run.bodyPeak.turn,Math.abs(body.turn));
  if(run.definition.leftBlockAt!==undefined&&run.leftBlockIssuedAt===null&&run.state.time>=run.definition.leftBlockAt){
    run.leftBlockStart=gloveLocal(run.state.fighters[0],'L').slice();
    const defense=requestDefense(run.state,0,'L','block');
    if(!defense.ok)throw new Error(defense.message);
    run.leftBlockIssuedAt=run.state.time;
  }
  if(run.leftBlockIssuedAt!==null&&run.leftBlockMidpointY===null&&run.state.time>=run.leftBlockIssuedAt+HEAD_BLOCK.transition/2)run.leftBlockMidpointY=gloveLocal(run.state.fighters[0],'L')[1];
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
  if(run.definition.id==='jab-left-block'&&attacker.attack?.blocked){
    const pose=gloveLocal(attacker,'L'),blocked=attacker.attack.blocked,from=blocked.from,elapsed=attacker.attack.t-blocked.startT;
    if(elapsed<blocked.hold){
      run.holdSamples++;
      run.holdMaxMotion=Math.max(run.holdMaxMotion,Math.hypot(...pose.map((v,i)=>v-from[i])));
    }else{
      run.forwardAfterBlockMax=Math.max(run.forwardAfterBlockMax,pose[2]-from[2]);
      run.retreatDistance=Math.max(run.retreatDistance,from[2]-pose[2]);
      const base=restingGlove(attacker,'L'),axis=base.map((v,i)=>v-from[i]);
      const u=clamp(axis.reduce((sum,v,i)=>sum+v*(pose[i]-from[i]),0)/axis.reduce((sum,v)=>sum+v*v,0),0,1);
      run.returnPathError=Math.max(run.returnPathError,Math.hypot(...pose.map((v,i)=>v-from[i]-axis[i]*u)));
    }
  }
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
  if(run.definition.leftBlockAt!==undefined){
    if(run.leftBlockIssuedAt===null)return {phase:'setup',label:'右手は腹。左手のブロッキングを待っている'};
    if(run.state.fighters[0].defense.L.t<HEAD_BLOCK.transition)return {phase:'defense',label:'体を右へひねり、左手を顔の内側へ運んでいる'};
    return {phase:'defense',label:'右回旋と左手のブロッキングが完成。右手は腹のまま'};
  }
  const attack=run.state.fighters[1].attack;
  return {phase:'attack',label:attack?.t<MOVES.jab.cue?'相手の両手が小さく動き続けている':'相手の左拳と左前足が同時に前進'};
}

export function runLabToCompletion(caseIndex,maxTime=20){
  const run=createLabRun(caseIndex);
  for(let elapsed=0;elapsed<maxTime&&run.status==='running';elapsed+=STEP)advanceLabRun(run,STEP);
  return run;
}
