import * as THREE from './vendor/three.module.min.js';
import {MOVES,PARRY} from './core.mjs?v=0.46';

// Glove geometry: +Y runs from cuff to knuckles, -Z is the palm surface.
export const HAND_TURN=Object.freeze({parryTurnTapRatio:.5,forearmWidth:.94,forearmDepth:1.03,wrist:Object.freeze([0,-.197,-.015])});
const smooth=value=>{const u=Math.max(0,Math.min(1,value));return u*u*(3-2*u);};
const down=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0)));

function punchTurn(attack){
  if(!attack)return 0;
  if(attack.feint)return punchTurn({...attack,feint:false,t:attack.feintStart})*(1-smooth((attack.t-attack.feintStart)/attack.feintDuration));
  if(attack.blocked){
    const b=attack.blocked,contactTurn=punchTurn({...attack,blocked:null,t:b.startT});
    return contactTurn*(1-smooth((attack.t-b.startT-b.hold)/b.returnDuration));
  }
  if(attack.t>=attack.wind)return 1-smooth((attack.t-attack.wind)/attack.recover);
  const move=MOVES[attack.id],cue=move.cue*(attack.wind/move.wind);
  return smooth((attack.t-cue)/(attack.wind-cue));
}

export function handTurnAmount({attack=null,deflection=null,parry=null,prepare=.18,tap=.55,recover=.9}){
  if(deflection)return punchTurn(deflection.interruptedAttack)*(1-smooth(deflection.t/deflection.duration));
  if(parry){
    // Spread the twist into the downward tap instead of snapping during the lift.
    if(parry.t<prepare+tap)return smooth(parry.t/(prepare+tap*HAND_TURN.parryTurnTapRatio));
    return 1-smooth((parry.t-prepare-tap)/recover);
  }
  return punchTurn(attack);
}

export function gloveOrientation(side,amount){
  const sign=side==='L'?1:-1;
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),sign*Math.PI/2).slerp(down,amount);
}

export function forearmOrientation(elbow,hand,palm){
  const axis=new THREE.Vector3(...hand).sub(new THREE.Vector3(...elbow)).normalize();
  const back=palm.clone().negate().addScaledVector(axis,palm.dot(axis)).normalize();
  if(back.lengthSq()<1e-8)back.set(0,0,1).addScaledVector(axis,-axis.z).normalize();
  const across=new THREE.Vector3().crossVectors(axis,back).normalize();
  back.crossVectors(across,axis).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,axis,back));
}


export const PARRY_ARM=Object.freeze({elbowBack:.16,elbowLift:.13,elbowOut:.03,tapElbowBack:.05,tapElbowOut:.045,tapDrop:.04,iterations:24});

export function parryTapAmount({parry=null,prepare=.18,tap=.55,recover=.9}){
  if(!parry)return 0;
  if(parry.t<prepare+tap)return smooth((parry.t-prepare)/tap);
  return 1-smooth((parry.t-prepare-tap)/recover);
}

// Solve from the shoulder through the elbow to the cuff. The glove follows
// the forearm instead of forcing a horizontal palm onto a vertical forearm.
export function parryArmPose({side,shoulder,baseShoulder=shoulder,baseHand,baseElbow,hand,turn,tapAmount=0}){
  const vector=values=>new THREE.Vector3(...values),root=vector(shoulder),target=vector(hand);
  // Cancel the tap's forward drift while the elbow retracts and forearm tips.
  target.y-=PARRY_ARM.tapDrop*tapAmount;
  target.z-=(PARRY.tapForward-PARRY.prepareForward)*tapAmount;
  const rest=gloveOrientation(side,0),startElbow=vector(baseElbow);
  const startWrist=vector(HAND_TURN.wrist).applyQuaternion(rest).add(vector(baseHand));
  const upperLength=startElbow.distanceTo(vector(baseShoulder)),forearmLength=startElbow.distanceTo(startWrist);
  const pole=startElbow.clone().add(new THREE.Vector3((side==='L'?1:-1)*PARRY_ARM.elbowOut,PARRY_ARM.elbowLift,-PARRY_ARM.elbowBack).multiplyScalar(turn));
  pole.add(new THREE.Vector3((side==='L'?1:-1)*PARRY_ARM.tapElbowOut,0,-PARRY_ARM.tapElbowBack).multiplyScalar(tapAmount));
  let elbow=startElbow.clone(),quaternion=rest.clone(),wrist;
  for(let n=0;n<PARRY_ARM.iterations;n++){
    const aligned=forearmOrientation(elbow.toArray(),target.toArray(),new THREE.Vector3(0,0,1));
    quaternion.copy(rest).slerp(aligned,turn);
    wrist=vector(HAND_TURN.wrist).applyQuaternion(quaternion).add(target);
    const axis=wrist.clone().sub(root),distance=axis.length();axis.normalize();
    const reach=Math.max(Math.abs(upperLength-forearmLength)+1e-6,Math.min(upperLength+forearmLength-1e-6,distance));
    if(Math.abs(reach-distance)>1e-8){const offset=axis.clone().multiplyScalar(reach-distance);wrist.add(offset);target.add(offset);}
    const along=(upperLength*upperLength-forearmLength*forearmLength+reach*reach)/(2*reach);
    const height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
    const bend=pole.clone().sub(root);bend.addScaledVector(axis,-bend.dot(axis));
    if(bend.lengthSq()<1e-10)bend.set(side==='L'?1:-1,0,0).addScaledVector(axis,-axis.x*(side==='L'?1:-1));
    elbow.copy(root).addScaledVector(axis,along).addScaledVector(bend.normalize(),height);
  }
  return {hand:target.toArray(),elbow:elbow.toArray(),wrist:wrist.toArray(),quaternion,upperLength,forearmLength};
}
