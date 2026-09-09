import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,pauseMatch,tick,STEP,STANCES,MOVES,ARM_DEFLECT_TU,PARRY,GUARD_IDLE,TARGET_HEIGHT,JAB_LEAD_FOOT,JAB_BODY,CPU_REACTION_DELAY,stanceRole,stanceAngles,restingGlove,gloveLocal,visualGloveLocal,punchTravelProgress,leadFootMotion,jabBodyMotion,parryStatus,currentDefense,deflectionRemaining,requestAttack,requestDefense,requestFeint,requestStep,requestSlip,observeOpponent,distance,bodyTarget} from './core.mjs';
const run=(s,t,cpuEnabled=false)=>{for(let i=0;i<Math.round(t/STEP);i++)tick(s,STEP,{cpuEnabled});};
const match=options=>{const s=createMatch(options);startMatch(s);return s;};
const defend=(f,side,mode)=>{f.defense[side]={from:mode,to:mode,t:3};};
test('Orthodox stance keeps the left hand forward and the right hand rear in every defense',()=>{
  const s=createMatch();
  assert.deepEqual(STANCES.orthodox,{name:'オーソドックス',lead:'L',rear:'R',bodyYaw:-Math.PI/4,feetYaw:-Math.PI/4});
  for(const f of s.fighters){
    assert.equal(f.stance,'orthodox');assert.equal(stanceRole(f,'L'),'lead');assert.equal(stanceRole(f,'R'),'rear');
    assert.equal(Math.abs(stanceAngles(f).bodyYaw),Math.PI/4);assert.equal(Math.abs(stanceAngles(f).feetYaw),Math.PI/4);
    for(const mode of ['block','body']){defend(f,'L',mode);defend(f,'R',mode);assert.ok(restingGlove(f,'L')[2]>restingGlove(f,'R')[2],mode+' defense must keep the left glove forward');}
  }
});
test('Both guard hands keep a small irregular visual motion without changing collision poses',()=>{
  const s=match(),f=s.fighters[1],mechanical={L:gloveLocal(f,'L'),R:gloveLocal(f,'R')},samples={L:[],R:[]};
  for(let i=0;i<180;i++){
    tick(s,STEP,{cpuEnabled:false});
    for(const side of ['L','R'])samples[side].push(visualGloveLocal(f,side,s.time));
  }
  for(const side of ['L','R']){
    assert.deepEqual(gloveLocal(f,side),mechanical[side]);
    assert.deepEqual(visualGloveLocal(f,side,s.time,{idle:false}),mechanical[side]);
    for(let axis=0;axis<3;axis++){
      const values=samples[side].map(p=>p[axis]),range=Math.max(...values)-Math.min(...values),limit=[GUARD_IDLE.x,GUARD_IDLE.y,GUARD_IDLE.z][axis]*2+.0001;
      assert.ok(range>.01,`${side} axis ${axis} should keep moving`);assert.ok(range<=limit,`${side} axis ${axis} should stay small`);
    }
  }
  assert.notDeepEqual(samples.L[60],samples.R[60]);
});
test('A jab keeps the idle hand motion before its cue, then starts the glove and lead foot on the same tick',()=>{
  const s=match(),f=s.fighters[0];requestAttack(s,0,'jab');
  const base=gloveLocal(f,'L'),visualSamples=[];let handStartAt=null,footStartAt=null,lastVisual=null,launchVisual=null;
  for(let i=0;i<Math.ceil((MOVES.jab.cue+.2)/STEP);i++){
    tick(s,STEP,{cpuEnabled:false});
    const visual=visualGloveLocal(f,'L',s.time),progress=punchTravelProgress(f),foot=leadFootMotion(f);
    if(progress===0){visualSamples.push(visual);assert.deepEqual(gloveLocal(f,'L'),base);lastVisual=visual;}
    if(progress>0&&handStartAt===null){handStartAt=s.time;launchVisual=visual;}
    if(foot.forward>0&&footStartAt===null)footStartAt=s.time;
  }
  const drift=Math.max(...visualSamples.map(p=>p[1]))-Math.min(...visualSamples.map(p=>p[1]));
  assert.ok(drift>.02);assert.equal(handStartAt,footStartAt);assert.ok(handStartAt>=MOVES.jab.cue&&handStartAt<MOVES.jab.cue+STEP*1.1);
  assert.ok(gloveLocal(f,'L')[2]>base[2]);assert.ok(leadFootMotion(f).forward>0);
  assert.ok(Math.hypot(...launchVisual.map((v,i)=>v-lastVisual[i]))<.03);
});

