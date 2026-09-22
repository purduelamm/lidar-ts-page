import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const ready=page=>expect(page.locator('#mesh-comparison')).toHaveAttribute('data-state','ready',{timeout:120000});
const closeVector=(a,b)=>a.forEach((v,i)=>expect(v).toBeCloseTo(b[i],9));

test('paper content, relative assets, and lazy media loading',async({page,request})=>{
 const fetched=[];const errors=[];page.on('request',r=>fetched.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 for(const id of ['overview','pipeline','optimization','meshes','simulation'])await expect(page.locator(`#${id}`)).toBeAttached();
 await expect(page.locator('h1')).toContainText('Geometrically Consistent Triangle Splatting');
 await expect(page.locator('.authors span')).toHaveCount(6);
 expect(fetched.filter(u=>/\.(mp4|glb|wasm)(\?|$)/.test(u))).toEqual([]);
 expect(fetched.some(u=>u.includes('mesh-viewer'))).toBe(false);
 expect(errors).toEqual([]);
 const sources=await page.locator('[src],[poster],[data-src]').evaluateAll(nodes=>nodes.flatMap(n=>['src','poster','data-src'].map(a=>n.getAttribute(a)).filter(Boolean)));
 for(const url of new Set(sources.filter(s=>!s.startsWith('http'))))expect((await request.head(url)).ok(),url).toBeTruthy();
 const pdf=await request.get('static/pdfs/lidar-triangle-splatting.pdf');expect(pdf.ok()).toBeTruthy();expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
 const html=await page.content();expect(html).not.toMatch(/FIRST_AUTHOR|PAPER_TITLE|ARXIV PAPER ID|banner_video|carousel1|sample\.pdf/);
});

test('all scenes, all five baselines, color rendering, shared cameras',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');await page.locator('#activate-viewer').click();await ready(page);
 await expect(page.locator('#scene-select')).toHaveValue('replica-room0');
 await expect(page.locator('[name="display-mode"]')).toHaveCount(0);
 const initial=await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.panes.map(p=>p.url));expect(initial.every(url=>url.includes('/replica-room0/'))).toBe(true);
 const manifest=await (await page.request.get('static/data/results.json')).json();expect(manifest.defaultScene).toBe('replica-room0');let assets=0;
 for(const [scene,record] of Object.entries(manifest.scenes)){
  await page.selectOption('#scene-select',scene);await ready(page);assets++;
  for(const method of ['ts','milo','2dgs','mesh-splat','sugar']){
   await page.selectOption('#method-select',method);await ready(page);assets++;
   const state=await page.evaluate(()=>{const v=document.querySelector('#mesh-comparison').viewer;return v.panes.map(p=>({url:p.url,vertices:p.model.children.reduce((n,o)=>{o.traverse(x=>{if(x.geometry)n+=x.geometry.attributes.position.count});return n;},0),camera:p.camera.position.toArray(),target:p.controls.target.toArray()}))});
   expect(state[0].vertices).toBeGreaterThan(0);expect(state[1].vertices).toBeGreaterThan(0);expect(state[0].camera).toEqual(state[1].camera);expect(state[0].target).toEqual(state[1].target);expect(state[1].url).toContain(record.methods[method].model);
   const colorOnly=await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.panes.every(p=>{let valid=true;p.model.traverse(o=>{if(o.isMesh||o.isPoints)valid&&=o.material.vertexColors===true&&(o.material.isMeshBasicMaterial||o.material.isPointsMaterial)});return valid}));expect(colorOnly).toBe(true);
   if(method==='sugar')await expect(page.locator('#viewer-status')).toContainText('not an extracted surface mesh');
  }
 }
 expect(assets).toBe(18);expect(errors).toEqual([]);
});

