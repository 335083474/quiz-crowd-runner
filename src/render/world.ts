import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {t} from '../i18n.mjs';
import { Game, GATE_DISTANCE, MARCH_DISTANCE } from '../simulation/game.mjs';

const blue=0x039fe8, red=0xf75565;
export class World {
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(42,1,.1,180);
  renderer:THREE.WebGLRenderer;
  tower=new THREE.Group(); castle=new THREE.Group();
  wreck=new THREE.Group();lastCleared=-1;explosionZ=0;
  blueCrowd:THREE.InstancedMesh[]=[];redCrowd:THREE.InstancedMesh[]=[];
  shield:THREE.Mesh; gate=new THREE.Group();
  gateMembrane:THREE.Mesh;gateFrameMat:THREE.MeshBasicMaterial;gateScan:THREE.Mesh;
  gateLabel=new THREE.Sprite();gateLabelKey='';
  rewardSparkles:THREE.InstancedMesh;rewardRing:THREE.Mesh;
  lastReward=0;rewardAt=-100;rewardWorldZ=0;growthBefore=0;
  dummy=new THREE.Object3D();
  time=0; stage=-1; modelsLoaded=0; loadFailed=false; contextLost=false;
  particles:THREE.Mesh[]=[]; arrows:THREE.Mesh[]=[];
  dust:THREE.Mesh[]=[];
  sun:THREE.DirectionalLight;
  enemyAnchor=new THREE.Vector3();
  armyAnchor=new THREE.Vector3();
  lookAhead=3;
  strideTime=0;
  deck=new THREE.Group();
  sea!:THREE.Mesh;
  laneMarks!:THREE.InstancedMesh;bollards!:THREE.InstancedMesh;
  scenery:Array<{mesh:THREE.Mesh,baseZ:number}>=[];
  lastTroops=40; explosionAt=-100; lastPhase='';
  constructor(public host:HTMLElement,public game:Game){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x48cce3);host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','蓝色队伍向城堡冲锋的立体战场');
    this.scene.fog=new THREE.Fog(0x74dce7,48,115);
    this.scene.add(new THREE.HemisphereLight(0xe8fbff,0x45a1aa,2.6));
    const sun=this.sun=new THREE.DirectionalLight(0xfff8e3,3.4);sun.position.set(-12,25,16);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:25,bottom:-40,near:.5,far:80});
    sun.shadow.bias=-.0004;this.scene.add(sun);this.scene.add(sun.target);
    this.camera.position.set(0,18,26);this.camera.lookAt(0,0,3);
    this.ground();
    this.blueCrowd=this.makeCrowd(blue,150);this.redCrowd=this.makeCrowd(red,65);
    this.tower.position.set(0,0,-8);this.scene.add(this.tower);
    this.wreck.visible=false;this.scene.add(this.wreck);
    this.castle.position.set(0,0,-33);this.scene.add(this.castle);
    const domeGeo=new THREE.SphereGeometry(4.4,32,16,0,Math.PI*2,0,Math.PI/2);
    this.shield=new THREE.Mesh(domeGeo,new THREE.MeshStandardMaterial({color:0x9effff,transparent:true,opacity:.23,roughness:.15,metalness:.25,side:THREE.DoubleSide,depthWrite:false}));
    this.shield.scale.set(1,.65,.85);this.scene.add(this.shield);
    const gateMat=this.gateFrameMat=new THREE.MeshBasicMaterial({color:0x65e4ff,transparent:true,opacity:.5,depthWrite:false});
    [[-4.6,1.7,0],[4.6,1.7,0]].forEach(([x,y,z])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.075,3.4,.075),gateMat);p.position.set(x,y,z);this.gate.add(p);});
    const bar=new THREE.Mesh(new THREE.BoxGeometry(9.25,.07,.075),gateMat);bar.position.y=3.4;this.gate.add(bar);
    this.gateMembrane=new THREE.Mesh(new THREE.PlaneGeometry(9.2,3.4),new THREE.MeshBasicMaterial({color:0x50d9ff,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));this.gateMembrane.position.y=1.7;this.gate.add(this.gateMembrane);
    this.gateScan=new THREE.Mesh(new THREE.PlaneGeometry(9.2,.035),new THREE.MeshBasicMaterial({color:0xd6ffff,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));this.gateScan.position.set(0,1.6,.012);this.gate.add(this.gateScan);
    this.gateLabel.position.set(0,2.1,.05);this.gateLabel.scale.set(4.6,2.3,1);this.gate.add(this.gateLabel);
    this.gate.position.set(0,0,3.4);this.scene.add(this.gate);
    this.rewardSparkles=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,6,4),new THREE.MeshBasicMaterial({color:0xc8fffa,transparent:true,opacity:.8,depthWrite:false}),32);this.rewardSparkles.count=0;this.rewardSparkles.frustumCulled=false;this.scene.add(this.rewardSparkles);
    this.rewardRing=new THREE.Mesh(new THREE.RingGeometry(.8,1,48),new THREE.MeshBasicMaterial({color:0x79ffe0,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));this.rewardRing.rotation.x=-Math.PI/2;this.rewardRing.visible=false;this.scene.add(this.rewardRing);
    for(let i=0;i<24;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial({color:i%2?0xffd66b:0xfb916d}));m.visible=false;this.particles.push(m);this.scene.add(m);}
    for(let i=0;i<12;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(.055,.65,5),new THREE.MeshStandardMaterial({color:0xffcf75}));m.rotation.x=Math.PI/2;m.visible=false;this.arrows.push(m);this.scene.add(m);}
    const dustGeo=new THREE.SphereGeometry(.17,6,4);
    for(let i=0;i<14;i++){const m=new THREE.Mesh(dustGeo,new THREE.MeshBasicMaterial({color:0xfff6d4,transparent:true,opacity:.5,depthWrite:false}));m.visible=false;this.dust.push(m);this.scene.add(m);}
    this.resize();new ResizeObserver(()=>this.resize()).observe(host);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.game.paused=true;window.dispatchEvent(new CustomEvent('game-context-lost'));});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
  }
  ground(){
    const sea=this.sea=new THREE.Mesh(new THREE.PlaneGeometry(350,550),new THREE.MeshStandardMaterial({color:0x17bcdc,roughness:.32,metalness:.1}));sea.rotation.x=-Math.PI/2;sea.position.set(0,-.55,-110);this.scene.add(sea);
    this.scene.add(this.deck);
    const road=new THREE.Mesh(new THREE.BoxGeometry(11.4,.5,270),new THREE.MeshStandardMaterial({color:0xf5f5e8,roughness:.88}));road.position.set(0,-.28,-100);road.receiveShadow=true;this.deck.add(road);
    const edgeMat=new THREE.MeshStandardMaterial({color:0xd6e0d9});
    for(const x of [-5.7,5.7]){const e=new THREE.Mesh(new THREE.BoxGeometry(.14,.09,270),edgeMat);e.position.set(x,.01,-100);this.deck.add(e);}
    const shape=new THREE.Shape();shape.moveTo(-2.7,0);shape.lineTo(0,-1.6);shape.lineTo(2.7,0);shape.lineTo(2.7,-.55);shape.lineTo(0,-2.15);shape.lineTo(-2.7,-.55);shape.closePath();
    const laneMarks=this.laneMarks=new THREE.InstancedMesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xdce5df}),52);
    laneMarks.frustumCulled=false;laneMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for(let i=0;i<52;i++){
      const z=16-i*4.8;
      this.dummy.position.set(0,.003,z);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.updateMatrix();laneMarks.setMatrixAt(i,this.dummy.matrix);
    }
    this.scene.add(laneMarks);
    const bollards=this.bollards=new THREE.InstancedMesh(new THREE.BoxGeometry(.23,.48,.85),new THREE.MeshStandardMaterial({color:0x30c4b2,roughness:.65}),100);
    bollards.frustumCulled=false;bollards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for(let i=0;i<100;i++){
      this.dummy.position.set(i%2?-5.46:5.46,.23,14-Math.floor(i/2)*4.8);this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();bollards.setMatrixAt(i,this.dummy.matrix);
    }
    this.scene.add(bollards);
    // 小岛只承担场景气氛，不占据主跑道。
    const islandMat=new THREE.MeshStandardMaterial({color:0x6bd7a0});
    for(let i=0;i<24;i++){const island=new THREE.Mesh(new THREE.CylinderGeometry(1.3+i%2,1.7+i%2,.6,7),islandMat);island.position.set((i%2?1:-1)*(11+i%3*4),-.4,10-i*10);this.scene.add(island);this.scenery.push({mesh:island,baseZ:island.position.z});}
    const floatMat=new THREE.MeshBasicMaterial({color:0x7fdfeb,transparent:true,opacity:.42});
    for(let i=0;i<48;i++){const line=new THREE.Mesh(new THREE.PlaneGeometry(2+i%4,.06),floatMat);line.rotation.x=-Math.PI/2;line.position.set((i%2?1:-1)*(8+i%4*4),-.23,12-i*5);this.scene.add(line);this.scenery.push({mesh:line,baseZ:line.position.z});}
  }
  updateRoad(distance:number){
    const wrap=(base:number,period:number)=>base-Math.floor((distance+base+period-30)/period)*period;
    this.deck.position.z=-distance;
    for(let i=0;i<52;i++){
      this.dummy.position.set(0,.003,wrap(16-i*4.8,249.6));this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.laneMarks.setMatrixAt(i,this.dummy.matrix);
    }
    for(let i=0;i<100;i++){
      this.dummy.position.set(i%2?-5.46:5.46,.23,wrap(14-Math.floor(i/2)*4.8,240));this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();this.bollards.setMatrixAt(i,this.dummy.matrix);
    }
    this.laneMarks.instanceMatrix.needsUpdate=true;this.bollards.instanceMatrix.needsUpdate=true;
    this.scenery.forEach(({mesh,baseZ})=>mesh.position.z=wrap(baseZ,240));
  }
  setGateLabel(title:string,subtitle:string,key:string){
    if(key===this.gateLabelKey)return;this.gateLabelKey=key;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext('2d')!;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='900 100px "Segoe UI","Microsoft YaHei",sans-serif';ctx.lineJoin='round';ctx.lineWidth=8;ctx.strokeStyle='#1983a1';ctx.fillStyle='#ffffff';
    ctx.strokeText(title,256,102);ctx.fillText(title,256,102);
    ctx.font='800 29px "Segoe UI","Microsoft YaHei",sans-serif';ctx.lineWidth=5;ctx.strokeText(subtitle,256,187);ctx.fillText(subtitle,256,187);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const old=this.gateLabel.material;old.map?.dispose();old.dispose();
    this.gateLabel.material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
  }
  makeCrowd(color:number,max:number){
    const mat=new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.03});
    const geometries=[new THREE.SphereGeometry(.215,12,10),new THREE.CapsuleGeometry(.16,.24,3,8),new THREE.CapsuleGeometry(.065,.23,3,6),new THREE.CapsuleGeometry(.065,.23,3,6),new THREE.CapsuleGeometry(.085,.26,3,6),new THREE.CapsuleGeometry(.085,.26,3,6)];
    return geometries.map(geo=>{const m=new THREE.InstancedMesh(geo,mat,max);m.count=0;m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;this.scene.add(m);return m;});
  }
  async load(){
    const loader=new GLTFLoader();
    const names=['tower-square','tower-square-mid','tower-square-top','tower-base','tower-top','wall','gate','siege-ballista'];
    const models=new Map<string,THREE.Group>();
    await Promise.all(names.map(async name=>{
      try{const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});models.set(name,gltf.scene);this.modelsLoaded++;}
      catch(e){this.loadFailed=true;console.error('Castle model failed',name,e);}
    }));
    if(this.loadFailed)throw new Error('城堡模型加载失败，请刷新重试。');
    const object=(name:string,height:number,width=0)=>{
      const model=models.get(name)!.clone(true),box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
      const holder=new THREE.Group();model.scale.setScalar(width?width/Math.max(size.x,size.z):height/size.y);
      const scaled=new THREE.Box3().setFromObject(model),center=scaled.getCenter(new THREE.Vector3());model.position.set(-center.x,-scaled.min.y,-center.z);holder.add(model);return holder;
    };
    const base=object('tower-base',1,3.4);this.tower.add(base);
    const baseHeight=new THREE.Box3().setFromObject(base).max.y;
    const top=object('tower-top',1,3.6);top.position.y=baseHeight-.12;this.tower.add(top);
    for(const part of [base,top])part.traverse(o=>{if(o instanceof THREE.Mesh){o.material=new THREE.MeshStandardMaterial({color:0x9862d9,roughness:.65});}});
    const band=new THREE.Mesh(new THREE.CylinderGeometry(1.56,1.56,.23,10),new THREE.MeshStandardMaterial({color:0x7d4dbe}));band.position.y=baseHeight*.35;this.tower.add(band);
    const ballista=object('siege-ballista',1.15,1.9);ballista.position.set(2.8,0,-1.2);this.tower.add(ballista);
    const fallingTower=this.tower.clone(true);fallingTower.position.set(0,0,0);this.wreck.add(fallingTower);
    for(const x of [-3.8,3.8]){
      for(let i=0;i<3;i++){const mid=object('tower-square-mid',2);mid.position.set(x,i*2,-.4);this.castle.add(mid);}
      const top=object('tower-square-top',1,3.4);top.position.set(x,6,-.4);this.castle.add(top);
    }
    const wall=object('wall',2.6);wall.scale.x=1.3;wall.position.z=.5;this.castle.add(wall);
    const gate=object('gate',2.7);gate.position.set(0,0,1.4);this.castle.add(gate);
    for(const x of [-7.2,7.2]){const wall=object('wall',3.2);wall.position.x=x;this.castle.add(wall);}
    const plaza=new THREE.Mesh(new THREE.BoxGeometry(21,.45,10),new THREE.MeshStandardMaterial({color:0xe9e8d7,roughness:.9}));plaza.position.set(0,-.24,-1);plaza.receiveShadow=true;this.castle.add(plaza);
  }
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.fov=w<600?48:42;this.camera.updateProjectionMatrix();}
  crowd(meshes:THREE.InstancedMesh[],count:number,z:number,opponent:boolean,running:boolean,fighting:boolean,speed=0,growthAge=100){
    const n=Math.min(count,opponent?65:150), cols=opponent?7:Math.min(11,Math.max(4,Math.ceil(Math.sqrt(n*1.2))));
    meshes.forEach(m=>m.count=n);
    for(let i=0;i<n;i++){
      const row=Math.floor(i/cols),col=i%cols,dx=(col-(Math.min(cols,n-row*cols)-1)/2)*.52;
      const dz=row*.55; const phase=(running?this.strideTime:this.time*11)+i*.73;
      const effort=Math.min(speed/9,1);
      const swing=running?Math.sin(phase)*(.25+effort*.45):fighting?Math.sin(phase*1.3)*.45:.06*Math.sin(phase*.2);
      const bounce=running?Math.abs(Math.sin(phase))*(.025+effort*.045):0;
      let x=dx+Math.sin(i*4.23)*.035, zz=z+(opponent?-1:1)*dz,spawnScale=1;
      if(!opponent&&growthAge<1.2&&count>this.growthBefore&&this.growthBefore>0){
        if(i<this.growthBefore){
          const oldCols=Math.min(11,Math.max(4,Math.ceil(Math.sqrt(this.growthBefore*1.2))));
          const oldRow=Math.floor(i/oldCols),oldCol=i%oldCols,oldX=(oldCol-(Math.min(oldCols,this.growthBefore-oldRow*oldCols)-1)/2)*.52;
          const t=THREE.MathUtils.smoothstep(growthAge,0,.5);x=THREE.MathUtils.lerp(oldX,x,t);zz=THREE.MathUtils.lerp(z+oldRow*.55,zz,t);
        }else{
          const t=THREE.MathUtils.smoothstep(growthAge-(i-this.growthBefore)*.004,0,.55);
          x=THREE.MathUtils.lerp(i%2?3.7:-3.7,x,t);zz=THREE.MathUtils.lerp(this.rewardWorldZ+.5+(i%3)*.2,zz,t);spawnScale=.08+.92*t;
        }
      }
      const offsets=[[0,.97,0],[0,.61,0],[-.23,.61,0],[.23,.61,0],[-.1,.23,0],[.1,.23,0]];
      offsets.forEach(([ox,oy,oz],p)=>{
        this.dummy.position.set(x+ox,oy+bounce,zz+oz);this.dummy.rotation.set(0,opponent?Math.PI:0,0);
        if(p>=2)this.dummy.rotation.x=(p%2?1:-1)*swing*(opponent?-1:1);
        if(fighting&&p===3)this.dummy.rotation.x=-1+Math.sin(phase)*.5;
        this.dummy.scale.setScalar(spawnScale);this.dummy.updateMatrix();meshes[p].setMatrixAt(i,this.dummy.matrix);
      });
    }
    meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);
  }
  update(dt:number){
    if(this.contextLost)return;
    const g=this.game;if(!g.paused)this.time+=dt;
    const marching=g.phase==='march',jogging=g.phase==='question',running=marching||jogging;
    const distance=g.worldDistance;
    if(g.rewardSequence<this.lastReward){this.lastReward=0;this.rewardAt=-100;}
    if(g.gateReward&&g.rewardSequence!==this.lastReward){this.lastReward=g.rewardSequence;this.rewardAt=this.time;this.rewardWorldZ=g.gateReward.worldZ;this.growthBefore=g.gateReward.before;}
    const rewardAge=this.time-this.rewardAt;
    if(running&&!g.paused)this.strideTime+=dt*(3+g.speed*1.2);
    this.updateRoad(distance);
    this.sea.position.z=-110-distance;
    const z=3-distance;
    const final=g.final;
    const segment=final?g.questions.length:g.index;
    const enemyZ=3-(segment+1)*MARCH_DISTANCE-g.jogDistance-2.5;
    const towerZ=3-(segment+1)*MARCH_DISTANCE-g.jogDistance-6;
    if(!g.lastSegment){this.lastCleared=-1;this.wreck.visible=false;}
    if(g.lastSegment&&g.lastSegment.index!==this.lastCleared){
      this.lastCleared=g.lastSegment.index;this.explosionAt=this.time;
      this.explosionZ=3-g.lastSegment.worldEnd-6;
      this.wreck.position.set(0,0,this.explosionZ);
    }
    if(g.phase!==this.lastPhase){if(g.outcome==='victory'){this.explosionAt=this.time;this.explosionZ=this.castle.position.z;}this.lastPhase=g.phase;}
    this.tower.visible=!final;this.tower.position.y=0;
    this.tower.position.z=towerZ;
    this.castle.position.z=3-g.routeDistance-g.jogDistance-7;
    const enemies=final?55:g.question.enemies+(g.summary?.enemyBonus??0);
    const combatProgress=g.phase==='combat'?Math.min(g.elapsed/3.2,1):g.outcome==='victory'?1:0;
    const remaining=Math.max(0,Math.ceil(enemies*(1-combatProgress)));
    this.crowd(this.blueCrowd,g.troops,z,false,running,g.phase==='combat',g.speed,rewardAge);
    this.crowd(this.redCrowd,remaining,enemyZ,true,false,g.phase==='combat');
    this.shield.visible=g.shield>0;this.shield.position.set(0,.02,z+1.3);this.shield.rotation.y=this.time*.15;
    (this.shield.material as THREE.MeshStandardMaterial).opacity=.17+Math.sin(this.time*3)*.04;
    const gatePass=g.gateCrossed?Math.max(0,(g.distance-g.marchStart-GATE_DISTANCE)/8.6):0,gateFade=g.gateCrossed?Math.max(0,1-gatePass/.85):1;
    const failed=g.summary?.ok===false,gateColor=failed?0xb0bec8:g.question.reward.type==='shield'?0x65e5c7:g.question.reward.type==='multiply'?0xbca0ff:0x55dbff;
    this.gate.visible=!final&&['ready','question','march'].includes(g.phase)&&gateFade>0;this.gate.position.set(0,0,3-segment*MARCH_DISTANCE-g.jogDistance-GATE_DISTANCE);
    this.gateFrameMat.color.setHex(gateColor);this.gateFrameMat.opacity=(failed?.2:.5)*gateFade;
    const membrane=this.gateMembrane.material as THREE.MeshBasicMaterial;membrane.color.setHex(gateColor);membrane.opacity=((failed?.05:.12)+(rewardAge<.9?.45*Math.exp(-rewardAge*7):0))*gateFade;
    this.gateScan.position.y=.2+(this.time*.55)%3.1;(this.gateScan.material as THREE.MeshBasicMaterial).opacity=.3*gateFade;
    const reward=g.question.reward,title=failed?'+0':reward.type==='shield'?`◈ +${reward.value}`:reward.type==='multiply'?`×${reward.value}`:`+${reward.value}`;
    const subtitle=failed?'未激活':g.gateCrossed?'领取成功':reward.type==='shield'?'穿过获得护盾':reward.type==='multiply'?'穿过兵力翻倍':'穿过增加兵力';
    this.setGateLabel(title,t(subtitle),`${g.index}:${title}:${t(subtitle)}`);this.gateLabel.material.opacity=gateFade;
    const burst=rewardAge>=0&&rewardAge<1.1;this.rewardSparkles.count=burst?32:0;
    if(burst){for(let i=0;i<32;i++){const angle=i*2.399;this.dummy.position.set(Math.sin(angle)*(.5+rewardAge*4.5),.2+(i%7)*.3+rewardAge*1.8-rewardAge*rewardAge,this.rewardWorldZ+Math.cos(angle)*rewardAge*2.4);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(Math.max(0,1-rewardAge/1.1));this.dummy.updateMatrix();this.rewardSparkles.setMatrixAt(i,this.dummy.matrix);}this.rewardSparkles.instanceMatrix.needsUpdate=true;}
    this.rewardRing.visible=rewardAge>=0&&rewardAge<.85;this.rewardRing.position.set(0,.035,this.rewardWorldZ);this.rewardRing.scale.setScalar(1+Math.min(rewardAge,1)*5);(this.rewardRing.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-rewardAge/.85)*.65;
    this.arrows.forEach((a,i)=>{a.visible=g.phase==='combat';const t=(this.time*1.3+i/12)%1;a.position.set(Math.sin(i*5)*2,4*(1-t)+Math.sin(t*Math.PI)*1.8,enemyZ-1+t*6);});
    const rows=Math.ceil(Math.min(g.troops,150)/Math.min(11,Math.max(4,Math.ceil(Math.sqrt(g.troops*1.2)))));
    this.dust.forEach((p,i)=>{p.visible=running;const t=(this.time*(jogging?.7:2)+i/14)%1;p.position.set(Math.sin(i*8)*2,.08+t*.4,z+rows*.55+t*2);p.scale.setScalar(.6+t*1.4);(p.material as THREE.MeshBasicMaterial).opacity=(1-t)*(jogging?.1:.4);});
    const age=this.time-this.explosionAt;
    this.wreck.visible=this.lastCleared>=0&&age>=0&&age<1.8&&g.outcome!=='victory';
    this.wreck.position.y=-Math.min(age*3.8,7);
    this.particles.forEach((p,i)=>{p.visible=age<1.4&&age>=0;if(p.visible){p.position.set(Math.sin(i*7)*age*5,1+Math.sin(i*3)*age*3+4*age-3*age*age,this.explosionZ+Math.cos(i*9)*age*4);p.rotation.set(age*i,age*i*.4,age);}});
    if(g.outcome==='victory'){this.castle.rotation.z=Math.sin(this.time*3)*.012;}
    else this.castle.rotation.z=0;
    const bob=running?Math.sin(this.strideTime)*(.008+Math.min(g.speed/9,1)*.027):0;
    this.camera.position.set(0,18+bob,26-distance);
    this.lookAhead=THREE.MathUtils.damp(this.lookAhead,g.phase==='combat'?-3:3-6*Math.min(g.speed/8.6,1),5,g.paused?0:dt);
    this.camera.lookAt(0,.2,this.lookAhead-distance);
    this.sun.position.set(-12,25,16-distance);this.sun.target.position.set(0,0,-distance);
    this.camera.updateMatrixWorld();
    const armyLabel=document.querySelector<HTMLElement>('#army-label');
    if(armyLabel){
      this.armyAnchor.set(0,1.8,z+.2).project(this.camera);armyLabel.style.left=`${(this.armyAnchor.x*.5+.5)*100}%`;armyLabel.style.top=`${(-this.armyAnchor.y*.5+.5)*100}%`;
      armyLabel.hidden=g.phase==='result';
      armyLabel.classList.toggle('reward-pop',rewardAge<1.2);
      const delta=armyLabel.querySelector<HTMLElement>('.army-delta')!;delta.hidden=!(rewardAge>=0&&rewardAge<1.6&&g.gateReward);
      if(g.gateReward&&!delta.hidden)delta.textContent=g.gateReward.type==='shield'?t('护盾 +{n}',{n:g.gateReward.value}):`${g.gateReward.before} → ${g.gateReward.after}`;
    }
    const label=document.querySelector<HTMLElement>('#enemy-tag');
    if(label){
      this.enemyAnchor.set(3.3,2.7,final?this.castle.position.z:enemyZ-2).project(this.camera);
      label.style.left=`${(this.enemyAnchor.x*.5+.5)*100}%`;
      label.style.top=`${(-this.enemyAnchor.y*.5+.5)*100}%`;
      label.style.opacity=this.enemyAnchor.y>1||this.enemyAnchor.y<-.9?'0':'1';
      label.style.transform='translate(-50%,-100%) rotate(3deg)';
    }
    this.renderer.render(this.scene,this.camera);
  }
}
