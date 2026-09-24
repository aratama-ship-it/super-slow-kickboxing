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
  localToWorld,
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
} from './core.mjs?v=0.49';

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
    defense:'両手を額へ・左手で受け止め＋体の右回旋',viewLabel:'両手 額へ・左手で受け止め',defenseAt:null,leftBlockAt:.75,
    initialGuard:Object.freeze({L:'body',R:'body'}),
    conditions:Object.freeze(['パンチの間合い','相手は頭へ左ジャブ','開始時は両手とも腹の位置','0.75 TUから両手を額へ上げ、体を右へ12°ひねって左手をジャブの進路へ置く','左右のグローブは額の同じ奥行き、青い拳は赤い左グローブへ接触','他の入力なし']),
    expected:'両手を腹から額へ上げ、左右のグローブを額の同じ奥行きに置く。実際のグローブと前腕で視界が狭くなり、中央の細い隙間から相手が見える。体を右へ回して左拳をジャブの進路へ置き、接触した青い拳と前足・腰は短く止まって、横へ流れず元の構えへ戻る。ダメージ0、両者の腕は弾かれない。視界の幅とフォームの自然さは本人確認待ち。',
  }),
  Object.freeze({
    id:'jab-left-parry',number:'04',title:'相手の左ジャブ × 左手パーリング',
    question:'左手で上から小さく触れ、青い拳を止めずに画面右へ外せるか。',
    defense:'左手パーリング＋体の右回旋',viewLabel:'左手パーリング',defenseAt:3.15,defenseSide:'L',
    initialTurn:'both-head',
    conditions:Object.freeze(['パンチの間合い','相手は鼻から口の高さへ左ジャブ','両手を額に添えた右回旋12°の構え','拳が見えてから3.15 TUに左手パーリング','ジャブ進行80〜82.5%で左グローブと接触','他の入力なし']),
    expected:'左手を接触へ向けて少し前に出し、真上から小さく落として青い拳に触れる。青い拳はそこで止まらず、まず赤い右グローブの下を通り、こちらへ約14cm進みながら画面右へ約21cm外れる。ダメージ0。青い左腕だけ4 TU使用不能となり、赤い左手は構えへ戻る。調整後の動きは本人確認待ち。',
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
  defenderLeftParry:parryStatus(state.fighters[0],'L')?.phase||null,
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
    rightward:glove[0]-impact.attackerLeftGlove[0],
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
  if(definition.id==='jab-left-parry')return [
    {label:'ジャブが見えてから左手を出し、進行80%付近で接触',pass:run.defenseIssuedAt>MOVES.jab.cue&&event?.type==='block'&&event?.defense==='parry'&&event?.technique==='left-cross'&&event.punchProgress>=PARRY.contactProgress.jab&&event.punchProgress<=PARRY.contactProgress.jab+PARRY.progressTolerance},
    {label:'左グローブが少し前へ出て、上から小さく青い拳へ触れた',pass:run.parryStart&&run.tapStart&&impact?.defenderLeftParry==='tap'&&run.tapStart[1]-run.parryStart[1]>=.04&&run.tapStart[1]-impact.defenderLeftGlove[1]>=.04&&impact.defenderLeftGlove[2]-run.parryStart[2]>=.10&&event?.gloveDistance<=PARRY.crossContactDistance},
    {label:'赤い左腕は弾かれず、頭へのダメージ0',pass:impact?.playerHp===100&&event?.damage===0&&impact?.defenderLeftDeflection===0&&impact?.defenderRightDeflection===0},
    {label:'青い左拳が右グローブを貫かず、前進しながら画面右へ外れた',pass:impact?.attackerLeftDeflection>ARM_DEFLECT_TU-.2&&run.rebound?.rightward>=PARRY.crossDeflectRight-.02&&run.rebound?.forward>=PARRY.deflectForward-.02&&run.rebound?.downward>=PARRY.crossDeflectDrop-.02&&run.rightClearanceMin>=.26},
    {label:'青い左腕と赤い左手が構えへ復帰した',pass:deflectionRemaining(state.fighters[1],'L')===0&&!parryStatus(state.fighters[0],'L')&&currentDefense(state.fighters[0],'L')==='block'},
  ];
  return [
    {label:'両手を額へ上げ、左右の拳の奥行きをそろえた',pass:run.leftBlockIssuedAt!==null&&run.leftBlockStart&&run.leftBlockMidpointY>run.leftBlockStart[1]+.2&&run.leftBlockMidpointY<impact?.defenderLeftGlove[1]-.15&&impact.defenderLeftGlove[1]-run.leftBlockStart[1]>=.4&&run.rightGloveStart&&impact.defenderRightGlove[1]-run.rightGloveStart[1]>=.4&&Math.abs(impact.defenderLeftGlove[2]-impact.defenderRightGlove[2])<.01},
    {label:'青い拳が伸び切る前に赤い左グローブへ接触',pass:impact?.defenderLeftDefense==='block'&&impact?.defenderRightDefense==='block'&&impact.defenderTurn.progress>.9&&event?.punchProgress<1&&event?.gloveDistance<=LEFT_BLOCK_TURN.bothHeadContactDistance&&event?.lineOffset<=LEFT_BLOCK_TURN.lineOffset},
    {label:'接触地点で短く止まり、横へ流れず元の方向へ戻った',pass:event?.type==='block'&&event?.technique==='left-turn'&&event?.blockSide==='L'&&event?.damage===0&&impact?.playerHp===100&&run.holdSamples>=10&&run.holdMaxMotion<1e-7&&run.forwardAfterBlockMax<1e-7&&run.returnPathError<1e-6&&run.retreatDistance>.4},
    {label:'相手の左腕も自分の左右の腕も弾かれない',pass:impact?.attackerLeftDeflection===0&&impact?.defenderLeftDeflection===0&&impact?.defenderRightDeflection===0},
    {label:'相手のジャブが構えへの戻りを完了',pass:state.fighters[1].attack===null&&currentDefense(state.fighters[0],'L')==='block'&&currentDefense(state.fighters[0],'R')==='block'},
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
  if(definition.id==='jab-left-block'||definition.initialTurn)state.fighters[0].leftTurnGuard='both-head';
  startMatch(state);
  const started=requestAttack(state,1,'jab','head');
  if(!started.ok)throw new Error(started.message);
  return {definition,caseIndex,state,status:'running',defenseIssued:false,defenseIssuedAt:null,leftBlockIssuedAt:null,leftBlockStart:null,leftBlockMidpointY:null,rightGloveStart:definition.initialGuard?gloveLocal(state.fighters[0],'R').slice():null,parryStart:null,tapStart:null,preCueMotion:{samples:0,L:motionRange(),R:motionRange()},punchStartAt:null,leadFootStartAt:null,bodyStartAt:null,leadFootPeak:0,bodyPeak:{hip:0,chest:0,head:0,turn:0},impact:null,rebound:null,rightClearanceMin:Infinity,holdSamples:0,holdMaxMotion:0,forwardAfterBlockMax:0,returnPathError:0,retreatDistance:0,checks:[]};
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
    for(const side of ['L','R']){
      const defense=requestDefense(run.state,0,side,'block');
      if(!defense.ok)throw new Error(defense.message);
    }
    run.leftBlockIssuedAt=run.state.time;
  }
  if(run.leftBlockIssuedAt!==null&&run.leftBlockMidpointY===null&&run.state.time>=run.leftBlockIssuedAt+HEAD_BLOCK.transition/2)run.leftBlockMidpointY=gloveLocal(run.state.fighters[0],'L')[1];
  if(run.definition.defenseAt!==null&&!run.defenseIssued&&run.state.time>=run.definition.defenseAt){
    const side=run.definition.defenseSide||'R';
    run.parryStart=gloveLocal(run.state.fighters[0],side).slice();
    const defense=requestDefense(run.state,0,side,'parry');
    if(!defense.ok)throw new Error(defense.message);
    run.defenseIssued=true;
    run.defenseIssuedAt=run.state.time;
  }
  const parrySide=run.definition.defenseSide||'R';
  if(!run.tapStart&&parryStatus(run.state.fighters[0],parrySide)?.phase==='tap')run.tapStart=gloveLocal(run.state.fighters[0],parrySide).slice();
  if(!run.impact&&run.state.eventId>previousEventId){
    const event=run.state.events.at(-1);
    run.impact=captureImpact(run.state,event);
  }
  if(!run.impact)return run;
  if(run.definition.id==='jab-left-parry'&&attacker.deflection.L?.t<=PARRY.deflectPeak){
    const blue=localToWorld(attacker,gloveLocal(attacker,'L'));
    const redRight=localToWorld(run.state.fighters[0],gloveLocal(run.state.fighters[0],'R'));
    run.rightClearanceMin=Math.min(run.rightClearanceMin,Math.hypot(...blue.map((v,i)=>v-redRight[i])));
  }
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
  if(!run.rebound&&['jab-right-parry','jab-left-parry'].includes(run.definition.id)&&run.state.fighters[1].deflection.L?.t>=PARRY.deflectPeak)run.rebound=captureRebound(run.state,run.impact);
  const recovered=['jab-right-parry','jab-left-parry'].includes(run.definition.id)
    ? deflectionRemaining(run.state.fighters[1],'L')===0&&!parryStatus(run.state.fighters[0],parrySide)
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
    const remaining=['jab-right-parry','jab-left-parry'].includes(run.definition.id)?deflectionRemaining(run.state.fighters[1],'L'):0;
    const direction=run.definition.id==='jab-left-parry'?'画面右':'下';
    return {phase:'rebound',label:remaining>0?(run.rebound?'相手の左拳が前進しながら'+direction+'へ弾かれ中 ':'相手の左拳を'+direction+'へ弾いている ')+remaining.toFixed(1)+' TU':'復帰を確認中'};
  }
  if(run.definition.defenseAt!==null&&run.defenseIssued){
    const side=run.definition.defenseSide||'R',hand=side==='L'?'左手':'右手',parry=parryStatus(run.state.fighters[0],side);
    return {phase:'defense',label:parry?.phase==='prepare'?hand+'を少し上へ準備中':parry?.phase==='tap'?hand+'を上から小さく落としている':'接触を確認中'};
  }
  if(run.definition.leftBlockAt!==undefined){
    if(run.leftBlockIssuedAt===null)return {phase:'setup',label:'両手を額へ上げるブロッキングを待っている'};
    if(run.state.fighters[0].defense.L.t<HEAD_BLOCK.transition)return {phase:'defense',label:'両手を額へ上げ、体を右へひねって左手を進路へ運んでいる'};
    return {phase:'defense',label:'両手は額。左手でジャブを受け止める準備ができた'};
  }
  const attack=run.state.fighters[1].attack;
  return {phase:'attack',label:attack?.t<MOVES.jab.cue?'相手の両手が小さく動き続けている':'相手の左拳と左前足が同時に前進'};
}

export function runLabToCompletion(caseIndex,maxTime=20){
  const run=createLabRun(caseIndex);
  for(let elapsed=0;elapsed<maxTime&&run.status==='running';elapsed+=STEP)advanceLabRun(run,STEP);
  return run;
}
