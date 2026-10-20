// v24: EN coverage of engine-generated texts. Offline autopilot renders (all bands, several seeds, every intent button / break)
// collect every log text, source, event label, interpretation label and break/drop info; plus all name tables.
// Each string goes through the UI translator (enTx); prints any output that still contains Japanese.
// usage: node v24_i18n_cov.mjs [seeds=3] [bars=320]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const seeds=+(process.argv[2]||3),bars=+(process.argv[3]||320);
const b=await chromeLaunch(['--autoplay-policy=no-user-gesture-required','--no-sandbox']);
const p=await b.newPage({locale:'en-US'});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(fileUrl(HTML, '?noopening'));await p.waitForTimeout(300);
const res=await p.evaluate(async({seeds,bars})=>{
  const T=new Set(),add=x=>{if(x!=null&&x!=="")T.add(String(x));};
  const tables=[PART_JA,PARAM_JA,PHASE_JA,CHILL_MODE_JA,MODE_JA,KD_REM_JA,KD_FILL_JA,KD_RISER_JA,KD_IMP_JA,HAT_FAM_JA,HAT_PAT_JA,CLAP_JA,PERC_JA,ORGAN_ART_JA,SECTION_JA];
  for(const t of tables)Object.values(t).forEach(add);MOTIF_OPS.forEach(add);
  for(const k in BANDS){add(BANDS[k].ja);Object.values(BANDS[k].phaseJa||{}).forEach(add);}
  for(const bd in STYLE_BAND)for(const st in STYLE_BAND[bd])add(STYLE_BAND[bd][st].ja);
  for(const k in BREAKS){add(BREAKS[k].ja);add(BREAKS[k].desc);}
  for(const P of [PATCHES,PATCHESCH])for(const st in P)for(const x of P[st])add(x.ja);CHILL_PATCHES.forEach(x=>add(x.ja));
  for(const f in HAT_FAM_JA)for(const pt in HAT_PAT_JA)for(const c in CLAP_JA)add(`${HAT_FAM_JA[f]}ハット・${HAT_PAT_JA[pt]}／${CLAP_JA[c]}／${Object.values(PERC_JA).slice(0,3).join("・")}`);
  [...INTENT_BTNS,...SUGGEST].forEach(t=>{add(t);add(`「${t}」`);});
  QUICK_BRK.forEach(k=>add(`ボタン「${k==="おまかせ"?"おまかせ":BREAKS[k].ja}」`));
  const intents=[];let bar=20;for(const t of [...INTENT_BTNS,...SUGGEST,...BREAK_ORDER.map(k=>BREAKS[k].ja)]){intents.push({bar,text:t});bar+=9;}
  for(const band of ["b120","b140","bchill"])for(let i=0;i<seeds;i++){
    const r=await __renderOffline({band,bars,seed:9100+i*37,auto:true,intents:i===0?intents.filter(x=>x.bar<bars-8):[],setup:e=>{const C=e.cond;
      const lg=C.logItem.bind(C);C.logItem=(t,src,...a)=>{add(t);add(src);return lg(t,src,...a);};
      const ae=C.addEvent.bind(C);C.addEvent=ev=>{add(ev.label);return ae(ev);};
      const sb=e.scheduleStep.bind(e);e.scheduleStep=t=>{sb(t);if(e.step%64===0){if(e.low&&e.low.kit)add(e.kitDesc(e.low.kit));for(const d of e.decks)if(d.arr&&d.arr.init)add(((d.arr.chillPatch||patchList(d)[d.arr.variant])||{}).ja);}
        if(e.drop.active){const D=e.drop,B=BREAKS[D.type];if(D.type==="kick"&&D.recipe)add(D.recipe.name);add(B&&B.ja);}};}});
    for(const it of r.intents)for(const l of it.labels||[])add(l);}
  const JA=/[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
  const all=[...T].filter(x=>JA.test(x)),pairs=all.map(x=>[x,enTx(x)]);
  return {n:all.length,left:pairs.filter(([a,b])=>JA.test(b)),sample:pairs};},{seeds,bars});
console.log('strings',res.n,'leftJA',res.left.length);
for(const [a,b] of res.left)console.log('LEFT',a,'=>',b);
if(process.env.SAMPLE)for(const [a,b] of res.sample)console.log('S',a,'=>',b);
console.log('errors',errs);await b.close();
