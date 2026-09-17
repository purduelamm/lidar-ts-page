import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});await page.goto('http://127.0.0.1:4173/lidar-ts-page/');await page.locator('#activate-viewer').click();
await page.waitForFunction(()=>document.querySelector('#mesh-comparison').dataset.state==='ready',null,{timeout:120000});
for(const scene of ['utmm-fast','replica-room0','ncd-quad']){
 await page.selectOption('#scene-select',scene);await page.waitForFunction(()=>document.querySelector('#mesh-comparison').dataset.state==='ready',null,{timeout:120000});
 for(const [i,offset] of [[1.8,-2.25,2],[-1.8,2.25,2],[-1.8,-2.25,2],[1.8,2.25,2]].entries()){
  await page.evaluate(offset=>{const v=document.querySelector('#mesh-comparison').viewer;const c=v.config.camera;const r=c.maxDistance/10;v.config.camera={...c,position:c.target.map((p,i)=>p+offset[i]*r)};v.reset();},offset);
  await page.locator('.mesh-panes').screenshot({path:`.cache/${scene}-camera${i}.png`});
 }
}
await browser.close();
