// v14: key choice / register check.  (1) key + mode distribution over many seeds per band (start of set)
// (2) long おまかせ sims (scheduler only, pitched voices recorded): key-change frequency + size per deck swap,
//     register (median / p5 / p95 MIDI + bass fundamental Hz) of bass / 上モノ / pad, kick-tail Hz
// usage: node v14_keys.mjs [label] [html (default ../index.html)] [nSeeds=300] [simSeeds=8] [bars=384]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const label=process.argv[2]||'',html=process.argv[3]||HTML,NS=+(process.argv[4]||300),SS=+(process.argv[5]||8),BARS=+(process.argv[6]||384);
const b=await chromeLaunch(['--no-sandbox']);
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(fileUrl(html));
const out={};
const NM=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const q=(a,x)=>{const s=a.slice().sort((p,q)=>p-q);return s.length?s[Math.floor(x*(s.length-1))]:null;};
const hz=m=>+(440*Math.pow(2,(m-69)/12)).toFixed(1);
for(const band of ['b120','b140','bchill']){const keys={},modes={};
  for(let c=0;c<NS;c+=25){await p.goto(fileUrl(html));const r=await p.evaluate(([band,c,n])=>{const res=[];S.band=band;
      for(let i=c;i<c+n;i++){S.style=BANDS[band].first;const oc=new OfflineAudioContext(2,4410,44100),e=new Engine(oc,5000+i*13);res.push([((S.key%12)+12)%12,e.low.mode||"(none)"]);}return res;},[band,c,Math.min(25,NS-c)]);
    for(const [k,m] of r){keys[NM[k]]=(keys[NM[k]]||0)+1;modes[m]=(modes[m]||0)+1;}}
  let swaps=0,chg=0;const sizes={},rec={bass:[],up:[],pad:[]},tails=[],modeSw={};
  for(let i=0;i<SS;i++){await p.goto(fileUrl(html));const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),9000+i*31);e.cond.auto=true;
      const rec={bass:[],up:[],pad:[]},R=(part,m)=>rec[part].push(m);
      e.synth=(t,m)=>R('up',m);e.stab=(t,d,r)=>R('up',r!=null?r:57+keyOff());e.hardStab=(t,r)=>R('up',r-12);e.acid=(t,m)=>R('up',m);e.fmHit=(t,m)=>R('up',m);
      e.organ=(t,r)=>R('up',r);e.vox=(t,m)=>R('up',m);e.marimba=(t,m)=>R('up',m);e.flute=(t,m)=>R('up',m);e.pulse=(t,m)=>R('up',m);e.bleep=(t,m)=>R('up',m);
      e.drone=(t,d,o)=>R('pad',o.midi);
      e.bass=function(t,note,lm,lift){R('bass',e.bassMidi?e.bassMidi(note,lift):(()=>{const r0=33+keyOff();let m=r0+MINOR_PENT[note.deg]+12*note.oct;if(lift&&m<r0)m+=12;return m;})());};
      for(const k of ['kick','hat','clap','perc','snare','crash','noiseWash','revCym','riserFx'])if(typeof e[k]==='function'&&k!=='kick')e[k]=()=>{};
      let t=0.01,low=e.low,key=S.key;const sw=[],tails=[];
      for(let st=0;st<BARS*16;st++){e.scheduleStep(t);t+=e.s16;
        if(st%16===15){if(e.low!==low){sw.push([((S.key-key)%12+12)%12,e.low.mode||""]);low=e.low;key=S.key;}
          if(st%64===63)tails.push(e.tailRoot?e.tailRoot(e.kp.f1):(e.kp.tune>0.001?55:e.kp.f1));}}
      return {rec,sw,tails};},[band,i,BARS]);
    for(const k of ['bass','up','pad'])for(const m of r.rec[k])rec[k].push(m);tails.push(...r.tails);
    for(const [d,m] of r.sw){swaps++;const sz=d>6?d-12:d;sizes[sz]=(sizes[sz]||0)+1;if(sz)chg++;if(m)modeSw[m]=(modeSw[m]||0)+1;}}
  const pct=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(v/NS).toFixed(3)]));
  const reg=a=>({n:a.length,p5:q(a,.05),med:q(a,.5),p95:q(a,.95)}),br=reg(rec.bass);
  out[band]={keys:pct(keys),amShare:+((keys.A||0)/NS).toFixed(3),rootsInRange:+(["F","F#","G","G#","A","A#","B"].reduce((a,k)=>a+(keys[k]||0),0)/NS).toFixed(3),startModes:pct(modes),
    swaps,keyChangesPerSwap:+(chg/Math.max(1,swaps)).toFixed(3),changeSizeSemis:sizes,swapModes:modeSw,
    register:{bass:{...br,hzP5:hz(br.p5),hzMed:hz(br.med),hzP95:hz(br.p95)},up:reg(rec.up),pad:reg(rec.pad)},
    kickTailHz:{min:+Math.min(...tails).toFixed(1),med:+q(tails,.5).toFixed(1),max:+Math.max(...tails).toFixed(1)}};
  console.log(`=== ${band} ${label}`);console.log(JSON.stringify(out[band]));}
console.log('SUMMARY',JSON.stringify(out));console.log('errors',errs);await b.close();
