import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
const dirs=['utmm-fast','replica-room0','ncd-quad'];
const names={ours:'Ours',ts:'Triangle Splatting',milo:'MILo','2dgs':'2DGS','mesh-splat':'Mesh-splat',sugar:'SuGaR'};
const labels={'utmm-fast':'UTMM · fast-straight','replica-room0':'Replica · room0','ncd-quad':'NCD · quad-easy'};
const manifest={version:1,defaultScene:'utmm-fast',defaultBaseline:'ts',scenes:{}};const provenance=[];
for(const id of dirs){
 const folder=path.resolve('.cache/meshes',id);await fs.mkdir(`static/models/${id}`,{recursive:true});await fs.mkdir(`static/images/meshes/${id}`,{recursive:true});
 const ours=JSON.parse(await fs.readFile(path.join(folder,'ours.json'),'utf8'));
 const [lo,hi]=ours.bounds,center=lo.map((v,i)=>(v+hi[i])/2),radius=Math.max(...lo.map((v,i)=>hi[i]-v))/2;
 const offset={'utmm-fast':[-1.8,-2.25,2],'replica-room0':[1.8,2.25,2],'ncd-quad':[1.8,-2.25,2]}[id];
 const scene={id,label:labels[id],camera:{position:center.map((v,i)=>v+offset[i]*radius),target:center,up:[0,0,1],near:radius/1000,far:radius*30,minDistance:radius*.02,maxDistance:radius*10},methods:{}};
 for(const [method,label] of Object.entries(names)){
  const input=path.join(folder,`${method}.glb`),output=`static/models/${id}/${method}.glb`;
  let info;try{info=JSON.parse(await fs.readFile(path.join(folder,`${method}.json`),'utf8'));}catch{continue;}
  if(!info.displayFaces && !info.pointCloud){console.log('Skipping non-mesh',id,method);continue;}
  if(process.argv.includes('--force') || !(await fs.stat(output).catch(()=>null))){
   console.log('Compressing',id,method);
   const result=spawnSync(process.execPath,['node_modules/@gltf-transform/cli/bin/cli.js','meshopt',input,output,'--level','medium','--quantize-position','16','--quantize-color','8'],{stdio:'inherit'});
   if(result.status!==0)throw new Error(`Compression failed: ${id}/${method}`);
  }
  const stat=await fs.stat(output);scene.methods[method]={label,model:output,preview:`static/images/meshes/${id}/${method}.jpg`,bytes:stat.size,triangles:info.displayFaces,kind:info.pointCloud?'points':'mesh'};
  provenance.push({...info,webAsset:output,webBytes:stat.size,compression:'Meshopt medium, position quantization 16 bits, color 8 bits'});
 }
 manifest.scenes[id]=scene;
 await fs.writeFile('static/data/results.json',JSON.stringify(manifest,null,2));
 await fs.writeFile('scripts/mesh-provenance.json',JSON.stringify(provenance,null,2));
}
console.log('Manifest and provenance written.');
