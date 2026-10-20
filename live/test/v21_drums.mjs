// v21: hats / claps / percussion variety over long おまかせ sets (scheduler-only sim; drum voices replaced by recorders while drumsTop runs).
// Per set and part (hat / clap / perc): distinct bar patterns (all hits, main hits), distinct timbre signatures, hat freq / decay ranges,
// repetition (exact repeat of the previous bar, of any of the previous 8 bars, mean max-Jaccard vs the previous 8 bars),
// change share at phrase boundaries (4 bars before vs after) and at deck swaps, perc voices sounding at once (max / share >3), hits per bar.
// usage: node v21_drums.mjs [label] [html] [seeds=5] [bars=384]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const label=process.argv[2]||'',html=process.argv[3]||HTML,NS=+(process.argv[4]||5),BARS=+(process.argv[5]||384);
const b=await chromeLaunch(['--no-sandbox']);
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const res={};
for(const band of ['b120','b140','bchill']){const A=[];
  for(let i=0;i<NS;i++){await p.goto(fileUrl(html));
    A.push(await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),5000+i*101,{opening:true});e.cond.auto=true;
      for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep','drone','jzEP','chipNote','chipArp','chipNoise','kick','bass','riserFx'])if(e[k])e[k]=()=>{};
      let inD=false,curS=0;const rec=[];const R=(part,sig,vel,t)=>{if(inD)rec.push([e.bar,curS,part,sig,vel]);};
      const partOf=bus=>bus===e.cur.perc?'perc':bus===e.cur.clap?'clap':'hat';
      e.hat=(t,vel,dur,tau,pan,freq=7000,bus=e.cur.hat,type="highpass")=>R(partOf(bus),'n'+type[0]+Math.round(freq/1000)+'/'+Math.round(Math.log2(tau*1000)*2),vel,t);
      e.ride=(t,vel,bus)=>R(bus?partOf(bus):'perc','ride',vel,t);
      e.clap=(t,vel)=>R('clap','clap',vel,t);e.snare=(t,vel)=>R('clap','snare',vel,t);
      e.tom=(t,v,vel)=>R('perc','tom'+v,vel,t);
      if(e.metalHat)e.metalHat=(t,vel,tau,bus=e.cur.hat)=>R(partOf(bus),'metal/'+Math.round(Math.log2(tau*1000)*2),vel,t);
      if(e.clapK)e.clapK=(t,vel,tim)=>R('clap','clap:'+tim,vel,t);
      if(e.pz)e.pz=(t,kind,midi,vel)=>R('perc',kind,vel,t);
      const hp={f:[],tau:[]};const oh=e.hat;
      const od=e.drumsTop.bind(e);e.drumsTop=(d,t,s,...a)=>{if(d!==e.low){return od(d,t,s,...a);}inD=true;curS=s;try{return od(d,t,s,...a);}finally{inD=false;}};
      const lows=[];let t=0.01,openEnd=null;
      for(let st=0;st<BARS*16;st++){e.scheduleStep(t);t+=e.s16;if(st%16===0)lows.push(e.low.id);if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;}
      return {rec,lows,openEnd};},[band,i,BARS]));}
  // analysis
  const parts=['hat','clap','perc'],out={};
  for(const part of parts){const M={dAll:[],dMain:[],dTim:[],ex1:[],ex8:[],jac:[],phr:[],swp:[],hits:[],fr:new Set(),tauR:[],kinds:new Set()};
    let pmax=0,p3=0,pSteps=0;
    for(const r of A){const B={};for(const [bar,s,pt,sig,vel] of r.rec){if(pt!==part||bar<r.openEnd)continue;const x=B[bar]||(B[bar]={all:new Set(),main:new Set(),tim:new Set(),n:0,step:{}});
        x.all.add(s);if(vel>=0.14||part!=='hat')x.main.add(s);x.tim.add(sig);x.n++;(x.step[s]||(x.step[s]=new Set())).add(sig);M.kinds.add(sig.split('/')[0]);}
      const bars=Object.keys(B).map(Number).sort((a,b)=>a-b);const key=x=>[...x].sort((a,b)=>a-b).join(',');
      M.dAll.push(new Set(bars.map(b=>key(B[b].all))).size);M.dMain.push(new Set(bars.map(b=>key(B[b].main))).size);M.dTim.push(new Set(bars.flatMap(b=>[...B[b].tim])).size);
      let e1=0,e8=0,j=0,n=0;
      for(const b of bars){const k=key(B[b].main);if(B[b-1]&&key(B[b-1].main)===k)e1++;let any=false,mj=0;
        for(let q=1;q<=8;q++){const y=B[b-q];if(!y)continue;if(key(y.main)===k)any=true;const I=[...B[b].all].filter(x=>y.all.has(x)).length,U=new Set([...B[b].all,...y.all]).size;mj=Math.max(mj,U?I/U:1);}
        if(any)e8++;j+=mj;n++;M.hits.push(B[b].n);
        if(part==='perc')for(const s in B[b].step){pSteps++;const c=B[b].step[s].size;pmax=Math.max(pmax,c);if(c>3)p3++;}}
      if(n){M.ex1.push(e1/n);M.ex8.push(e8/n);M.jac.push(j/n);}
      const sig=(b0,b1)=>{const s=new Set();for(let b=b0;b<b1;b++)if(B[b]){s.add('p'+key(B[b].main));for(const x of B[b].tim)s.add('t'+x);}return [...s].sort().join('|');};
      let pc=0,pn=0;for(let b=r.openEnd+16;b<BARS-8;b+=16){if(!B[b-1]&&!B[b])continue;pn++;if(sig(b-4,b)!==sig(b,b+4))pc++;}M.phr.push(pn?pc/pn:0);
      let sc=0,sn=0;for(let k=1;k<r.lows.length;k++)if(r.lows[k]!==r.lows[k-1]&&k>r.openEnd+4&&k<BARS-8){sn++;if(sig(k-4,k)!==sig(k+2,k+6))sc++;}M.swp.push(sn?sc/sn:null);}
    const mean=a=>{a=a.filter(x=>x!=null);return a.length?+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(3):null;};
    out[part]={distinctPatAll:mean(M.dAll),distinctPatMain:mean(M.dMain),distinctTimbres:mean(M.dTim),kinds:[...M.kinds].sort(),exactPrevBar:mean(M.ex1),exactIn8:mean(M.ex8),jaccardMax8:mean(M.jac),
      phraseChange:mean(M.phr),swapChange:mean(M.swp),hitsPerBar:mean(M.hits),...(part==='perc'?{maxPercAtOnce:pmax,shareOver3:+(p3/Math.max(1,pSteps)).toFixed(4)}:{})};}
  res[band]=out;console.log('==',band);for(const k of parts)console.log(' ',k.padEnd(5),JSON.stringify(out[k]));}
console.log('RESULT',JSON.stringify({label,res}));console.log('errors',errs);await b.close();
