import * as THREE from './vendor/three.module.min.js';

// Presentation only. Combat positions, timing and hit tests remain in core.mjs.
export const REFERENCE_LOOK=Object.freeze({
  fov:70,eyeY:1.69,eyeBack:.15,lookY:1.48,
  guardX:.174,guardY:1.71,guardForward:.12,
  swayX:.009,breatheY:.004,bodyRoll:.012,
  cameraX:.004,cameraY:.003,cameraRoll:.004,
  hitBack:.025,blockBack:.008,hitRoll:.012,
});

export function bodyRhythm(time,id,enabled){
  if(!enabled)return {x:0,y:0,roll:0};
  const phase=id*1.7,t=time*Math.PI*2;
  return {x:Math.sin(t/3.6+phase)*REFERENCE_LOOK.swayX,
    y:Math.sin(t/2.7+phase)*REFERENCE_LOOK.breatheY,
    roll:Math.sin(t/3.6+phase)*REFERENCE_LOOK.bodyRoll};
}

export function addReferenceArena(scene){
  const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
  const add=(geometry,material,x,y,z)=>{
    const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);
    object.receiveShadow=true;scene.add(object);return object;
  };
  const dark=mat('#10151e'),blue=mat('#23568b'),white=mat('#dddcd5'),red=mat('#9c3342'),postMat=mat('#263b52');
  add(new THREE.BoxGeometry(24,.08,24),dark,0,-.14,0);
  add(new THREE.BoxGeometry(6.6,.12,6.6),blue,0,-.06,0);
  // A quiet canvas boundary conveys range without copying the reference logos.
  const lineMat=mat('#7c9cab');
  for(const x of [-2.6,2.6])add(new THREE.BoxGeometry(.018,.002,5.2),lineMat,x,.002,0);
  for(const z of [-2.6,2.6])add(new THREE.BoxGeometry(5.2,.002,.018),lineMat,0,.002,z);
  for(const x of [-3.1,3.1])for(const z of [-3.1,3.1]){
    const post=add(new THREE.CylinderGeometry(.075,.075,1.65,16),postMat,x,.79,z);post.castShadow=true;
    const pad=add(new THREE.BoxGeometry(.18,.7,.18),z<0?red:postMat,x,1.05,z);pad.castShadow=true;
  }
  for(const [j,y] of [.48,.77,1.06,1.35].entries()){
    for(const x of [-3.1,3.1]){
      const rope=add(new THREE.CylinderGeometry(.022,.022,6.2,12),j===3?red:white,x,y,0);rope.rotation.x=Math.PI/2;
    }
    for(const z of [-3.1,3.1]){
      const rope=add(new THREE.CylinderGeometry(.022,.022,6.2,12),j===3?red:white,0,y,z);rope.rotation.z=Math.PI/2;
    }
  }
  // Low contrast empty seating: no image assets or identifiable spectators.
  const seatMat=mat('#1c2636');
  for(let row=0;row<4;row++){
    const seats=new THREE.InstancedMesh(new THREE.BoxGeometry(.32,.32,.35),seatMat,40);
    const dummy=new THREE.Object3D();
    for(let n=0;n<40;n++){
      const back=n<20;dummy.position.set((n%20-9.5)*.48,.25+row*.32,(back?-1:1)*(4.3+row*.65));
      dummy.updateMatrix();seats.setMatrixAt(n,dummy.matrix);
    }
    scene.add(seats);
  }
  const lampMat=new THREE.MeshBasicMaterial({color:'#fff1d7'}),trussMat=mat('#38434d');
  for(const z of [-3.8,3.8]){
    add(new THREE.BoxGeometry(7,.08,.08),trussMat,0,4,z);
    for(let x=-3;x<=3;x+=.6){
      const lamp=add(new THREE.BoxGeometry(.23,.08,.16),lampMat,x,3.94,z);lamp.receiveShadow=false;
    }
  }
}

export function addReferenceGlove(group,material,tapeMaterial,side){
  const sign=side==='L'?1:-1;
  const geometry=new THREE.SphereGeometry(1,40,28);
  const position=geometry.attributes.position;
  // Round cuboid padding with a broad finger pad instead of two smooth balls.
  for(let i=0;i<position.count;i++)for(const axis of ['X','Y','Z']){
    const value=position['get'+axis](i);
    position['set'+axis](i,Math.sign(value)*Math.abs(value)**.78);
  }
  const normal=geometry.attributes.normal;
  for(let i=0;i<position.count;i++){
    const values=['X','Y','Z'].map(axis=>{const v=position['get'+axis](i);return Math.sign(v)*Math.abs(v)**(2/.78-1);});
    const length=Math.hypot(...values)||1;normal.setXYZ(i,...values.map(v=>v/length));
  }
  const part=(geo,mat,xyz,scale)=>{
    const object=new THREE.Mesh(geo,mat);object.position.set(...xyz);object.scale.set(...scale);
    object.castShadow=true;object.receiveShadow=true;group.add(object);return object;
  };
  const leather=material;leather.roughness=.38;
  const palm=leather.clone();palm.color.multiplyScalar(.68);palm.roughness=.54;
  part(geometry,leather,[0,.012,.015],[.13,.155,.14]);
  part(new THREE.SphereGeometry(1,28,20),palm,[0,-.035,-.104],[.098,.11,.04]);
  const thumb=part(new THREE.SphereGeometry(1,28,20),leather,[-sign*.091,-.047,-.008],[.059,.094,.072]);
  thumb.rotation.z=-sign*.24;
  part(new THREE.CylinderGeometry(.088,.073,.105,32),leather,[0,-.163,-.015],[1,1,1]);
  part(new THREE.CylinderGeometry(.087,.083,.038,32),tapeMaterial,[0,-.197,-.015],[1,1,1]);
  const seamMat=palm.clone();seamMat.color.multiplyScalar(.8);
  const seam=part(new THREE.TorusGeometry(.079,.0025,6,40),seamMat,[0,-.119,-.015],[1,1,1]);
  seam.rotation.x=Math.PI/2;
  // A short stitched palm seam stays legible as the fist turns away.
  for(let n=0;n<8;n++)part(new THREE.BoxGeometry(.009,.002,.002),tapeMaterial,[-.045+n*.013,-.095,-.142],[1,1,1]);
}
