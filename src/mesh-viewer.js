import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

function dispose(object) {
  object?.traverse(o => { o.geometry?.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material];new Set([...materials,o.userData.colorMaterial,o.userData.geometryMaterial].filter(Boolean)).forEach(m => m.dispose()); });
}
export class MeshComparison {
  constructor(root, options = {}) {
    this.root = root; this.mode = 'color'; this.panes = []; this.version = 0; this.syncing = false;
    this.draco = new DRACOLoader(); this.draco.setDecoderPath(new URL('../vendor/draco/',import.meta.url).href); this.draco.setWorkerLimit(1);
    this.loader = new GLTFLoader(); this.loader.setDRACOLoader(this.draco);this.loader.setMeshoptDecoder(MeshoptDecoder);
    try { for (const element of root.querySelectorAll('.mesh-pane')) {
      const canvas = element.querySelector('canvas');
      const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#f0f1ed');renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(42,1,.01,10000);camera.up.set(0,0,1);
      scene.add(new THREE.HemisphereLight(0xffffff,0x8c948a,1.2));
      const light = new THREE.DirectionalLight(0xffffff,1.8);light.position.set(3,-4,8);scene.add(light);
      const controls = new OrbitControls(camera,canvas);controls.enableDamping=false;controls.screenSpacePanning=true;controls.zoomToCursor=false;
      controls.addEventListener('change', () => this.synchronize(this.panes.find(p => p.canvas === canvas)));
      const pane = {element,canvas,renderer,scene,camera,controls,light,model:null,url:null};this.panes.push(pane);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault();options.onLost?.(); });
      canvas.addEventListener('keydown', e => this.keyboard(pane,e));
    } } catch(e) { this.panes.forEach(p => {p.controls.dispose();p.renderer.dispose();});throw e; }
    this.resizeObserver = new ResizeObserver(() => this.render());this.panes.forEach(p => this.resizeObserver.observe(p.canvas.parentElement));
  }
  keyboard(p,e) {
    const offset=p.camera.position.clone().sub(p.controls.target);const angle=.08;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight')offset.applyAxisAngle(new THREE.Vector3(0,0,1),e.key==='ArrowLeft'?angle:-angle);
    else if(e.key==='ArrowUp'||e.key==='ArrowDown')offset.applyAxisAngle(new THREE.Vector3().crossVectors(offset,new THREE.Vector3(0,0,1)).normalize(),e.key==='ArrowUp'?angle:-angle);
    else if(e.key==='+'||e.key==='=')offset.multiplyScalar(.9);else if(e.key==='-')offset.multiplyScalar(1.1);else if(e.key.toLowerCase()==='r'){this.reset();return;}else return;
    e.preventDefault();p.camera.position.copy(p.controls.target).add(offset);p.controls.update();this.synchronize(p);
  }
  synchronize(source) {
    if(!source || this.syncing)return;this.syncing=true;
    this.panes.forEach(p=>{if(p!==source){p.camera.position.copy(source.camera.position);p.camera.quaternion.copy(source.camera.quaternion);p.controls.target.copy(source.controls.target);p.controls.update();}});
    this.syncing=false;this.render();
  }
  async setPair(scene,method) {
    const version=++this.version;this.abort?.abort();this.abort=new AbortController();const signal=this.abort.signal;
    const changedScene=this.cameraSceneId!==scene.id;this.sceneId=scene.id;this.config=scene;
    const assets=[scene.methods.ours,scene.methods[method]];
    // Decode sequentially to limit memory use on large scientific meshes.
    for(let i=0;i<2;i++){
      const p=this.panes[i],asset=assets[i],url=new URL(asset.model,document.baseURI).href;
      if(p.url===url && p.model)continue;
      if(p.model){p.scene.remove(p.model);dispose(p.model);p.model=null;p.url=null;}
      const response=await fetch(url,{signal});if(!response.ok)throw new Error('Model unavailable');
      const buffer=await response.arrayBuffer();if(version!==this.version)throw new DOMException('Superseded','AbortError');
      const gltf=await this.loader.parseAsync(buffer,new URL('.',url).href);
      if(version!==this.version){dispose(gltf.scene);throw new DOMException('Superseded','AbortError');}
      gltf.scene.traverse(o=>{if(o.isMesh||o.isPoints){const old=o.material;const mats=Array.isArray(old)?old:[old];mats.forEach(m=>m.dispose());
        const colors=o.geometry.attributes.color;if(colors){const linear=new Float32Array(colors.count*3);const color=new THREE.Color();for(let n=0;n<colors.count;n++){color.setRGB(colors.getX(n),colors.getY(n),colors.getZ(n)).convertSRGBToLinear();linear[n*3]=color.r;linear[n*3+1]=color.g;linear[n*3+2]=color.b;}o.geometry.setAttribute('color',new THREE.BufferAttribute(linear,3));}
        const pointSize=this.config.camera.maxDistance*.00012;
        o.userData.colorMaterial=o.isPoints?new THREE.PointsMaterial({size:pointSize,vertexColors:true,sizeAttenuation:true}):new THREE.MeshBasicMaterial({vertexColors:!!o.geometry.attributes.color,side:THREE.DoubleSide,color:o.geometry.attributes.color?0xffffff:0xb4bab0});
        o.userData.geometryMaterial=o.isPoints?new THREE.PointsMaterial({size:pointSize,color:0x8f9988,sizeAttenuation:true}):new THREE.MeshStandardMaterial({color:0x8f9988,roughness:.87,metalness:0,flatShading:true,side:THREE.DoubleSide});o.material=this.mode==='color'?o.userData.colorMaterial:o.userData.geometryMaterial;
      }});
      p.model=gltf.scene;p.url=url;p.scene.add(p.model);
    }
    if(version!==this.version)return;
    if(changedScene||!this.hasCamera){this.reset();this.hasCamera=true;this.cameraSceneId=scene.id;}
    this.panes.forEach(p=>{p.canvas.hidden=false;p.element.querySelector('img').hidden=true;});this.render();
  }
  reset() {
    if(!this.config)return;this.syncing=true;
    this.panes.forEach(p=>{p.camera.position.fromArray(this.config.camera.position);p.controls.target.fromArray(this.config.camera.target);p.camera.up.fromArray(this.config.camera.up||[0,0,1]);p.camera.near=this.config.camera.near||.01;p.camera.far=this.config.camera.far||10000;p.controls.minDistance=this.config.camera.minDistance||.1;p.controls.maxDistance=this.config.camera.maxDistance||1000;p.camera.lookAt(p.controls.target);p.controls.update();});this.syncing=false;this.render();
  }
  setMode(mode) {this.mode=mode;this.panes.forEach(p=>p.model?.traverse(o=>{if(o.isMesh||o.isPoints)o.material=mode==='color'?o.userData.colorMaterial:o.userData.geometryMaterial;}));this.render();}
  render() {
    this.panes.forEach(p=>{const {width,height}=p.canvas.parentElement.getBoundingClientRect();if(width<1||height<1)return;
      p.renderer.setSize(width,height,false);p.camera.aspect=width/height;p.camera.updateProjectionMatrix();p.light.position.copy(p.camera.position);p.renderer.render(p.scene,p.camera);
    });
  }
  destroy(){this.abort?.abort();this.resizeObserver.disconnect();this.panes.forEach(p=>{dispose(p.model);p.controls.dispose();p.renderer.dispose();});this.draco.dispose();}
}
