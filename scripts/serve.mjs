import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),prefix='/lidar-ts-page/',port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf','.mp4':'video/mp4','.wasm':'application/wasm','.glb':'model/gltf-binary'};
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/'||pathname==='/lidar-ts-page'){res.writeHead(302,{Location:prefix});res.end();return;}
 if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const rel=pathname.slice(prefix.length)||'index.html',file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep)||(!rel.startsWith('.cache/')&&rel.split('/').some(p=>p.startsWith('.')))){res.writeHead(403);res.end();return;}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
 const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=0,end=stat.size-1;
 if(range){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
 headers['Content-Length']=end-start+1;res.writeHead(range?206:200,headers);if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(file,{start,end});stream.pipe(res);res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());
 });
}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}${prefix}`));