test('keyboard orbit, zoom, reset and fullscreen',async({page})=>{
 await page.goto('./');await page.locator('#activate-viewer').click();await ready(page);
 const before=await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.panes[0].camera.position.toArray());
 const canvas=page.locator('[data-side="ours"] canvas');await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
 const changed=await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.panes.map(p=>p.camera.position.toArray()));expect(changed[0]).not.toEqual(before);closeVector(changed[0],changed[1]);
 await page.locator('#reset-view').click();expect(await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.panes[0].camera.position.toArray())).toEqual(before);
 const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down({button:'right'});await page.mouse.move(bounds.x+bounds.width/2+60,bounds.y+bounds.height/2+25,{steps:5});await page.mouse.up({button:'right'});
 const panned=await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.panes.map(p=>p.controls.target.toArray()));closeVector(panned[0],panned[1]);expect(panned[0]).not.toEqual(await page.evaluate(()=>document.querySelector('#mesh-comparison').viewer.config.camera.target));
 await page.locator('#fullscreen-view').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.locator('#fullscreen-view').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
});

test('rapid scene changes cannot display stale models or cameras',async({page})=>{
 await page.goto('./');await page.locator('#activate-viewer').click();await ready(page);
 await page.evaluate(()=>{const s=document.querySelector('#scene-select'),m=document.querySelector('#method-select');for(const scene of ['replica-room0','ncd-quad','utmm-fast']){s.value=scene;s.dispatchEvent(new Event('change'));}m.value='milo';m.dispatchEvent(new Event('change'));});
 await ready(page);
 const state=await page.evaluate(()=>{const v=document.querySelector('#mesh-comparison').viewer;return {scene:v.cameraSceneId,urls:v.panes.map(p=>p.url),position:v.panes[0].camera.position.toArray(),expected:v.config.camera.position}});
 expect(state.scene).toBe('utmm-fast');expect(state.urls[0]).toContain('utmm-fast/ours.glb');expect(state.urls[1]).toContain('utmm-fast/milo.glb');closeVector(state.position,state.expected);
});

test('unavailable model preserves previews and retries',async({page})=>{
 await page.route('**/models/replica-room0/ts.glb',r=>r.fulfill({status:503,body:'Unavailable'}));await page.goto('./');await page.locator('#activate-viewer').click();await expect(page.locator('#mesh-comparison')).toHaveAttribute('data-state','error');
 await expect(page.locator('[data-side="ours"] img')).toBeVisible();await expect(page.locator('[data-side="baseline"] img')).toBeVisible();
 await page.unroute('**/models/replica-room0/ts.glb');await page.locator('#activate-viewer').click();await ready(page);
});

test('WebGL failure keeps a useful static comparison',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.startsWith('webgl'))return null;return original.call(this,type,...args);};});
 await page.goto('./');await page.locator('#activate-viewer').click();await expect(page.locator('#viewer-status')).toContainText('unavailable in this browser');await expect(page.locator('[data-side="ours"] img')).toBeVisible();
 await page.selectOption('#scene-select','utmm-fast');await expect(page.locator('[data-side="ours"] img')).toHaveAttribute('src',/utmm-fast/);
});

test('optimization play, pause, speed, seeking and shorter-clip hold',async({page})=>{
 await page.goto('./');const group=page.locator('[data-video-group="optimization"]');await group.locator('[data-play]').click();await expect(group.locator('[data-play]')).toHaveText('Pause',{timeout:45000});
 await expect.poll(()=>group.evaluate(r=>r.comparison.master.currentTime)).toBeGreaterThan(.4);
 await group.locator('[data-play]').click();expect(await group.evaluate(r=>[...r.querySelectorAll('video')].every(v=>v.paused))).toBe(true);
 await group.locator('[data-speed]').selectOption('2');expect(await group.evaluate(r=>[...r.querySelectorAll('video')].every(v=>v.playbackRate===2))).toBe(true);
 await group.evaluate(r=>{const seek=r.querySelector('[data-seek]');seek.value=100;seek.dispatchEvent(new Event('input'));});
 await expect.poll(()=>group.evaluate(r=>r.querySelectorAll('video')[0].currentTime)).toBeGreaterThan(86);
 const time=await group.evaluate(r=>[...r.querySelectorAll('video')].map(v=>v.currentTime));expect(time[0]).toBeLessThan(86.8);expect(time[2]).toBeCloseTo(time[0],1);expect(time[1]).toBeCloseTo(100,1);expect(time[3]).toBeCloseTo(100,1);
 await group.locator('[data-restart]').click();await expect.poll(()=>group.evaluate(r=>[...r.querySelectorAll('video')].every(v=>v.currentTime<.1))).toBe(true);
});

