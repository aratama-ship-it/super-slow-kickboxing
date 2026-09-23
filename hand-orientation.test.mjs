import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.min.js';
import {MOVES,PARRY,STEP,createMatch,startMatch,tick,requestAttack,requestDefense,requestFeint} from './core.mjs';
import {handTurnAmount,gloveOrientation,forearmOrientation} from './hand-orientation.mjs';
import {addReferenceGlove} from './reference-look.mjs';

const orientation=(f,side)=>gloveOrientation(side,handTurnAmount({
  attack:f.attack&&MOVES[f.attack.id].side===side?f.attack:null,deflection:f.deflection[side],parry:f.parry[side],...PARRY,
}));
const palm=q=>new THREE.Vector3(0,0,-1).applyQuaternion(q);
const near=(actual,expected)=>assert(actual.distanceTo(new THREE.Vector3(...expected))<1e-6);
const run=(state,duration,check=()=>{})=>{for(let n=0;n<Math.round(duration/STEP);n++){tick(state,STEP,{cpuEnabled:false});check();}};
const match=()=>{const s=createMatch();startMatch(s);return s;};
const continuous=(f,side)=>{let prev=orientation(f,side);return ()=>{const next=orientation(f,side);assert(prev.angleTo(next)<.4,'rotation must not snap between simulation ticks');prev=next;};};

test('Both fighters guard with palms facing each other',()=>{
  for(const f of createMatch().fighters){near(palm(orientation(f,'L')),[-1,0,0]);near(palm(orientation(f,'R')),[1,0,0]);}
});
test('Glove thumbs match the hand: inward when palm-down, towards the wearer in guard',()=>{
  for(const side of ['L','R']){
    const glove=new THREE.Group(),material=new THREE.MeshStandardMaterial();
    addReferenceGlove(glove,material,material,side);
    const thumb=glove.getObjectByName('thumb-pad');assert(thumb);
    glove.quaternion.copy(gloveOrientation(side,0));glove.updateMatrixWorld(true);
    assert(thumb.getWorldPosition(new THREE.Vector3()).z<0,'guard thumb must be on the wearer side');
    glove.quaternion.copy(gloveOrientation(side,1));glove.updateMatrixWorld(true);
    assert(thumb.getWorldPosition(new THREE.Vector3()).x*(side==='L'?1:-1)<0,'palm-down thumb must face the body centre');
  }
});
test('All six punches turn palm down and return smoothly, preserving the other hand',()=>{
  for(const [id,move] of Object.entries(MOVES))for(const target of ['head','body']){
    const s=match(),f=s.fighters[0],other=move.side==='L'?'R':'L';requestAttack(s,0,id,target);
    const check=continuous(f,move.side);
    run(s,move.wind,check);assert(palm(orientation(f,move.side)).y<-.999,id);
    near(palm(orientation(f,other)),[other==='L'?-1:1,0,0]);
    run(s,move.recover+.1,check);assert.equal(f.attack,null);near(palm(orientation(f,move.side)),[move.side==='L'?-1:1,0,0]);
  }
});
test('Jab has no new rotation tell before its existing extension cue',()=>{
  const s=match(),f=s.fighters[0];requestAttack(s,0,'jab');
  run(s,MOVES.jab.cue-STEP,()=>near(palm(orientation(f,'L')),[-1,0,0]));
});
test('Every punch keeps turning through its entire forward stroke, including fatigue',()=>{
  for(const [id,move] of Object.entries(MOVES))for(const target of ['head','body'])for(const stamina of [100,25]){
    const s=match(),f=s.fighters[0];f.stamina=stamina;assert(requestAttack(s,0,id,target).ok);
    const a=f.attack,cue=move.cue*(a.wind/move.wind),rest=orientation(f,move.side),end=gloveOrientation(move.side,1);
    a.t=cue*.9;assert(rest.angleTo(orientation(f,move.side))<1e-6,'chambering must not finish the twist');
    let previous=0;
    for(const phase of [.25,.5,.75,.9]){
      a.t=cue+(a.wind-cue)*phase;
      const q=orientation(f,move.side),turned=rest.angleTo(q)/rest.angleTo(end);
      assert(turned>previous&&turned<.995,`${id} must still be turning at ${phase}`);
      if(phase===.5)assert(turned>.4&&turned<.6,'halfway extension must have an intermediate wrist angle');
      previous=turned;
    }
    a.t=a.wind;near(palm(orientation(f,move.side)),[0,-1,0]);
  }
});
test('Left and right parries turn down during preparation, hold, then return inward',()=>{
  for(const side of ['L','R']){
    const s=match(),f=s.fighters[0];requestDefense(s,0,side,'parry');const check=continuous(f,side);
    run(s,.2,check);near(palm(orientation(f,side)),[0,-1,0]);
    run(s,.5,()=>{check();near(palm(orientation(f,side)),[0,-1,0]);});
    run(s,1,check);assert.equal(f.parry[side],null);near(palm(orientation(f,side)),[side==='L'?-1:1,0,0]);
  }
});
test('Feints and parried punches do not snap their palm orientation on interruption',()=>{
  const s=match(),f=s.fighters[0];requestAttack(s,0,'cross');const check=continuous(f,'R');
  run(s,2.8,check);assert(requestFeint(s,0).ok);check();run(s,2,check);near(palm(orientation(f,'R')),[1,0,0]);
  const p=match(),attacker=p.fighters[1];requestAttack(p,1,'jab');const follow=continuous(attacker,'L');
  run(p,3,follow);requestDefense(p,0,'R','parry');run(p,.7,follow);
  assert(attacker.deflection.L);run(p,4.1,follow);near(palm(orientation(attacker,'L')),[-1,0,0]);
});
test('Forearm turns around its length while its axis still connects elbow to wrist',()=>{
  for(const side of ['L','R'])for(const amount of [0,.25,.5,.75,1]){
    const elbow=[side==='L'?.12:-.12,1.2,.08],wrist=[side==='L'?.2:-.2,1.5,.3];
    const p=palm(gloveOrientation(side,amount)),q=forearmOrientation(elbow,wrist,p);
    const axis=new THREE.Vector3(...wrist).sub(new THREE.Vector3(...elbow)).normalize();
    near(new THREE.Vector3(0,1,0).applyQuaternion(q),axis.toArray());
    assert(new THREE.Vector3(0,0,-1).applyQuaternion(q).dot(p)>.3);
  }
});
