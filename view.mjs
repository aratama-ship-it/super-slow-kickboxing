import * as THREE from './vendor/three.module.min.js';
import {MOVES,gloveLocal,slipOffset,localToWorld,stanceAngles,parryStatus,clamp} from './core.mjs?v=0.12';

export function createView(container){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#172a2c');scene.fog=new THREE.Fog('#172a2c',5,16);
  const camera=new THREE.PerspectiveCamera(78,1,.04,40);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.setAttribute('aria-label','一人称のボクシング。赤い自分のグローブと、青いグローブの相手を表示');
  renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#f1eee1','#354744',2.2));
  const key=new THREE.DirectionalLight('#fff2d7',3.8);key.position.set(-3,6,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:14});key.shadow.bias=-.001;scene.add(key);
  const fill=new THREE.DirectionalLight('#bdd7d3',1.6);fill.position.set(3,3,-4);scene.add(fill);
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.73,metalness:.02,...extra});
  const skin=material('#c6c2b1'),seams=material('#8d978c'),red=material('#a33c2c'),green=material('#347b68'),selfGlove=material('#c74a3a'),opponentGlove=material('#3f7fbe'),ivory=material('#ece9dd'),shorts=material('#4b605b'),boots=material('#253b3a');
  const sphere=new THREE.SphereGeometry(1,24,16),cylinder=new THREE.CylinderGeometry(1,1,1,16);
  const mesh=(geometry,mat,parent)=>{const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const ellipsoid=(parent,mat,xyz,scale)=>{const m=mesh(sphere,mat,parent);m.position.set(...xyz);m.scale.set(...scale);return m;};
  const segment=(parent,mat,r1,r2)=>mesh(new THREE.CylinderGeometry(r2,r1,1,16),mat,parent);
  const setSegment=(m,a,b)=>{const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);m.position.copy(va.add(vb).multiplyScalar(.5));m.scale.y=d.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());};
  const rotateXZ=(x,z,yaw)=>[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
  const floor=mesh(new THREE.PlaneGeometry(24,24),material('#354e49'),scene);floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.castShadow=false;
  const mat=mesh(new THREE.BoxGeometry(6.4,.08,6.4),material('#587067'),scene);mat.position.y=-.05;mat.castShadow=false;
  const ring=mesh(new THREE.RingGeometry(.8,.812,96),ivory,scene);ring.rotation.x=-Math.PI/2;ring.position.y=.001;ring.castShadow=false;
  for(const x of [-3,3])for(const z of [-3,3]){
    const post=mesh(new THREE.CylinderGeometry(.06,.07,1.55,16),z<0?red:green,scene);post.position.set(x,.75,z);
    for(const y of [.52,.86,1.2]){const rope=segment(scene,ivory,.018,.018);setSegment(rope,[x,y,-3],[x,y,3]);}
  }
  for(const z of [-3,3])for(const y of [.52,.86,1.2]){const rope=segment(scene,ivory,.018,.018);setSegment(rope,[-3,y,z],[3,y,z]);}
  for(const x of [-7,-4,4,7]){
    const beam=mesh(new THREE.BoxGeometry(.12,6,.12),material('#28413f'),scene);beam.position.set(x,2.7,-7);
  }
  const rear=mesh(new THREE.BoxGeometry(20,7,.15),material('#213634'),scene);rear.position.set(0,3,-8);
  const actors=[];
  for(let index=0;index<2;index++){
    const root=new THREE.Group();scene.add(root);const a={root,torso:null,arms:{},gloves:{},elbows:{},shoulders:{},legs:[],head:null,chest:null};
    const player=index===0,gloveMat=(player?selfGlove:opponentGlove).clone();a.gloveMat=gloveMat;
    if(!player){
      a.torso=new THREE.Group();root.add(a.torso);
      const profile=[[.0,.18],[.06,.22],[.19,.25],[.33,.34],[.43,.33],[.48,.26]].map(([y,r])=>new THREE.Vector2(r,y));
      a.chest=mesh(new THREE.LatheGeometry(profile,32),skin,a.torso);a.chest.position.y=.96;a.chest.scale.z=.64;
      ellipsoid(a.torso,skin,[.14,1.3,.11],[.17,.12,.10]);ellipsoid(a.torso,skin,[-.14,1.3,.11],[.17,.12,.10]);
      const neck=mesh(new THREE.CylinderGeometry(.075,.1,.15,20),skin,a.torso);neck.position.set(0,1.47,0);
      a.head=new THREE.Group();a.head.position.y=1.65;root.add(a.head);
      ellipsoid(a.head,skin,[0,0,0],[.15,.205,.165]);ellipsoid(a.head,skin,[0,-.13,.035],[.105,.08,.115]);
      ellipsoid(a.head,skin,[.15,-.035,0],[.025,.05,.04]);ellipsoid(a.head,skin,[-.15,-.035,0],[.025,.05,.04]);
      ellipsoid(a.head,skin,[0,-.015,.157],[.02,.045,.018]);
      const pelvis=mesh(new THREE.CylinderGeometry(.205,.26,.27,24),shorts,a.torso);pelvis.position.y=.87;pelvis.scale.z=.72;
      const belt=mesh(new THREE.CylinderGeometry(.208,.218,.055,24),ivory,a.torso);belt.position.y=1.005;belt.scale.z=.74;
      for(const side of ['L','R']){
        const sign=side==='L'?1:-1,hip=[sign*.15,.83,0],knee=[sign*.19,.48,sign*.1],foot=[sign*.21,.12,sign*.15];
        const thigh=segment(root,skin,.12,.085),shin=segment(root,skin,.085,.055);setSegment(thigh,hip,knee);setSegment(shin,knee,foot);
        const kneeJoint=ellipsoid(root,skin,knee,[.086,.082,.085]),boot=ellipsoid(root,boots,[foot[0],.075,foot[2]+.06],[.095,.075,.17]);
        const hem=mesh(new THREE.CylinderGeometry(.145,.133,.16,20),shorts,root);hem.position.set(sign*.14,.78,0);
        a.legs.push({side,thigh,shin,kneeJoint,boot,hem});
      }
    }
    for(const side of ['L','R']){
      a.shoulders[side]=ellipsoid(root,skin,[0,0,0],[.115,.12,.125]);
      a.shoulders[side].visible=!player;
      const upper=segment(root,skin,.095,.075),forearm=segment(root,skin,.08,.055);a.arms[side]={upper,forearm};
      a.elbows[side]=ellipsoid(root,seams,[0,0,0],[.067,.067,.067]);
      const glove=new THREE.Group();root.add(glove);a.gloves[side]=glove;
      ellipsoid(glove,gloveMat,[0,0,.025],[.13,.145,.16]);
      ellipsoid(glove,gloveMat,[side==='L'?-.075:.075,-.035,.055],[.065,.09,.105]);
      const cuff=mesh(new THREE.CylinderGeometry(.084,.077,.1,20),gloveMat,glove);cuff.position.set(0,-.13,-.03);
      const tape=mesh(new THREE.CylinderGeometry(.087,.087,.028,20),ivory,glove);tape.position.set(0,-.12,-.03);
    }
    actors.push(a);
  }
  let lastState=null;
  function render(s){
    lastState=s;
    for(let i=0;i<2;i++){
      const f=s.fighters[i],a=actors[i];a.root.position.set(0,0,f.z);a.root.rotation.y=f.face===1?0:Math.PI;
      const attack=f.attack,m=attack?MOVES[attack.id]:null;
      const drive=attack&&!attack.feint?Math.sin(Math.PI*clamp(attack.t/(attack.wind+attack.recover),0,1))*.1:0;
      const headX=slipOffset(f),angles=stanceAngles(f);
      if(a.torso)a.torso.rotation.y=angles.bodyYaw;
      if(a.head){a.head.position.x=headX;a.head.rotation.z=-headX*.3;a.head.position.z=drive*.35;a.chest.rotation.z=-headX*.12;}
      for(const leg of a.legs){
        const sign=leg.side==='L'?1:-1;
        const [hipX,hipZ]=rotateXZ(sign*.15,0,angles.bodyYaw),[kneeX,kneeZ]=rotateXZ(sign*.19,.02,angles.bodyYaw),[footX,footZ]=rotateXZ(sign*.26,.03,angles.bodyYaw);
        const hip=[hipX,.83,hipZ],knee=[kneeX,.48,kneeZ],foot=[footX,.12,footZ];
        const [toeX,toeZ]=rotateXZ(0,.06,angles.feetYaw);
        setSegment(leg.thigh,hip,knee);setSegment(leg.shin,knee,foot);leg.kneeJoint.position.set(...knee);
        leg.boot.position.set(foot[0]+toeX,.075,foot[2]+toeZ);leg.boot.rotation.y=angles.feetYaw;
        leg.hem.position.set(hip[0],.78,hip[2]);leg.hem.rotation.y=angles.bodyYaw;
      }
      for(const side of ['L','R']){
        const sign=side==='L'?1:-1,hand=gloveLocal(f,side),[shoulderX,shoulderZ]=rotateXZ(sign*.3,0,angles.bodyYaw);
        const shoulder=[shoulderX+headX*.3,1.39,drive+shoulderZ];
        a.shoulders[side].position.set(...shoulder);
        const active=attack&&m.side===side;
        const elbow=[(shoulder[0]+hand[0])*.5+sign*(active&&m.kind==='hook'?.16:.085),Math.min(shoulder[1],hand[1])-.17,(shoulder[2]+hand[2])*.5-.09];
        setSegment(a.arms[side].upper,shoulder,elbow);setSegment(a.arms[side].forearm,elbow,hand);a.elbows[side].position.set(...elbow);
        const parry=parryStatus(f,side),redirected=f.deflection[side]?.trajectory==='parry-down';
        const glovePitch=active&&m.kind==='upper'?-.8:redirected?.5:parry?.phase==='tap'?.35:parry?.phase==='prepare'?.12:-.15;
        a.gloves[side].position.set(...hand);a.gloves[side].rotation.set(glovePitch,side==='L'?-.12:.12,sign*.1);
      }
      a.gloveMat.emissive.set(f.hitFlash>.1?'#512414':f.blockedFlash>.1?'#183b30':'#000000');
    }
    const p=s.fighters[0],o=s.fighters[1];
    camera.position.set(-slipOffset(p),1.69,p.z+.28);
    camera.lookAt(0,1.35,o.z);
    renderer.render(scene,camera);
  }
  const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(width&&height){camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(lastState)render(lastState);}});
  observer.observe(container);
  return {render,canvas:renderer.domElement,dispose(){observer.disconnect();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}};
}
