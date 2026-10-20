import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const files = process.argv.slice(2);
const b = await chromeLaunch(['--no-sandbox']);
async function harness(cfg){
  const sr=44100, bars=cfg.bars, secs=bars*16*60/(cfg.bpm-3)/4+1.5;
  const saved=JSON.stringify(S); Object.assign(S,{band:cfg.band||'b120',style:cfg.style,crash:cfg.crash,riser:true,fill:true,dropManual:false});
  const oc=new OfflineAudioContext(4,Math.ceil(sr*secs),sr);
  const e=new Engine(oc,cfg.seed>>>0);
  // kick drops are now planned by the conductor (2 bars before every 16-bar phrase end), no panel auto-drop any more
  // cfg.recipes: use the conductor's recipe generator (variety) instead of the classic default recipe
  if(cfg.auto)for(let b0=14;b0<bars;b0+=16)e.cond.addEvent({bar:b0,type:"break",len:2,btype:"kick",label:"test",recipe:cfg.recipes?e.cond.kickRecipe({len:2}):null});
  const probes=!!e.hpCtl;
  if(probes){const m=oc.createChannelMerger(4);e.hpCtl.connect(m,0,2);e.lvlCtl.connect(m,0,3);m.connect(oc.destination);}
  const rets=[],norms=[],starts=[];let prevDrop=false;
  e.onStep=(s,t,ev)=>{ if(ev.drop&&!prevDrop) starts.push(t);
    if(s===0){ if(prevDrop&&!ev.drop) rets.push(t); else if(!ev.drop&&ev.kick&&t>2) norms.push(t);} prevDrop=ev.drop; };
  let t=0.01;
  while(e.step<bars*16){ const bar=Math.floor(e.step/16); if(cfg.manual) S.dropManual = bar>=cfg.manual[0]&&bar<cfg.manual[1]; e.scheduleStep(t); t+=e.s16; }
  const buf=await oc.startRendering(); Object.assign(S,JSON.parse(saved));
  const L=buf.getChannelData(0),R=buf.getChannelData(1);
  const at=(T)=>Math.round(T*sr);
  function metrics(T){
    let d2=0; for(let i=at(T-0.025);i<at(T+0.025);i++) for(const x of [L,R]) d2=Math.max(d2,Math.abs(x[i]-2*x[i-1]+x[i-2]));
    const F=Math.round(0.005*sr), fr=[];
    for(let i=at(T-0.04);i<at(T+0.15);i+=F){let s=0;for(let j=i;j<i+F;j++){const a=L[j]-L[j-1],c=R[j]-R[j-1];s+=a*a+c*c;}fr.push(Math.sqrt(s/F/2)+1e-9);}
    let drop=0;for(let k=1;k<fr.length;k++) drop=Math.max(drop,20*Math.log10(fr[k-1]/fr[k]));
    return {d2,hfDropDb:drop};
  }
  const agg=a=>{const s=[...a].sort((x,y)=>x-y);return {med:+s[Math.floor(s.length/2)].toFixed(3),max:+s[s.length-1].toFixed(3)};};
  const nm=norms.map(metrics), rm=rets.map(metrics), sm=starts.map(metrics);
  let pk=0,nan=0;for(const x of [L,R])for(let i=0;i<x.length;i++){if(!Number.isFinite(x[i]))nan++;else pk=Math.max(pk,Math.abs(x[i]));}
  const out={cfg:`${cfg.band||'b120'}:${cfg.style} bpm${cfg.bpm}${cfg.recipes?' recipes':''} ${cfg.auto?'auto':'manual'} crash:${cfg.crash}`,peakDb:+(20*Math.log10(pk)).toFixed(2),nan,
    returns:rets.map(x=>+x.toFixed(3)),
    normal:{d2:agg(nm.map(m=>m.d2)),hfDropDb:agg(nm.map(m=>m.hfDropDb))},
    atReturn:rm.map(m=>({d2:+m.d2.toFixed(3),hfDropDb:+m.hfDropDb.toFixed(2)})),
    atStart:sm.map(m=>({d2:+m.d2.toFixed(3),hfDropDb:+m.hfDropDb.toFixed(2)}))};
  if(probes){const P=[buf.getChannelData(2),buf.getChannelData(3)];
    const st=P.map(p=>{let md=0,mi=0;for(let i=1;i<p.length;i++){const d=Math.abs(p[i]-p[i-1]);if(d>md){md=d;mi=i;}}return {maxStepPerSample:+md.toPrecision(3),at:+(mi/sr).toFixed(3)};});
    out.probes={hpHz:st[0],riserLvl:st[1],
      around:rets.map(T=>({hp:[-0.15,-0.12,-0.06,-0.001,0.001,0.05].map(o=>+P[0][at(T+o)].toFixed(1)),
                         lvl:[-0.05,-0.001,0.001,0.1,0.2,0.4].map(o=>+P[1][at(T+o)].toFixed(4))}))};}
  return out;
}
for (const f of files){
  const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.goto(fileUrl(f));
  console.log('=== '+f);
  const cfgs=[{style:'minimal',bpm:124,seed:42,auto:true,bars:34,crash:false},{style:'hard',band:'b140',bpm:144,seed:42,auto:true,bars:34,crash:false},{style:'hard',band:'b120',bpm:129,seed:42,auto:true,bars:34,crash:false},
    {style:'groove',band:'b140',bpm:137,seed:8,auto:true,recipes:true,bars:50,crash:true},{style:'minimal',bpm:124,seed:9,auto:true,recipes:true,bars:50,crash:true},
    {style:'tribal',bpm:124,seed:5,auto:false,manual:[5,7],bars:12,crash:false},{style:'minimal',bpm:124,seed:42,auto:true,bars:18,crash:true},{style:'groove',bpm:124,seed:3,auto:false,manual:[3,4],bars:8,crash:true}];
  for(const c of cfgs){ console.log(JSON.stringify(await p.evaluate(`(${harness.toString()})(${JSON.stringify(c)})`))); }
  console.log('errors',errs); await p.close();
}
await b.close();
