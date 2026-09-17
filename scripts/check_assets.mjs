import fs from 'node:fs/promises';import crypto from 'node:crypto';
const manifest=JSON.parse(await fs.readFile('static/data/results.json','utf8'));let count=0,mesh=0,point=0,bytes=0;
for(const scene of Object.values(manifest.scenes)){
 if(Object.keys(scene.methods).length!==6)throw new Error(`Missing method in ${scene.id}`);
 for(const asset of Object.values(scene.methods)){
  const stat=await fs.stat(asset.model);await fs.access(asset.preview);if(stat.size!==asset.bytes)throw new Error(`Size mismatch: ${asset.model}`);if(stat.size>=100*1024*1024)throw new Error(`Oversized asset: ${asset.model}`);
  const header=await fs.open(asset.model,'r');const b=Buffer.alloc(12);await header.read(b,0,12,0);await header.close();if(b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==stat.size)throw new Error(`Invalid GLB: ${asset.model}`);
  count++;bytes+=stat.size;asset.kind==='mesh'?mesh++:point++;
 }
}
let siteBytes=0;async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isDirectory())await walk(`${dir}/${e.name}`);else siteBytes+=(await fs.stat(`${dir}/${e.name}`)).size;}}
await walk('static');if(siteBytes>900*1024*1024)throw new Error('Static assets exceed project budget');
console.log(JSON.stringify({assets:count,meshes:mesh,pointClouds:point,modelMB:Math.round(bytes/1e6),siteMB:Math.round(siteBytes/1e6),paperSha256:crypto.createHash('sha256').update(await fs.readFile('static/pdfs/lidar-triangle-splatting.pdf')).digest('hex')},null,2));
