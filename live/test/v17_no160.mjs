// v17: the 160 band is gone. UI shows no 160 references, no console errors; band intents never reach 160;
// 「もっと速く」 = one band step up (チル帯→120帯→140帯), inside 140帯 a tempo nudge capped at 148 BPM.
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const b=await chromeLaunch(['--autoplay-policy=no-user-gesture-required','--no-sandbox']);
const p=await b.newPage({viewport:{width:1080,height:1000}});const errs=[];
p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text());});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
await p.goto(fileUrl(HTML, '?noopening'));await p.waitForTimeout(400);
const ui=await p.evaluate(()=>({text:document.body.innerText,bands:[...document.querySelectorAll('[data-band]')].map(x=>x.textContent),
  intents:[...document.querySelectorAll('#intents [data-intent]')].map(x=>x.textContent),bandKeys:Object.keys(BANDS),styleBands:Object.keys(STYLE_BAND)}));
const bad=/160|シュランツ|クロスブリード|ハードコア|ガバ/;
console.log('band buttons',ui.bands.join(' / '),'| BANDS',ui.bandKeys.join(','),'| STYLE_BAND',ui.styleBands.join(','));
console.log('intent buttons',ui.intents.length,ui.intents.join(' / '));
console.log('UI text 160/Schranz refs:',(ui.text.match(new RegExp(bad.source,'g'))||[]).length);
// intents on a fresh engine per band (offline sim, no audio): band changes and tempo clamp
const res=await p.evaluate(()=>{const out=[];
  for(const [band,texts] of [['bchill',['もっと速く']],['b120',['もっと速く']],['b140',Array(8).fill('もっと速く')],['b140',Array(8).fill('少しテンポを上げて')],
                             ['b120',['160帯で','シュランツに','ハードコアに','クロスブリードで']],['b140',['160帯で','ハードコアにして']]]){
    S.band=band;S.style=BANDS[band].first;const oc=new OfflineAudioContext(2,44100,44100),e=new Engine(oc,7,{});
    const r=texts.map(t=>{const x=e.cond.intent(t);return (x.labels||[]).join('、')||'(none)';});
    out.push({band,texts:texts[0]+(texts.length>1?' ×'+texts.length:''),pending:e.cond.pendingBand||null,tempoTarget:+e.cond.tempoTarget().toFixed(2),max:BANDS[band].max,labels:r.slice(-1)[0]});}
  return out;});
for(const x of res)console.log(JSON.stringify(x));
const fail=res.filter(x=>x.pending==='b160'||x.tempoTarget>148).length+(ui.bandKeys.includes('b160')?1:0)+(bad.test(ui.text)?1:0);
console.log('fails',fail,'errors',errs);await b.close();
