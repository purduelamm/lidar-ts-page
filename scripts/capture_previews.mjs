import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile('static/data/results.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});await page.goto('http://127.0.0.1:4173/lidar-ts-page/');await page.locator('#activate-viewer').click();
async function ready(){await page.waitForFunction(()=>document.querySelector('#mesh-comparison').dataset.state==='ready',null,{timeout:180000});}
await ready();
for(const [id,scene] of Object.entries(manifest.scenes)){
 await page.selectOption('#scene-select',id);await ready();
 for(const method of Object.keys(scene.methods).filter(k=>k!=='ours')){
  await page.selectOption('#method-select',method);await ready();await page.locator('#reset-view').click();
  for(const [side,key] of [['ours','ours'],['baseline',method]]){
   const image=await page.evaluate(side=>{const v=document.querySelector('#mesh-comparison').viewer;v.render();return v.panes[side==='ours'?0:1].canvas.toDataURL('image/jpeg',.9).split(',')[1];},side);
   await fs.writeFile(`static/images/meshes/${id}/${key}.jpg`,Buffer.from(image,'base64'));
  }
  await page.locator('#mesh-comparison').screenshot({path:`.cache/${id}-${method}-color.png`});
  await page.check('[name="display-mode"][value="geometry"]');
  await page.locator('#mesh-comparison').screenshot({path:`.cache/${id}-${method}-geometry.png`});
  await page.check('[name="display-mode"][value="color"]');
  console.log('Captured',id,method);
 }
}
await browser.close();