test('A head jab aims at the middle of the face below the shared head target',()=>{
  const jab=match(),cross=match();requestAttack(jab,0,'jab','head');requestAttack(cross,0,'cross','head');
  jab.fighters[0].attack.t=jab.fighters[0].attack.wind-STEP/10;cross.fighters[0].attack.t=cross.fighters[0].attack.wind-STEP/10;
  const jabY=gloveLocal(jab.fighters[0],'L')[1],crossY=gloveLocal(cross.fighters[0],'R')[1];
  assert.ok(Math.abs(jabY-TARGET_HEIGHT.jabHead)<.001);assert.ok(Math.abs(crossY-TARGET_HEIGHT.head)<.001);
  assert.ok(Math.abs((TARGET_HEIGHT.head-TARGET_HEIGHT.jabHead)-.10)<.001);
  assert.equal(bodyTarget(jab.fighters[1],'head','jab')[1],TARGET_HEIGHT.jabHead);
});
test('A jab advances and lifts the lead foot with the glove, then returns it to stance',()=>{
  const s=match();requestAttack(s,0,'jab');run(s,3.3);
  const advancing=leadFootMotion(s.fighters[0]);
  assert.equal(advancing.phase,'advance');assert.ok(advancing.forward>.03&&advancing.forward<.08);assert.ok(advancing.lift>.012);
  run(s,.7);const planted=leadFootMotion(s.fighters[0]);
  assert.ok(Math.abs(planted.forward-JAB_LEAD_FOOT.forward)<.002);assert.ok(planted.lift<.002);
  run(s,.8);const returning=leadFootMotion(s.fighters[0]);
  assert.equal(returning.phase,'return');assert.ok(returning.forward>0&&returning.forward<JAB_LEAD_FOOT.forward);assert.ok(returning.lift>0);
  run(s,1.6);assert.deepEqual(leadFootMotion(s.fighters[0]),{forward:0,lift:0,phase:'ready'});
  const cross=match();requestAttack(cross,0,'cross');run(cross,4);assert.deepEqual(leadFootMotion(cross.fighters[0]),{forward:0,lift:0,phase:'ready'});
});
test('A jab starts the hip, chest, head and torso turn with the lead foot, then returns the body',()=>{
  const s=match(),f=s.fighters[0],startZ=f.z;requestAttack(s,0,'jab');run(s,2.6);
  assert.deepEqual(jabBodyMotion(f),{progress:0,phase:'ready',hipForward:0,chestForward:0,headForward:0,turn:-0});
  run(s,.2);const moving=jabBodyMotion(f),foot=leadFootMotion(f);
  assert.ok(moving.progress>0);assert.ok(Math.abs(moving.progress-foot.forward/JAB_LEAD_FOOT.forward)<1e-9);
  assert.ok(Math.abs(moving.hipForward-JAB_BODY.hipForward*moving.progress)<1e-9);assert.ok(Math.abs(moving.chestForward-JAB_BODY.chestForward*moving.progress)<1e-9);assert.ok(Math.abs(moving.headForward-JAB_BODY.headForward*moving.progress)<1e-9);assert.ok(moving.turn<0);
  run(s,1.2);const extended=jabBodyMotion(f);assert.ok(Math.abs(extended.hipForward-JAB_BODY.hipForward)<.0001);assert.ok(Math.abs(extended.chestForward-JAB_BODY.chestForward)<.0001);assert.ok(Math.abs(extended.headForward-JAB_BODY.headForward)<.0001);assert.ok(Math.abs(Math.abs(extended.turn)-JAB_BODY.turn)<.0001);
  run(s,2.3);assert.equal(f.z,startZ);assert.equal(jabBodyMotion(f).progress,0);
});
test('A parried jab returns its linked body motion with the interrupted lead foot',()=>{
  const s=match(),f=s.fighters[0],startZ=f.z;requestAttack(s,0,'jab');run(s,3);requestDefense(s,1,'R','parry');run(s,.7);
  const contact=jabBodyMotion(f);assert.equal(f.attack,null);assert.ok(contact.hipForward>JAB_BODY.hipForward*.7);assert.ok(contact.chestForward>JAB_BODY.chestForward*.7);
  run(s,.5);assert.ok(jabBodyMotion(f).progress>0);run(s,.7);assert.equal(jabBodyMotion(f).progress,0);assert.equal(f.z,startZ);
});
test('A parried jab returns the lead foot smoothly after the attacking arm is deflected',()=>{
  const s=match();requestAttack(s,0,'jab');run(s,3);requestDefense(s,1,'R','parry');run(s,.7);
  assert.equal(s.fighters[0].attack,null);assert.ok(leadFootMotion(s.fighters[0]).forward>.07);
  run(s,.5);assert.ok(leadFootMotion(s.fighters[0]).forward>0);
  run(s,.7);const recovered=leadFootMotion(s.fighters[0]);assert.equal(recovered.phase,'return');assert.ok(recovered.forward<1e-9&&recovered.lift<1e-9);
});
test('A small right downward tap can react after the jab is visible and parry after 80% travel',()=>{
  const reactive=match();requestAttack(reactive,0,'jab');run(reactive,3);assert.ok(reactive.fighters[0].attack.t>MOVES.jab.cue);requestDefense(reactive,1,'R','parry');run(reactive,1.1);
  assert.equal(reactive.fighters[1].hp,100);assert.equal(reactive.events.at(-1).defense,'parry');assert.match(reactive.events.at(-1).reason,/右手で進行約80%の拳を上から小さく叩き/);assert.ok(reactive.events.at(-1).punchProgress>=PARRY.contactProgress.jab&&reactive.events.at(-1).punchProgress<=PARRY.contactProgress.jab+PARRY.progressTolerance);
  const late=match();requestAttack(late,0,'jab');run(late,3.5);requestDefense(late,1,'R','parry');run(late,.7);assert.equal(late.events.at(-1).type,'hit');
});
test('A hook passes a parry while the required head block covers it',()=>{
  const parry=match();requestAttack(parry,0,'hookL');run(parry,7);requestDefense(parry,1,'R','parry');run(parry,.6);assert.equal(parry.events.at(-1).type,'hit');assert.notEqual(parry.events.at(-1).defense,'parry');
  const covered=match();defend(covered.fighters[1],'R','block');requestAttack(covered,0,'hookL');run(covered,7.6);assert.equal(covered.events.at(-1).type,'block');assert.equal(covered.fighters[1].hp,99);
});
test('A body punch requires body blocking by the opposing hand',()=>{
  const high=match();requestAttack(high,0,'cross','body');run(high,6.1);assert.equal(high.events.at(-1).type,'hit');
  const body=match();defend(body.fighters[1],'L','body');requestAttack(body,0,'cross','body');run(body,6.1);assert.equal(body.events.at(-1).type,'block');assert.match(body.events.at(-1).reason,/左手のお腹ブロッキング/);
});
test('The two hands can hold and move independent defense choices',()=>{
  const s=match();defend(s.fighters[0],'L','body');requestDefense(s,0,'R','parry');
  assert.equal(requestDefense(s,0,'L','block').ok,true);assert.equal(s.fighters[0].defense.L.to,'block');assert.equal(parryStatus(s.fighters[0],'R').phase,'prepare');
});
test('An attacking hand cannot simultaneously complete its defensive coverage',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,1,'hookR');run(s,4.1);assert.equal(s.events[0].type,'hit');assert.equal(s.events[0].reason,'打った手が戻っていない');
});
test('When punches collide, only the weaker arm is deflected and the stronger punch continues',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,1,'cross');run(s,3.5);
  assert.equal(s.events[0].type,'clash');assert.equal(s.events[0].who,1);assert.equal(s.events[0].loser,0);
  assert.equal(MOVES.cross.force>MOVES.jab.force,true);assert.equal(s.fighters[0].attack,null);assert.equal(s.fighters[1].attack.id,'cross');
  assert.ok(deflectionRemaining(s.fighters[0],'L')>ARM_DEFLECT_TU-.3);assert.equal(deflectionRemaining(s.fighters[0],'R'),0);
  assert.equal(requestAttack(s,0,'jab').ok,false);assert.match(s.fighters[0].lastReason,/左腕が弾かれている/);
  assert.equal(requestDefense(s,0,'L','body').ok,false);assert.equal(requestDefense(s,0,'R','body').ok,true);
  run(s,2.6);assert.equal(s.events.at(-1).type,'hit');assert.equal(s.events.at(-1).reason,'必要な腕が弾かれている');
  run(s,1.5);assert.equal(deflectionRemaining(s.fighters[0],'L'),0);assert.equal(requestAttack(s,0,'jab').ok,true);
});
test('Only the attacking glove continues forward and down; the tapping hand is not deflected',()=>{
  const s=match();requestAttack(s,0,'jab');run(s,3);requestDefense(s,1,'R','parry');run(s,.7);
  assert.equal(s.events.at(-1).type,'block');assert.match(s.events.at(-1).reason,/攻撃側の左拳を下へ弾いた/);
  assert.ok(deflectionRemaining(s.fighters[0],'L')>ARM_DEFLECT_TU-.2);assert.equal(deflectionRemaining(s.fighters[1],'R'),0);
  const from=s.fighters[0].deflection.L.from.slice();run(s,PARRY.deflectPeak);const redirected=gloveLocal(s.fighters[0],'L');assert.ok(redirected[2]-from[2]>=PARRY.deflectForward-.02);assert.ok(from[1]-redirected[1]>=PARRY.deflectDrop-.02);
  assert.equal(s.fighters[0].attack,null);assert.equal(requestDefense(s,0,'L','body').ok,false);assert.equal(requestDefense(s,1,'R','body').ok,false);assert.equal(requestAttack(s,1,'cross').ok,false);
  assert.equal(requestAttack(s,1,'jab').ok,true);run(s,4);assert.equal(requestDefense(s,1,'R','body').ok,true);assert.equal(requestAttack(s,1,'cross').ok,true);
});
test('Blocking absorbs a punch without deflecting either arm',()=>{
  const s=match();requestAttack(s,0,'jab');run(s,4.1);
  assert.equal(s.events.at(-1).type,'block');assert.match(s.events.at(-1).reason,/右手のブロッキング/);
  for(const f of s.fighters)for(const side of ['L','R'])assert.equal(deflectionRemaining(f,side),0);
  assert.ok(s.fighters[0].attack);assert.equal(requestDefense(s,1,'R','body').ok,true);
});
test('The deflected glove visibly moves away before returning to its selected defense',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,1,'cross');run(s,3.5);
  const from=s.fighters[0].deflection.L.from,atContact=gloveLocal(s.fighters[0],'L');run(s,.6);const thrown=gloveLocal(s.fighters[0],'L');
  assert.ok(Math.abs(thrown[0])>Math.abs(atContact[0]));assert.ok(thrown[1]<from[1]);
});
test('Equal-force punches deflect both colliding arms for the shorter provisional duration',()=>{
  const s=match();requestAttack(s,0,'hookL','body');run(s,1.4);requestAttack(s,1,'upperR','head');run(s,4);
  assert.equal(s.events[0].type,'clash');assert.equal(s.events[0].who,null);assert.match(s.events[0].reason,/両方の腕/);
  assert.ok(deflectionRemaining(s.fighters[0],'L')>0);assert.ok(deflectionRemaining(s.fighters[1],'R')>0);
  assert.equal(s.fighters[0].attack,null);assert.equal(s.fighters[1].attack,null);
});
test('An early feint creates no hit, costs resources, and must finish its return',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,2);const before=s.fighters[0].stamina;assert.equal(requestFeint(s,0).ok,true);assert.ok(s.fighters[0].stamina<before);assert.ok(s.fighters[0].attack);run(s,2);assert.equal(s.fighters[0].attack,null);run(s,7);assert.equal(s.events.length,0);
});
test('A late cancel is rejected and the punch still resolves once',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,4);assert.equal(requestFeint(s,0).ok,false);run(s,7);assert.equal(s.events.length,1);
});
test('Distance and head movement cause actual misses',()=>{
  const s=match();s.fighters[0].z=1;s.fighters[1].z=-1;requestAttack(s,0,'jab');run(s,4.1);assert.equal(s.events.at(-1).type,'miss');
  const d=match();defend(d.fighters[1],'R','body');requestAttack(d,0,'jab');run(d,1);requestSlip(d,1,'L');run(d,3.1);assert.equal(d.events.at(-1).type,'miss');assert.equal(d.events.at(-1).reason,'頭の位置が外れた');
});
test('Only one next action is buffered; it replaces the previous reservation',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,0,'cross');requestAttack(s,0,'hookL','body');assert.equal(s.fighters[0].attack.id,'jab');assert.equal(s.fighters[0].queue.id,'hookL');run(s,6.3);assert.equal(s.fighters[0].attack.id,'hookL');assert.equal(s.fighters[0].queue,null);
});
test('Attacks and footwork cannot start together; fighters never cross',()=>{
  const s=match();requestAttack(s,0,'cross');assert.equal(requestStep(s,0,'in').ok,false);
  const d=match();for(let i=0;i<15;i++){requestStep(d,0,'in');requestStep(d,1,'in');run(d,2.3);assert.ok(distance(d)>=.7199);assert.ok(d.fighters[0].z>d.fighters[1].z);}
});
test('Equal-time double KO is a draw; neither player is resolved first',()=>{
  const s=match();for(const f of s.fighters){f.hp=4;defend(f,'R','body');}requestAttack(s,0,'jab');requestAttack(s,1,'jab');run(s,4.2);assert.equal(s.winner,'draw');assert.deepEqual(s.fighters.map(f=>f.hp),[0,0]);assert.equal(s.events.length,2);
});
test('CPU observation contains neither private reservations nor early move identity',()=>{
  const s=match();requestAttack(s,0,'cross','body');requestAttack(s,0,'hookR');const o=observeOpponent(s,1);assert.equal(o.action.kind,null);assert.equal(o.action.target,null);assert.deepEqual(o.deflection,{L:0,R:0});assert.equal('queue' in o,false);assert.equal('id' in o.action,false);assert.equal('stamina' in o,false);
});
test('Pause freezes everything; invalid input is rejected',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,1);pauseMatch(s);const before=JSON.stringify(s);run(s,8);assert.equal(JSON.stringify(s),before);assert.equal(requestAttack(s,0,'jab').ok,false);assert.equal(requestAttack(s,0,'missing').ok,false);
});
test('CPU is deterministic with a fixed seed, stays finite and finishes the round',()=>{
  const a=match({duration:80,seed:77}),b=match({duration:80,seed:77});run(a,81,true);run(b,81,true);assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(a.phase,'ended');assert.ok(a.eventId>0);for(const f of a.fighters){assert.ok(f.hp>=0&&f.hp<=100);assert.ok(f.stamina>=0&&f.stamina<=100);assert.ok(Number.isFinite(f.z));}
});
test('Each hand moves straight up 5.5cm, taps down 8cm with no inward shift, then returns',()=>{
  const s=match(),f=s.fighters[0];defend(f,'L','body');
  const before={L:gloveLocal(f,'L'),R:gloveLocal(f,'R')};
  for(const side of ['L','R']){requestDefense(s,0,side,'parry');assert.deepEqual(gloveLocal(f,side),before[side]);assert.equal(currentDefense(f,side),'open');}
  run(s,PARRY.prepare);const above={L:gloveLocal(f,'L'),R:gloveLocal(f,'R')};for(const side of ['L','R']){assert.ok(Math.abs((above[side][1]-before[side][1])-PARRY.lift)<.001);assert.ok(Math.abs(above[side][0]-before[side][0])<.001);}
  run(s,PARRY.tap);const tapped={L:gloveLocal(f,'L'),R:gloveLocal(f,'R')};
  assert.equal(parryStatus(f,'L').phase,'return');for(const side of ['L','R']){assert.ok(Math.abs((above[side][1]-tapped[side][1])-(PARRY.lift+PARRY.tapBelowGuard))<.001);assert.ok(Math.abs(tapped[side][0]-above[side][0])<.001);}
  assert.ok(tapped.L[2]>tapped.R[2]);assert.equal(currentDefense(f,'L'),'open');
  run(s,PARRY.recover+.1);assert.equal(f.parry.L,null);assert.equal(f.parry.R,null);assert.equal(currentDefense(f,'L'),'body');assert.equal(currentDefense(f,'R'),'block');assert.deepEqual(gloveLocal(f,'L'),before.L);
});
test('A parry cannot be refreshed or cancelled by attacks or guards, and a whiff still costs stamina',()=>{
  const s=match(),f=s.fighters[0];requestDefense(s,0,'R','parry');assert.equal(f.stamina,100-PARRY.cost);run(s,.1);
  const action=f.parry.R,elapsed=action.t,stamina=f.stamina;
  for(const mode of ['parry','block','body'])assert.equal(requestDefense(s,0,'R',mode).ok,false);
  assert.equal(requestAttack(s,0,'cross').ok,false);assert.equal(requestFeint(s,0).ok,false);assert.equal(f.parry.R,action);assert.equal(action.t,elapsed);assert.equal(f.stamina,stamina);
  pauseMatch(s);const before=JSON.stringify(s);run(s,8);assert.equal(JSON.stringify(s),before);startMatch(s);run(s,1.6);assert.equal(f.parry.R,null);assert.ok(f.stamina<100);assert.equal(s.events.length,0);
});
test('An early parry finishes before the jab arrives; a wrong-side parry does not cover the punch',()=>{
  const early=match();requestAttack(early,0,'jab');requestDefense(early,1,'R','parry');run(early,4.1);assert.equal(early.events.at(-1).defense,'block');assert.equal(early.fighters[1].hp,99);
  const wrong=match();defend(wrong.fighters[1],'R','body');requestAttack(wrong,0,'jab');run(wrong,3);requestDefense(wrong,1,'L','parry');run(wrong,1.1);assert.equal(wrong.events.at(-1).type,'hit');assert.equal(wrong.fighters[0].deflection.L,null);
});
test('A separately timed left parry catches a right straight; body and uppercut punches are outside its coverage',()=>{
  const straight=match();requestAttack(straight,0,'cross');run(straight,4);requestDefense(straight,1,'L','parry');run(straight,2.1);assert.equal(straight.events.at(-1).defense,'parry');assert.equal(straight.fighters[1].hp,100);
  for(const [move,target,delay] of [['cross','body',4],['upperR','head',5]]){
    const s=match();if(move==='upperR'){s.fighters[0].z=.55;s.fighters[1].z=-.55;}requestAttack(s,0,move,target);run(s,delay);requestDefense(s,1,'L','parry');run(s,2.2);assert.equal(s.events.at(-1).type,'hit');assert.equal(s.fighters[0].deflection.R,null);
  }
});
test('Active timing alone cannot parry a distant glove, nor intercept again after one success',()=>{
  const far=match();far.fighters[0].z=1;far.fighters[1].z=-1;requestAttack(far,0,'jab');run(far,3);requestDefense(far,1,'R','parry');run(far,1.1);assert.equal(far.events.at(-1).type,'miss');assert.equal(far.fighters[1].parry.R.used,false);
  const s=match();requestAttack(s,0,'jab');run(s,3);requestDefense(s,1,'R','parry');run(s,.7);assert.equal(s.fighters[1].parry.R.used,true);run(s,8);assert.equal(s.events.length,1);assert.equal(s.fighters[1].stats.blocks,1);
});
test('A parry clears only its own queued punch and cannot interrupt a punch already in motion',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,0,'cross');assert.equal(requestDefense(s,0,'L','parry').ok,false);assert.equal(requestDefense(s,0,'R','parry').ok,true);assert.equal(s.fighters[0].queue,null);assert.equal(s.fighters[0].attack.id,'jab');
  requestAttack(s,0,'hookL');assert.equal(s.fighters[0].queue.id,'hookL');
  const tired=match();tired.fighters[0].stamina=4;assert.equal(requestDefense(tired,0,'L','parry').ok,false);assert.equal(tired.fighters[0].parry.L,null);
});
test('A feint can spend the opponent\'s parry without producing a contact',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,3);requestDefense(s,1,'L','parry');run(s,.25);requestFeint(s,0);run(s,.6);
  assert.equal(s.events.length,0);assert.ok(s.fighters[0].attack?.feint);assert.equal(parryStatus(s.fighters[1],'L').phase,'return');assert.equal(currentDefense(s.fighters[1],'L'),'open');
});
test('Simultaneous successful parries use one shared pre-contact state',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,1,'jab');run(s,3);requestDefense(s,0,'R','parry');requestDefense(s,1,'R','parry');run(s,.7);
  assert.equal(s.events.length,2);assert.equal(s.events[0].time,s.events[1].time);for(const f of s.fighters){assert.ok(f.deflection.L);assert.equal(f.deflection.R,null);assert.equal(f.parry.R.used,true);assert.equal(f.hp,100);}
});
test('CPU can react to a publicly visible jab after its reaction delay without reading private input',()=>{
  const s=match({seed:77});requestAttack(s,0,'jab','head');run(s,MOVES.jab.cue,true);assert.equal(s.fighters[1].parry.R,null);
  run(s,CPU_REACTION_DELAY+.35,true);assert.ok(s.ai.latest.action.kind);assert.equal(s.ai.latest.action.target,'head');assert.ok(s.fighters[1].parry.R);
});
