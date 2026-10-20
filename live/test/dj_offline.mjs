import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const b = await chromeLaunch(['--no-sandbox']);
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text());});
await p.goto(fileUrl(HTML));
const runs = process.argv[2]==='quick' ? [
  {name:'scripted', bars:40, seed:7, intents:[{bar:1,text:'一気にハードに'}]}
] : [
  {name:'scripted intents', bars:120, seed:7, intents:[{bar:1,text:'もっとハードに'},{bar:20,text:'少し暗く'},{bar:36,text:'グルーヴを出して'},{bar:70,text:'ブレイク入れて'},{bar:80,text:'一気にトライバルに'},{bar:100,text:'落ち着かせて'}]},
  {name:'おまかせ journey (120帯)', bars:176, seed:99, auto:true},
  {name:'band up then down', bars:120, seed:11, intents:[{bar:4,text:'140帯に上げて'},{bar:40,text:'もっとハードに'},{bar:70,text:'120帯に戻して'}]},
  {name:'manual drop across swap', bars:44, seed:3, intents:[{bar:1,text:'一気にトライバルに'}], manualDrop:[6,9]},
];
for (const r of runs){
  const t0=Date.now();
  const out = await p.evaluate(o=>window.__renderOffline(o), r);
  console.log('=== '+r.name+' ('+((Date.now()-t0)/1000).toFixed(0)+'s render)');
  console.log(JSON.stringify(out,null,0));
}
console.log('errors',errs); await b.close();
