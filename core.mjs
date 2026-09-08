// All durations are prototype TU. At speed 0.1, one TU lasts one real second.
export const MOVES = Object.freeze({
  jab:    {name:'左ジャブ',side:'L',kind:'straight',force:3,wind:4,cue:2.7,recover:2.2,cancel:2.7,reach:1.25,damage:4,cost:7},
  cross:  {name:'右ストレート',side:'R',kind:'straight',force:7,wind:6,cue:2,recover:3.1,cancel:3.5,reach:1.42,damage:11,cost:15},
  hookL:  {name:'左フック',side:'L',kind:'hook',force:6,wind:7.5,cue:2,recover:3.5,cancel:4.4,reach:1.12,damage:14,cost:18},
  hookR:  {name:'右フック',side:'R',kind:'hook',force:7,wind:7.8,cue:2,recover:3.7,cancel:4.5,reach:1.15,damage:15,cost:19},
  upperL: {name:'左アッパー',side:'L',kind:'upper',force:5,wind:6.3,cue:2,recover:3,cancel:3.5,reach:1.06,damage:12,cost:15},
  upperR: {name:'右アッパー',side:'R',kind:'upper',force:6,wind:6.6,cue:2,recover:3.2,cancel:3.5,reach:1.08,damage:13,cost:16},
});
export const DEFENSES = Object.freeze({parry:'パーリング',block:'ブロッキング',body:'お腹ブロッキング'});
export const STANCES = Object.freeze({
  orthodox:Object.freeze({name:'オーソドックス',lead:'L',rear:'R',bodyYaw:-Math.PI/4,feetYaw:-Math.PI/4}),
});
export const STEP=1/60;
export const PUNCH_CLASH_DISTANCE=.2;
export const ARM_DEFLECT_TU=4;
export const EQUAL_CLASH_DEFLECT_TU=3;
export const PARRY=Object.freeze({prepare:2.4,sweep:1.6,recover:2.4,cost:5,contactDistance:.22});
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const defense=mode=>({from:mode,to:mode,t:3});
function fighter(id){return {id,stance:'orthodox',z:id===0?.65:-.65,face:id===0?-1:1,hp:100,stamina:100,defense:{L:defense('block'),R:defense('block')},parry:{L:null,R:null},deflection:{L:null,R:null},attack:null,queue:null,movement:null,slip:null,hitFlash:0,blockedFlash:0,stats:{hits:0,blocks:0,misses:0,feints:0,clashes:0,deflected:0,damage:0},lastReason:''};}
export function createMatch({seed=1729,mode='spar',duration=180}={}){
  return {phase:'ready',time:0,duration,mode,fighters:[fighter(0),fighter(1)],events:[],eventId:0,winner:null,seed:seed>>>0,
    ai:{next:3.5,observeAt:0,observations:[],latest:null,feintAt:null,lastReacted:null},sequence:0};
}
export function startMatch(s){if(s.phase==='ready'||s.phase==='paused')s.phase='running';}
export function pauseMatch(s){if(s.phase==='running')s.phase='paused';}
export function distance(s){return Math.abs(s.fighters[0].z-s.fighters[1].z);}
function event(s,data){s.events.push({id:++s.eventId,time:s.time,...data});if(s.events.length>8)s.events.shift();}
function result(f,ok,message){f.lastReason=message;return {ok,message};}
export function currentDefense(f,side){
  const p=parryStatus(f,side);
  if(p)return p.phase==='sweep'&&!f.parry[side].used?'parry':'open';
  const hand=f.defense[side];
  if(hand.t>=3)return hand.to;
  const ratio=hand.t/3;
  return ratio<.25?hand.from:ratio>.85?hand.to:'open';
}
export function deflectionRemaining(f,side){const d=f.deflection[side];return d?Math.max(0,d.duration-d.t):0;}
export function parryStatus(f,side){
  const p=f.parry[side];if(!p)return null;
  const phase=p.t<PARRY.prepare?'prepare':p.t<PARRY.prepare+PARRY.sweep?'sweep':'return';
  const end=phase==='prepare'?PARRY.prepare:phase==='sweep'?PARRY.prepare+PARRY.sweep:PARRY.prepare+PARRY.sweep+PARRY.recover;
  return {phase,remaining:Math.max(0,end-p.t),direction:side==='L'?'左外':'右外',used:p.used};
}
export function available(s,who,id){
  const f=s.fighters[who],m=MOVES[id];
  if(!m)return {ok:false,message:'技が見つかりません'};
  if(s.phase!=='running')return {ok:false,message:'開始・再開してから操作できます'};
  if(deflectionRemaining(f,m.side)>0)return {ok:false,message:(m.side==='L'?'左腕':'右腕')+'が弾かれているため攻撃できません'};
  if(f.parry[m.side])return {ok:false,message:'パーリングの手を戻してから打てます'};
  if(f.movement)return {ok:false,message:'足を置き終えるまで待ちます'};
  if(f.slip)return {ok:false,message:'頭を戻してから打てます'};
  if(f.stamina<m.cost)return {ok:false,message:'スタミナを回復してから打てます'};
  return {ok:true,message:f.attack?'次の1手へ予約できます':'打てます'};
}
export function requestAttack(s,who,id,target='head'){
  const f=s.fighters[who];if(!['head','body'].includes(target))return result(f,false,'狙いは頭か胴を選んでください');
  const check=available(s,who,id);if(!check.ok)return result(f,false,check.message);
  if(f.attack){f.queue={id,target,expires:s.time+11};return result(f,true,MOVES[id].name+'を次の1手へ予約');}
  const m=MOVES[id],slow=f.stamina<25?1.18:1;
  f.stamina-=m.cost;f.attack={id,target,t:0,wind:m.wind*slow,recover:m.recover*slow,hit:false,feint:false,serial:++s.sequence};
  f.queue=null;return result(f,true,m.name+'を開始');
}
export function requestDefense(s,who,side,mode){
  const f=s.fighters[who];if(!['L','R'].includes(side)||!(mode in DEFENSES))return result(f,false,'左右の手と守りを選んでください');
  if(s.phase!=='running')return result(f,false,'開始・再開してから操作できます');
  if(deflectionRemaining(f,side)>0)return result(f,false,(side==='L'?'左腕':'右腕')+'が弾かれているため防御できません');
  if(f.parry[side])return result(f,false,'パーリングの手が戻るまで変更できません');
  const hand=f.defense[side],name=(side==='L'?'左手':'右手')+DEFENSES[mode];
  if(mode==='parry'){
    if(f.attack&&MOVES[f.attack.id].side===side)return result(f,false,'打っている手が戻ってからパーリングできます');
    if(f.stamina<PARRY.cost)return result(f,false,'スタミナを回復してからパーリングできます');
    const from=gloveLocal(f,side).slice();
    f.parry[side]={t:0,from,used:false};f.stamina-=PARRY.cost;
    if(f.queue&&MOVES[f.queue.id].side===side)f.queue=null;
    return result(f,true,name+'：準備して'+(side==='L'?'左外':'右外')+'へ払います');
  }
  if(hand.to===mode)return result(f,true,name+'を維持');
  f.defense[side]={from:currentDefense(f,side),to:mode,t:0};return result(f,true,name+'へ移動中');
}
export function requestFeint(s,who){
  const f=s.fighters[who],a=f.attack;
  if(s.phase!=='running')return result(f,false,'開始・再開してから操作できます');
  if(!a){if(f.queue){f.queue=null;return result(f,true,'予約を取り消しました');}return result(f,false,'打ち始めてから「引く」を選びます');}
  const m=MOVES[a.id];
  if(a.feint||a.t>=m.cancel*(a.wind/m.wind)||a.hit)return result(f,false,'引ける区間を過ぎています');
  a.cancelPose=gloveLocal(f,m.side);a.feint=true;a.feintStart=a.t;a.feintDuration=1.8;
  f.queue=null;f.stamina=Math.max(0,f.stamina-3);f.stats.feints++;
  return result(f,true,'攻撃を引いて構えへ戻ります');
}
export function requestStep(s,who,direction){
  const f=s.fighters[who];
  if(s.phase!=='running')return result(f,false,'開始・再開してから操作できます');
  if(!['in','out'].includes(direction))return result(f,false,'前後を選んでください');
  if(f.attack||f.slip)return result(f,false,'上体を戻してから踏み直せます');
  if(f.movement)return result(f,false,'いま足を運んでいます');
  const target=clamp(f.z+(direction==='in'?1:-1)*f.face*.22,-2.6,2.6);
  if(Math.abs(target-f.z)<.01)return result(f,false,'リングの端です');
  f.movement={from:f.z,to:target,t:0,duration:2.2};f.stamina=Math.max(0,f.stamina-2);
  return result(f,true,direction==='in'?'半歩、近づきます':'半歩、離れます');
}
export function requestSlip(s,who,side){
  const f=s.fighters[who];
  if(s.phase!=='running')return result(f,false,'開始・再開してから操作できます');
  if(!['L','R'].includes(side))return result(f,false,'左右を選んでください');
  if(f.attack||f.slip||f.movement)return result(f,false,'今の動作を戻してから頭をずらせます');
  if(f.stamina<6)return result(f,false,'スタミナを回復してください');
  f.stamina-=6;f.slip={side,t:0,duration:6};return result(f,true,(side==='L'?'左':'右')+'へ頭をずらします');
}
export function slipOffset(f){return f.slip?(f.slip.side==='L'?1:-1)*.31*Math.sin(Math.PI*clamp(f.slip.t/f.slip.duration,0,1)):0;}
export function stanceRole(f,side){
  const stance=STANCES[f.stance]||STANCES.orthodox;
  return side===stance.lead?'lead':'rear';
}
export function stanceAngles(f){
  const stance=STANCES[f.stance]||STANCES.orthodox;
  return {bodyYaw:stance.bodyYaw,feetYaw:stance.feetYaw};
}
const defensePoint=(f,mode,side)=>{
  const sign=side==='L'?1:-1;
  const depth=stanceRole(f,side)==='lead'?.12:-.08;
  if(mode==='block')return [sign*.25,1.56,.27+depth];
  if(mode==='body')return [sign*.19,1.13,.30+depth];
  return [sign*.32,1.24,.08+depth];
};
export function restingGlove(f,side){const hand=f.defense[side];return mix(defensePoint(f,hand.from,side),defensePoint(f,hand.to,side),ease(hand.t/3));}
export function gloveLocal(f,side){
  const base=restingGlove(f,side),d=f.deflection[side],a=f.attack,p=f.parry[side];
  if(d){
    const sign=side==='L'?1:-1,peak=[sign*.62,clamp(d.from[1]-.18,1.06,1.42),-.02],out=.65;
    if(d.t<out)return mix(d.from,peak,ease(d.t/out));
    return mix(peak,[base[0]+slipOffset(f)*.6,base[1],base[2]],ease((d.t-out)/(d.duration-out)));
  }
  if(p){
    const sign=side==='L'?1:-1,depth=stanceRole(f,side)==='lead'?.12:-.08,offset=slipOffset(f)*.6;
    const inner=[sign*-.09+offset,1.60,.42+depth],outer=[sign*.44+offset,1.60,.42+depth];
    if(p.t<PARRY.prepare)return mix(p.from,inner,ease(p.t/PARRY.prepare));
    if(p.t<PARRY.prepare+PARRY.sweep)return mix(inner,outer,ease((p.t-PARRY.prepare)/PARRY.sweep));
    return mix(outer,[base[0]+offset,base[1],base[2]],ease((p.t-PARRY.prepare-PARRY.sweep)/PARRY.recover));
  }
  if(!a||MOVES[a.id].side!==side)return [base[0]+slipOffset(f)*.6,base[1],base[2]];
  const m=MOVES[a.id],sign=side==='L'?1:-1;
  if(a.feint)return mix(a.cancelPose,base,ease((a.t-a.feintStart)/a.feintDuration));
  const targetY=a.target==='head'?1.64:1.12;
  const end=[sign*.025,targetY,m.reach-.13];
  const lead=stanceRole(f,side)==='lead';
  const chamber=m.kind==='hook'?[sign*.53,targetY-.07,lead?.28:.10]:m.kind==='upper'?[sign*.25,1.03,lead?.27:.13]:[sign*.22,1.46,lead?.35:.13];
  if(a.t>=a.wind)return mix(end,base,ease((a.t-a.wind)/a.recover));
  const windRatio=a.t/a.wind, cueRatio=m.cue/m.wind;
  if(windRatio<cueRatio)return mix(base,chamber,ease(windRatio/cueRatio));
  const u=ease((windRatio-cueRatio)/(1-cueRatio));
  const position=mix(chamber,end,u);
  if(m.kind==='hook'){position[0]+=sign*.18*Math.sin(Math.PI*u);position[2]+=.12*Math.sin(Math.PI*u);}
  if(m.kind==='upper')position[1]-=.16*Math.sin(Math.PI*u);
  return position;
}
export function localToWorld(f,p){return [p[0]*f.face,p[1],f.z+p[2]*f.face];}
export function bodyTarget(f,target){return localToWorld(f,[slipOffset(f),target==='head'?1.64:1.12,.10]);}
function deflectHand(f,side,duration){
  const from=gloveLocal(f,side).slice();
  f.deflection[side]={t:0,duration,from};
  f.parry[side]=null;
  if(f.attack&&MOVES[f.attack.id].side===side)f.attack=null;
  if(f.queue&&MOVES[f.queue.id].side===side)f.queue=null;
  f.stats.deflected++;
}
function activePunch(f){
  const a=f.attack,m=a?MOVES[a.id]:null;
  return a&&!a.feint&&!a.hit&&a.t>=m.cue*(a.wind/m.wind)?{a,m}:null;
}
function resolveParries(s){
  const hits=[];
  for(const f of s.fighters){
    const punch=activePunch(f);if(!punch||punch.a.target!=='head'||punch.m.kind!=='straight')continue;
    const d=s.fighters[1-f.id],side=punch.m.side==='L'?'R':'L',p=parryStatus(d,side);
    if(!p||p.phase!=='sweep'||p.used||deflectionRemaining(d,side)>0)continue;
    const incoming=localToWorld(f,gloveLocal(f,punch.m.side)),sweep=localToWorld(d,gloveLocal(d,side));
    if(Math.hypot(...incoming.map((v,i)=>v-sweep[i]))>PARRY.contactDistance)continue;
    hits.push({who:f.id,move:punch.a.id,target:'head',type:'block',defense:'parry',damage:0,deflectSide:punch.m.side,parrySide:side,
      reason:(side==='L'?'左手':'右手')+'のパーリングで'+p.direction+'へ外し、攻撃側の'+(punch.m.side==='L'?'左腕':'右腕')+'を弾いた'});
  }
  // Both fighters' contacts are sampled before either arm is displaced.
  for(const h of hits)s.fighters[1-h.who].parry[h.parrySide].used=true;
  applyContacts(s,hits);
}
function resolvePunchClash(s){
  const left=activePunch(s.fighters[0]),right=activePunch(s.fighters[1]);
  if(!left||!right)return false;
  const p0=localToWorld(s.fighters[0],gloveLocal(s.fighters[0],left.m.side));
  const p1=localToWorld(s.fighters[1],gloveLocal(s.fighters[1],right.m.side));
  if(Math.hypot(p0[0]-p1[0],p0[1]-p1[1],p0[2]-p1[2])>PUNCH_CLASH_DISTANCE)return false;
  const move0=left.a.id,move1=right.a.id;
  if(left.m.force===right.m.force){
    deflectHand(s.fighters[0],left.m.side,EQUAL_CLASH_DEFLECT_TU);deflectHand(s.fighters[1],right.m.side,EQUAL_CLASH_DEFLECT_TU);
    s.fighters[0].stats.clashes++;s.fighters[1].stats.clashes++;
    event(s,{type:'clash',who:null,move:move0,otherMove:move1,damage:0,reason:'同じ力でぶつかり、両方の腕が弾かれた'});return true;
  }
  const winner=left.m.force>right.m.force?0:1,loser=1-winner;
  const winning=winner===0?left:right,losing=loser===0?left:right;
  deflectHand(s.fighters[loser],losing.m.side,ARM_DEFLECT_TU);s.fighters[winner].stats.clashes++;
  event(s,{type:'clash',who:winner,loser,move:winning.a.id,otherMove:losing.a.id,damage:0,reason:(losing.m.side==='L'?'左腕':'右腕')+'が弾かれ、4 TU攻撃・防御不可'});return true;
}
function contact(s,who){
  const aF=s.fighters[who],dF=s.fighters[1-who],a=aF.attack,m=MOVES[a.id];
  const glove=localToWorld(aF,gloveLocal(aF,m.side)),target=bodyTarget(dF,a.target);
  const rx=a.target==='head'?.24:.32,ry=a.target==='head'?.25:.32,rz=.27;
  const ellipsoid=((glove[0]-target[0])/rx)**2+((glove[1]-target[1])/ry)**2+((glove[2]-target[2])/rz)**2;
  if(ellipsoid>1)return {who,move:a.id,target:a.target,type:'miss',damage:0,reason:Math.abs(glove[0]-target[0])>rx*.75?'頭の位置が外れた':'届かなかった'};
  const required=m.side==='L'?'R':'L',mode=currentDefense(dF,required),hand=dF.defense[required];
  const handBusy=dF.attack&&MOVES[dF.attack.id].side===required,handDeflected=deflectionRemaining(dF,required)>0;
  const ready=dF.stamina>=3&&!handBusy&&!handDeflected;
  const covers=ready&&(a.target==='body'?mode==='body':mode==='block');
  const handName=required==='L'?'左手':'右手';
  if(covers){
    const damage=mode==='block'?1:0,drain=mode==='block'?7:5;
    const reason=mode==='block'?handName+'のブロッキングで受けた':handName+'のお腹ブロッキングで受けた';
    return {who,move:a.id,target:a.target,type:'block',defense:mode,damage,drain,reason};
  }
  const damage=m.damage*(a.target==='body'?.85:1)*(aF.stamina<8?.85:1);
  const parry=parryStatus(dF,required);
  const reason=handBusy?'打った手が戻っていない':handDeflected?'必要な腕が弾かれている':parry?.phase==='prepare'?'パーリングの準備が間に合わなかった':parry?.phase==='return'?'パーリングから戻っている途中':parry?'パーリングの外を通った':hand.t<3?'必要な手を移している途中':mode==='block'&&a.target==='body'?'顔のブロッキングの下を通った':mode==='body'&&a.target==='head'?'お腹ブロッキングの上を通った':'守りの外へ届いた';
  return {who,move:a.id,target:a.target,type:'hit',damage:Math.round(damage),drain:a.target==='body'?8:2,reason};
}
function applyContacts(s,hits){
  // Calculate every contact from the same pre-impact state before applying effects.
  for(const h of hits){const f=s.fighters[h.who],d=s.fighters[1-h.who];
    d.hp=Math.max(0,d.hp-h.damage);d.stamina=Math.max(0,d.stamina-(h.drain||0));
    if(h.type==='hit'){f.stats.hits++;d.hitFlash=1;}
    else if(h.type==='block'){d.stats.blocks++;d.blockedFlash=1;}
    else f.stats.misses++;
    f.stats.damage+=h.damage;event(s,h);if(h.deflectSide)deflectHand(f,h.deflectSide,ARM_DEFLECT_TU);
  }
}
export function observeOpponent(s,who){
  const f=s.fighters[1-who],a=f.attack,m=a?MOVES[a.id]:null;
  const exposed=a&&!a.feint&&a.t>=m.cue*(a.wind/m.wind);
  return {time:s.time,distance:distance(s),defense:{L:currentDefense(f,'L'),R:currentDefense(f,'R')},parry:{L:parryStatus(f,'L')?.phase||null,R:parryStatus(f,'R')?.phase||null},deflection:{L:deflectionRemaining(f,'L'),R:deflectionRemaining(f,'R')},moving:!!f.movement,slipping:!!f.slip,
    action:a?{phase:a.feint?'return':a.t<a.wind?'windup':'return',side:m.side,kind:exposed?m.kind:null,target:exposed?a.target:null,serial:a.serial}:null};
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function cpu(s){
  const ai=s.ai,f=s.fighters[1];
  if(s.time>=ai.observeAt){ai.observations.push(observeOpponent(s,1));ai.observeAt=s.time+.5;}
  let observation=null;
  while(ai.observations.length&&ai.observations[0].time<=s.time-1.2)observation=ai.observations.shift();
  if(observation)ai.latest=observation;
  if(observation&&s.mode==='spar'){
    const a=observation.action;
    if(a&&a.phase==='windup'&&a.serial!==ai.lastReacted){
      const side=a.side==='L'?'R':'L';
      if(!a.kind&&a.serial!==ai.lastPredicted){
        ai.lastPredicted=a.serial;
        // Predict from a visible starting arm, before the path/target is known.
        if(random(s)<.4&&requestDefense(s,1,side,'parry').ok)ai.lastReacted=a.serial;
      }else if(a.kind){
        ai.lastReacted=a.serial;
        if(random(s)<.75)requestDefense(s,1,side,a.target==='body'?'body':'block');
      }
    }
  }
  if(f.attack&&ai.feintAt!==null&&f.attack.serial===ai.feintSerial&&f.attack.t>=ai.feintAt){requestFeint(s,1);ai.feintAt=null;}
  if(s.time<ai.next||f.attack||f.movement||f.slip)return;
  ai.next=s.time+2.5+random(s)*2.5;
  if(s.mode==='dummy')return;
  if(s.mode==='jab'){
    if(distance(s)>1.30){requestStep(s,1,'in');return;}
    requestAttack(s,1,'jab','head');return;
  }
  const obs=ai.latest; // Delayed, public pose only; never input queues or unexposed move IDs.
  if(!obs)return;
  if(f.stamina<25){requestDefense(s,1,'L','block');requestDefense(s,1,'R','block');if(distance(s)<1.45)requestStep(s,1,'out');return;}
  if(obs.distance>1.4){requestStep(s,1,'in');return;}
  if(obs.distance<.85&&random(s)<.5){requestStep(s,1,'out');return;}
  if(random(s)<.13){requestSlip(s,1,random(s)<.5?'L':'R');return;}
  const r=random(s),id=obs.deflection.R>0?(obs.distance>1.22?'jab':r<.55?'jab':'hookL'):obs.deflection.L>0?(obs.distance>1.22?'cross':r<.55?'cross':'hookR'):obs.distance>1.24?'cross':r<.32?'jab':r<.56?'cross':r<.76?'hookL':r<.9?'hookR':obs.distance<1.1?'upperR':'jab';
  const opposingHand=MOVES[id].side==='L'?'R':'L',cover=obs.defense[opposingHand];
  const target=cover==='body'?'head':cover==='block'?random(s)<.58?'body':'head':random(s)<.3?'body':'head';
  requestAttack(s,1,id,target);
  if(f.attack&&id!=='jab'&&random(s)<.24){ai.feintAt=2.5;ai.feintSerial=f.attack.serial;}
}
export function tick(s,dt=STEP,{cpuEnabled=true}={}){
  if(s.phase!=='running')return;
  if(!Number.isFinite(dt)||dt<=0||dt>.1)throw new RangeError('tick dt must be within (0, .1]');
  s.time+=dt;
  const contacts=[];
  for(const f of s.fighters){
    for(const side of ['L','R'])f.defense[side].t=Math.min(3,f.defense[side].t+dt);
    for(const side of ['L','R']){const d=f.deflection[side];if(d){d.t+=dt;if(d.t>=d.duration)f.deflection[side]=null;}}
    for(const side of ['L','R']){const p=f.parry[side];if(p){p.t+=dt;if(p.t>=PARRY.prepare+PARRY.sweep+PARRY.recover)f.parry[side]=null;}}
    f.hitFlash=Math.max(0,f.hitFlash-dt*1.7);f.blockedFlash=Math.max(0,f.blockedFlash-dt*1.7);
    const regen=f.attack||f.parry.L||f.parry.R ? .24 : 2;
    f.stamina=Math.min(100,f.stamina+regen*dt);
    if(f.slip){f.slip.t+=dt;if(f.slip.t>=f.slip.duration)f.slip=null;}
    if(f.movement){const m=f.movement;m.t+=dt;f.z=lerp(m.from,m.to,ease(m.t/m.duration));if(m.t>=m.duration)f.movement=null;}
    if(f.attack)f.attack.t+=dt;
  }
  const [p,o]=s.fighters;
  if(p.z-o.z<.72){const middle=(p.z+o.z)/2;p.z=middle+.36;o.z=middle-.36;p.movement=null;o.movement=null;}
  resolveParries(s);resolvePunchClash(s);
  for(const f of s.fighters){const a=f.attack;if(a&&!a.feint&&!a.hit&&a.t>=a.wind){a.t=a.wind;a.hit=true;contacts.push(f.id);}}
  applyContacts(s,contacts.map(who=>contact(s,who)));
  if(p.hp<=0||o.hp<=0||s.time>=s.duration){
    s.phase='ended';s.winner=p.hp===o.hp?'draw':p.hp>o.hp?0:1;s.fighters.forEach(f=>f.queue=null);return;
  }
  for(const f of s.fighters){
    const a=f.attack;
    if(a&&(a.feint?a.t>=a.feintStart+a.feintDuration:a.t>=a.wind+a.recover))f.attack=null;
    if(f.queue&&f.queue.expires<s.time)f.queue=null;
    if(!f.attack&&f.queue){const q=f.queue;f.queue=null;requestAttack(s,f.id,q.id,q.target);}
  }
  if(cpuEnabled)cpu(s);
}
export function attackStatus(f){
  const a=f.attack;if(!a)return {name:'動かせる',phase:'ready',progress:0};
  const m=MOVES[a.id];
  return {name:a.feint?'引いて戻る':a.t<a.wind?m.name+'を出す':m.name+'から戻る',phase:a.feint||a.t>=a.wind?'return':'windup',progress:a.feint?(a.t-a.feintStart)/a.feintDuration:a.t/(a.wind+a.recover)};
}
