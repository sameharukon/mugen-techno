// v15: chiptune spice layer. (A) long おまかせ sims (scheduler only, opening + closing): occurrence per free phrase, segment lengths,
// gaps, never in opening / closing, in-key share of every chip note (deck key + mode). (B) offline renders with the layer forced on: peak / NaN.
// usage: node v15_chip.mjs [seeds=6] [bars=480]
import { chromium } from 'playwright-core';
const NS=+(process.argv[2]||6),BARS=+(process.argv[3]||480),html='/workspace/techno/live/index.html';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const out={};
for(const band of ['b120','b140','bchill']){const A={segs:[],lens:[],phrases:0,inOpening:0,inClosing:0,notes:0,inKey:0,gapsPhrases:[],modes:{}};
  for(let i=0;i<NS;i++){await p.goto('file://'+html);
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),7000+i*41,{opening:true});e.cond.auto=true;e.debug=true;
      for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep','drone'])e[k]=()=>{};
      const log=[];e.chipNote=(t,m)=>log.push([e.bar,m,e.chip.deck.key,e.chip.deck.mode]);e.chipArp=(t,ms)=>{for(const m of ms)log.push([e.bar,m,e.chip.deck.key,e.chip.deck.mode]);};e.chipNoise=()=>{};
      let t=0.01,openEnd=null,closeAt=BARS-48,c0=null;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;c0=e.cond.closing?e.cond.closing.c0:null;}
        e.scheduleStep(t);t+=e.s16;if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;if(e.closed)break;}
      return {segs:e.chipSegs,log,openEnd,c0,lastBar:e.bar};},[band,i,BARS]);
    const free=Math.floor(((r.c0??r.lastBar)-r.openEnd)/16);A.phrases+=free;
    r.segs.forEach(([s0,s1,bd,mode],k)=>{A.segs.push(s0);A.lens.push(s1-s0);if(s1-s0<8)A.short=(A.short||0)+1;A.modes[mode]=(A.modes[mode]||0)+1;if(s0<r.openEnd)A.inOpening++;if(r.c0!=null&&s1>r.c0)A.inClosing++;if(k)A.gapsPhrases.push((s0-r.segs[k-1][0])/16);});
    for(const [bar,m,key,mode] of r.log){A.notes++;if(bar<r.openEnd)A.inOpening++;if(r.c0!=null&&bar>=r.c0)A.inClosing++;const rel=((m-key)%12+12)%12;if(({aeolian:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],minpent:[0,3,5,7,10]})[mode].includes(rel))A.inKey++;}}
  const q=(a,x)=>{const s=a.slice().sort((p,q)=>p-q);return s.length?s[Math.floor(x*(s.length-1))]:null;};
  out[band]={segments:A.segs.length,freePhrases:A.phrases,perPhrase:+(A.segs.length/Math.max(1,A.phrases)).toFixed(3),oneInPhrases:+(A.phrases/Math.max(1,A.segs.length)).toFixed(1),
    lenBars:{min:Math.min(...A.lens),max:Math.max(...A.lens),mean:+(A.lens.reduce((a,b)=>a+b,0)/Math.max(1,A.lens.length)).toFixed(1)},minGapPhrases:Math.min(...A.gapsPhrases),medGapPhrases:q(A.gapsPhrases,.5),
    modes:A.modes,shorterThan8:A.short||0,inOpeningOrClosing:A.inOpening+A.inClosing,notes:A.notes,inKeyShare:+(A.inKey/Math.max(1,A.notes)).toFixed(4)};
  console.log('===',band,JSON.stringify(out[band]));}
// (B) renders with the layer forced on (bars 8-24 of 32)
const R={};
for(const band of ['b120','b140','bchill']){await p.goto('file://'+html);
  R[band]=await p.evaluate(async band=>{let E;const r=await window.__renderOffline({band,bars:32,seed:4242,auto:true,setup:e=>{E=e;e.chipForceBar=8;e.chipForceLen=16;}});
    return {peakDb:r.peakDb,nan:r.nan,segs:E.chipSegs,chipNotes:E.chipLog.length};},band);
  console.log('render',band,JSON.stringify(R[band]));}
console.log('SUMMARY',JSON.stringify({sims:out,renders:R}));console.log('errors',errs);await b.close();
