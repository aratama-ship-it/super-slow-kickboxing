import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,startMatch,pauseMatch,tick,STEP,STANCES,stanceRole,restingGlove,requestAttack,requestGuard,requestFeint,requestStep,requestSlip,observeOpponent,distance} from './core.mjs';
const run=(s,t,cpuEnabled=false)=>{for(let i=0;i<Math.round(t/STEP);i++)tick(s,STEP,{cpuEnabled});};
const match=options=>{const s=createMatch(options);startMatch(s);return s;};
const guard=(f,mode)=>{f.guard={from:mode,to:mode,t:3};};
test('Orthodox stance keeps the left hand forward and the right hand rear in every guard',()=>{
  const s=createMatch();
  assert.deepEqual(STANCES.orthodox,{name:'オーソドックス',lead:'L',rear:'R'});
  for(const f of s.fighters){
    assert.equal(f.stance,'orthodox');assert.equal(stanceRole(f,'L'),'lead');assert.equal(stanceRole(f,'R'),'rear');
    for(const mode of ['high','shell','body','open']){guard(f,mode);assert.ok(restingGlove(f,'L')[2]>restingGlove(f,'R')[2],mode+' guard must keep the left glove forward');}
  }
});
test('A guard placed before a jab blocks it; a guard begun after identification is too late',()=>{
  const pre=match();requestAttack(pre,0,'jab');run(pre,4.1);assert.equal(pre.fighters[1].hp,100);assert.equal(pre.events.at(-1).type,'block');
  const late=match();guard(late.fighters[1],'body');requestAttack(late,0,'jab');run(late,2.8);requestGuard(late,1,'high');run(late,1.3);assert.equal(late.fighters[1].hp,96);assert.equal(late.events.at(-1).reason,'守りを移している途中');
});
test('Hook defeats front-only coverage while a preplaced shell covers it',()=>{
  const open=match();requestAttack(open,0,'hookL');run(open,7.6);assert.equal(open.events.at(-1).type,'hit');
  const covered=match();guard(covered.fighters[1],'shell');requestAttack(covered,0,'hookL');run(covered,7.6);assert.equal(covered.events.at(-1).type,'block');assert.equal(covered.fighters[1].hp,99);
});
test('Body targeting requires body cover',()=>{
  const high=match();requestAttack(high,0,'cross','body');run(high,6.1);assert.equal(high.events.at(-1).type,'hit');
  const body=match();guard(body.fighters[1],'body');requestAttack(body,0,'cross','body');run(body,6.1);assert.equal(body.events.at(-1).type,'block');
});
test('An attacking hand cannot simultaneously complete its defensive coverage',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,1,'cross');run(s,4.1);assert.equal(s.events[0].type,'hit');assert.equal(s.events[0].reason,'打った手が戻っていない');
});
test('An early feint creates no hit, costs resources, and must finish its return',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,2);const before=s.fighters[0].stamina;assert.equal(requestFeint(s,0).ok,true);assert.ok(s.fighters[0].stamina<before);assert.ok(s.fighters[0].attack);run(s,2);assert.equal(s.fighters[0].attack,null);run(s,7);assert.equal(s.events.length,0);
});
test('A late cancel is rejected and the punch still resolves once',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,4);assert.equal(requestFeint(s,0).ok,false);run(s,7);assert.equal(s.events.length,1);
});
test('Distance and head movement cause actual misses',()=>{
  const s=match();s.fighters[0].z=1;s.fighters[1].z=-1;requestAttack(s,0,'jab');run(s,4.1);assert.equal(s.events.at(-1).type,'miss');
  const d=match();guard(d.fighters[1],'open');requestAttack(d,0,'jab');run(d,1);requestSlip(d,1,'L');run(d,3.1);assert.equal(d.events.at(-1).type,'miss');assert.equal(d.events.at(-1).reason,'頭の位置が外れた');
});
test('Only one next action is buffered; it replaces the previous reservation',()=>{
  const s=match();requestAttack(s,0,'jab');requestAttack(s,0,'cross');requestAttack(s,0,'hookL','body');assert.equal(s.fighters[0].attack.id,'jab');assert.equal(s.fighters[0].queue.id,'hookL');run(s,6.3);assert.equal(s.fighters[0].attack.id,'hookL');assert.equal(s.fighters[0].queue,null);
});
test('Attacks and footwork cannot start together; fighters never cross',()=>{
  const s=match();requestAttack(s,0,'cross');assert.equal(requestStep(s,0,'in').ok,false);
  const d=match();for(let i=0;i<15;i++){requestStep(d,0,'in');requestStep(d,1,'in');run(d,2.3);assert.ok(distance(d)>=.7199);assert.ok(d.fighters[0].z>d.fighters[1].z);}
});
test('Equal-time double KO is a draw; neither player is resolved first',()=>{
  const s=match();for(const f of s.fighters){f.hp=4;guard(f,'body');}requestAttack(s,0,'jab');requestAttack(s,1,'jab');run(s,4.2);assert.equal(s.winner,'draw');assert.deepEqual(s.fighters.map(f=>f.hp),[0,0]);assert.equal(s.events.length,2);
});
test('CPU observation contains neither private reservations nor early move identity',()=>{
  const s=match();requestAttack(s,0,'cross','body');requestAttack(s,0,'hookR');const o=observeOpponent(s,1);assert.equal(o.action.kind,null);assert.equal(o.action.target,null);assert.equal('queue' in o,false);assert.equal('id' in o.action,false);assert.equal('stamina' in o,false);
});
test('Pause freezes everything; invalid input is rejected',()=>{
  const s=match();requestAttack(s,0,'cross');run(s,1);pauseMatch(s);const before=JSON.stringify(s);run(s,8);assert.equal(JSON.stringify(s),before);assert.equal(requestAttack(s,0,'jab').ok,false);assert.equal(requestAttack(s,0,'missing').ok,false);
});
test('CPU is deterministic with a fixed seed, stays finite and finishes the round',()=>{
  const a=match({duration:80,seed:77}),b=match({duration:80,seed:77});run(a,81,true);run(b,81,true);assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(a.phase,'ended');assert.ok(a.eventId>0);for(const f of a.fighters){assert.ok(f.hp>=0&&f.hp<=100);assert.ok(f.stamina>=0&&f.stamina<=100);assert.ok(Number.isFinite(f.z));}
});
