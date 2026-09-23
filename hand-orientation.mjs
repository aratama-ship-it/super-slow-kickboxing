import * as THREE from './vendor/three.module.min.js';

// Glove geometry: +Y runs from cuff to knuckles, -Z is the palm surface.
export const HAND_TURN=Object.freeze({punchTravel:.32,forearmWidth:.94,forearmDepth:1.03,wrist:Object.freeze([0,-.197,-.015])});
const smooth=value=>{const u=Math.max(0,Math.min(1,value));return u*u*(3-2*u);};
const down=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0)));

export function handTurnAmount({travel=0,active=false,deflected=false,parry=null,prepare=.18,tap=.55,recover=.9}){
  if(parry){
    if(parry.t<prepare)return smooth(parry.t/prepare);
    return 1-smooth((parry.t-prepare-tap)/recover);
  }
  return active||deflected?smooth(travel/HAND_TURN.punchTravel):0;
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
