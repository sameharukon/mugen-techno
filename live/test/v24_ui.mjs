// v24: fixed layout + JA/EN UI. Runs autopilot in real time (run it alone), samples the bounding boxes of the main containers
// and buttons every second, scans the EN DOM (text + tooltips) for leftover Japanese, switches language live, takes screenshots.
// usage: node v24_ui.mjs [secondsPerBandEN=120]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const SEC=+(process.argv[2]||120);
const JA_RE=/[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
const SEL=['main','#viz','.top','#play','#bandbchill','#bandb120','#bandb140','.vol','#status','.cols','.cols>.card:nth-child(1)','.cols>.card:nth-child(2)',
  '#holdinfo','#intents','#breaks','.interpbox','#interp','#suggest','#logwrap','#log','#logcount','#phrase','.styles','#nowStyle','#arrow','#nextStyle','.keyrow','#keyinfo','#bpm',
  '#setlist','#arc','.prog','#mixinfo','#upinfo','#meters','#timeline','#langsel'];
const b = await chromeLaunch(['--autoplay-policy=no-user-gesture-required','--no-sandbox']);
const out={runs:[]};
async function run({lang,w,bands,sec,shot,switchLive,narrow}){
  const ctx=await b.newContext({viewport:{width:w,height:1000},locale:lang==='ja'?'ja-JP':'en-US'});const p=await ctx.newPage();const errs=[];
  p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text());});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(fileUrl(HTML));await p.waitForTimeout(400);
  const htmlLang=await p.evaluate(()=>document.documentElement.lang);
  const rects=()=>p.evaluate(S=>Object.fromEntries(S.map(s=>{const e=document.querySelector(s);if(!e)return [s,null];const r=e.getBoundingClientRect();return [s,[r.x,r.y+scrollY,r.width,r.height].map(v=>+v.toFixed(2))];})),SEL);
  const scanJa=()=>p.evaluate(src=>{const re=new RegExp(src);const hits=[];
    for(const l of document.body.innerText.split('\n'))if(re.test(l))hits.push('text: '+l.trim());
    for(const e of document.querySelectorAll('[title]'))if(re.test(e.title))hits.push('title: '+e.title);
    if(re.test(document.title))hits.push('doctitle: '+document.title);return hits;},JA_RE.source);
  const base={},maxD={},ja=new Set();let samples=0,switched=null;
  for(const band of bands){
    await p.evaluate(()=>{if(playing)stop();});await p.waitForTimeout(300);
    await p.click('#band'+band);await p.click('#play');
    for(let i=0;i<sec;i++){await p.waitForTimeout(1000);
      if(switchLive&&band===bands[1]&&i===Math.floor(sec/2)){   // live language switch during playback
        const before=await p.textContent('#intents button');await p.click('#lang-'+(lang==='en'?'ja':'en'));await p.waitForTimeout(400);
        const mid=await p.textContent('#intents button'),midLang=await p.evaluate(()=>document.documentElement.lang);await p.waitForTimeout(1500);
        await p.click('#lang-'+lang);await p.waitForTimeout(400);
        switched={before,mid,midLang,after:await p.textContent('#intents button'),stored:await p.evaluate(()=>localStorage.getItem('mugentechno.lang'))};}
      const r=await rects();samples++;
      for(const [s,v] of Object.entries(r)){if(!v)continue;if(!base[s])base[s]=v;const d=Math.max(...v.map((x,k)=>Math.abs(x-base[s][k])));maxD[s]=Math.max(maxD[s]||0,d);}
      if(lang==='en'&&(i%5===4||i===sec-1))for(const h of await scanJa())ja.add(h);
      if(shot&&band===bands[0]&&i===Math.min(sec-1,45))await p.screenshot({path:join(HERE, shot)});}
    }
  const extra={};
  if(narrow)extra.narrow=await p.evaluate(()=>{const c=[...document.querySelectorAll('.cols>.card')].map(e=>e.getBoundingClientRect());
    return {stacked:c[1].top>=c[0].bottom-1,sameLeft:Math.abs(c[0].left-c[1].left)<1,scrollW:document.documentElement.scrollWidth,clientW:document.documentElement.clientWidth};});
  const worst=Object.entries(maxD).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const res={lang,w,bands,sec,htmlLang,samples,maxShiftPx:Math.max(0,...Object.values(maxD)),worst,jaLeft:[...ja],switched,errors:errs,...extra};
  out.runs.push(res);console.log('RUN',JSON.stringify(res));await ctx.close();}
await run({lang:'en',w:1080,bands:['b120','b140','bchill'],sec:SEC,shot:'screenshot_en.png',switchLive:true});
await run({lang:'ja',w:1280,bands:['b120','b140','bchill'],sec:Math.round(SEC*0.4),switchLive:true});
await run({lang:'ja',w:1080,bands:['b120'],sec:50,shot:'screenshot.png'});
await run({lang:'en',w:1280,bands:['b140'],sec:40});
await run({lang:'en',w:390,bands:['b120'],sec:20,narrow:true});
console.log('SUMMARY',JSON.stringify(out.runs.map(r=>({lang:r.lang,w:r.w,samples:r.samples,maxShiftPx:r.maxShiftPx,jaLeft:r.jaLeft.length,errors:r.errors.length,narrow:r.narrow,switched:r.switched}))));
await b.close();
