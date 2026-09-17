import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:4173/lidar-ts-page/');await page.locator('#meshes').scrollIntoViewIfNeeded();
await page.locator('#activate-viewer').click();await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#mesh-comparison').dataset.state),{},{timeout:180000});
await page.locator('#mesh-comparison').screenshot({path:'.cache/mesh-first.png'});
console.log(await page.locator('#viewer-status').textContent());console.log(errors);
await browser.close();