test('walking clips retain durations and hold the completed clips',async({page})=>{
 await page.goto('./');const group=page.locator('[data-video-group="walking"]');await group.locator('[data-play]').click();await expect(group.locator('[data-play]')).toHaveText('Pause',{timeout:45000});
 const durations=await group.evaluate(r=>[...r.querySelectorAll('video')].map(v=>v.duration));
 const position=(Math.min(...durations)+Math.max(...durations))/2;
 await group.evaluate((r,time)=>{const seek=r.querySelector('[data-seek]');seek.value=time;seek.dispatchEvent(new Event('input'));},position);
 const seekPosition=await group.locator('[data-seek]').inputValue().then(Number);
 await expect.poll(()=>group.evaluate((r,time)=>Math.max(...[...r.querySelectorAll('video')].map(v=>Math.abs(v.currentTime-Math.min(time,v.duration-.045)))),seekPosition)).toBeLessThan(.01);
 expect(await group.evaluate(r=>[...r.querySelectorAll('video')].every(v=>v.paused))).toBe(true);
 await group.locator('[data-play]').click();await expect.poll(()=>group.evaluate(r=>r.comparison.master.currentTime)).toBeGreaterThan(seekPosition+.2);
 expect(await group.evaluate((r,time)=>[...r.querySelectorAll('video')].filter(v=>v.duration<time).every(v=>v.paused&&v.currentTime>v.duration-.1),seekPosition)).toBe(true);
 await group.locator('[data-restart]').click();await expect.poll(()=>group.evaluate(r=>[...r.querySelectorAll('video')].every(v=>v.currentTime<.1&&v.paused))).toBe(true);
});

test('mobile, reduced motion, no-JS content, and no horizontal overflow',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();await page.goto('http://127.0.0.1:4173/lidar-ts-page/');
 for(const id of ['overview','pipeline','optimization','meshes','simulation']){await page.locator(`#${id}`).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
 const boxes=await page.locator('.mesh-pane').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));expect(boxes[0].x).toBe(boxes[1].x);expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
 await page.screenshot({path:'.cache/mobile-final.png',fullPage:true});await page.locator('#activate-viewer').click();await ready(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await context.close();
 const noJS=await browser.newContext({javaScriptEnabled:false});const plain=await noJS.newPage();await plain.goto('http://127.0.0.1:4173/lidar-ts-page/');await expect(plain.locator('h1')).toBeVisible();await expect(plain.locator('[data-side="ours"] img')).toBeVisible();await noJS.close();
});

test('BibTeX can be copied with all six authors',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('./');await page.locator('#copy-citation').click();await expect(page.locator('#copy-status')).toHaveText('Citation copied.');
 const citation=(await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n');expect(citation).toContain('Yoon');expect(citation).toContain('Martin');expect(citation).toContain('2026');expect(citation).toBe(await page.locator('#bibtex-code').textContent());
});

test('all web assets fit the hosting budget',async()=>{
 const manifest=JSON.parse(await fs.readFile('static/data/results.json','utf8'));let size=0;let count=0;
 for(const scene of Object.values(manifest.scenes))for(const asset of Object.values(scene.methods)){const stat=await fs.stat(asset.model);expect(stat.size).toBeLessThan(100*1024*1024);await fs.access(asset.preview);size+=stat.size;count++;}
 expect(count).toBe(18);expect(size).toBeLessThan(700*1024*1024);
});
