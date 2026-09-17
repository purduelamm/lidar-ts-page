import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
await fs.mkdir('static/vendor/draco',{recursive:true});
await fs.copyFile('src/page.html','index.html');await fs.copyFile('src/style.css','static/css/index.css');
// Explicit resolution keeps this build inside the repository on restricted hosts.
const localResolver={name:'local-modules',setup(b){
 b.onResolve({filter:/.*/},a=>{let file;if(a.path==='three')file=path.resolve('node_modules/three/build/three.module.js');else if(a.path.startsWith('three/addons/'))file=path.resolve('node_modules/three/examples/jsm',a.path.slice(13));else file=path.resolve(a.importer?path.dirname(a.importer):process.cwd(),a.path);return {path:file,namespace:'local-js'};});
 b.onLoad({filter:/.*/,namespace:'local-js'},async a=>({contents:await fs.readFile(a.path,'utf8'),loader:'js'}));
}};
const result=await build({absWorkingDir:process.cwd(),tsconfigRaw:{compilerOptions:{}},entryPoints:{index:'./src/index.js','mesh-viewer':'./src/mesh-viewer.js'},outdir:'static/js',bundle:true,format:'esm',splitting:true,minify:true,target:['es2022'],legalComments:'linked',plugins:[localResolver],write:false});
for(const output of result.outputFiles)await fs.writeFile(output.path,output.contents);
for(const name of ['draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js'])await fs.copyFile(`node_modules/three/examples/jsm/libs/draco/gltf/${name}`,`static/vendor/draco/${name}`);
await fs.copyFile('node_modules/three/LICENSE','static/vendor/THREE-LICENSE.txt');
console.log('Static page and local 3D viewer built.');
