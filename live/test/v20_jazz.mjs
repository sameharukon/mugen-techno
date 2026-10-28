// v20: jazzy flavour segment. (A) long おまかせ sims (scheduler only, opening + closing): occurrence per free phrase and per band,
// segment lengths / gaps, never in opening / closing / with the chip spice, in-key share of every e-piano and walking-bass note
// (deck key + mode; diatonic 9th / 11th / 6th extensions are in-scale by construction), bass register, 4/4 kick during segments.
// (B) offline renders with the segment forced on (bars 8-24 of 32): peak / NaN.   usage: node v20_jazz.mjs [seeds=6] [bars=480]
import { chromium } from 'playwright-core';
const NS=+(process.argv[2]||6),BARS=+(process.argv[3]||480),html=process.env.HTML||'/workspace/techno/live/index.html';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const SC={aeolian:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],minpent:[0,3,5,7,10]};
const out={};
for(const band of ['b120','b140','bchill']){const A={segs:[],lens:[],phrases:0,inOpening:0,inClosing:0,withChip:0,notes:0,inKey:0,ext:{},bassN:0,bassIn:0,bassLo:99,bassHi:0,gaps:[],els:{},kick4:0,jbars:0,labs:{}};
  for(let i=0;i<NS;i++){await p.goto('file://'+html);
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),9000+i*37,{opening:true});e.cond.auto=true;e.debug=true;
      for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep','drone'])e[k]=()=>{};
      const log=[],bl=[],stack=[],kb={};let logs=0;const li=e.cond.logItem.bind(e.cond);e.cond.logItem=(x,...a)=>{if(/^ジャジー \d+小節（/.test(x))logs++;return li(x,...a);};e.chipNote=()=>{};e.chipArp=()=>{};e.chipNoise=()=>{};
      e.jzEP=(t,ns)=>{for(const x of ns)log.push([e.bar,x.m,x.ext,e.low.key,e.low.mode]);};
      const ob=e.bass.bind(e);e.bass=(t,n,lm,lift)=>{if(e.jazz.on)bl.push([e.bar,e.bassMidi(n,lift),e.low.key,e.low.mode]);};
      const ok=e.kick.bind(e);e.kick=(t,v)=>{if(e.jazz.on)kb[e.bar]=(kb[e.bar]||0)+1;};
      let t=0.01,openEnd=null,closeAt=BARS-48,c0=null;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;c0=e.cond.closing?e.cond.closing.c0:null;}
        e.scheduleStep(t);t+=e.s16;if(st%16===0&&e.jazz.on&&e.chip.on)stack.push(e.bar);if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;if(e.closed)break;}
      return {segs:e.jazzSegs,log,bl,stack,kb,openEnd,c0,lastBar:e.bar,logs};},[band,i,BARS]);
    A.phrases+=Math.floor(((r.c0??r.lastBar)-r.openEnd)/16);A.withChip+=r.stack.length;A.logItems=(A.logItems||0)+(r.logs||0);
    r.segs.forEach(([s0,s1,bd,v,dr,w],k)=>{A.segs.push(s0);A.lens.push(s1-s0);const key=v+"・"+dr+(w?"・walk":"");A.els[key]=(A.els[key]||0)+1;
      if(s0<r.openEnd)A.inOpening++;if(r.c0!=null&&s1>r.c0)A.inClosing++;if(k)A.gaps.push((s0-r.segs[k-1][0])/16);
      for(let x=s0;x<s1;x++){A.jbars++;if((r.kb[x]||0)>=4)A.kick4++;}});
    for(const [bar,m,ext,key,mode] of r.log){A.notes++;A.ext[ext]=(A.ext[ext]||0)+1;if(bar<r.openEnd)A.inOpening++;if(r.c0!=null&&bar>=r.c0)A.inClosing++;if(SC[mode].includes(((m-key)%12+12)%12))A.inKey++;}
    for(const [bar,m,key,mode] of r.bl){A.bassN++;if(SC[mode].includes(((m-key)%12+12)%12))A.bassIn++;A.bassLo=Math.min(A.bassLo,m);A.bassHi=Math.max(A.bassHi,m);}}
  const q=(a,x)=>{const s=a.slice().sort((p,q)=>p-q);return s.length?s[Math.floor(x*(s.length-1))]:null;},hz=m=>+(440*Math.pow(2,(m-69)/12)).toFixed(1);
  out[band]={segments:A.segs.length,freePhrases:A.phrases,oneInPhrases:+(A.phrases/Math.max(1,A.segs.length)).toFixed(1),
    lenBars:A.lens.length?{min:Math.min(...A.lens),max:Math.max(...A.lens),mean:+(A.lens.reduce((a,b)=>a+b,0)/A.lens.length).toFixed(1)}:null,
    minGapPhrases:A.gaps.length?Math.min(...A.gaps):null,medGapPhrases:q(A.gaps,.5),elements:A.els,inOpeningOrClosing:A.inOpening+A.inClosing,stackedWithChipBars:A.withChip,
    epNotes:A.notes,epInKey:+(A.inKey/Math.max(1,A.notes)).toFixed(4),extensions:A.ext,bassNotes:A.bassN,bassInKey:+(A.bassIn/Math.max(1,A.bassN)).toFixed(4),bassHz:[hz(A.bassLo),hz(A.bassHi)],
    kick4onFloorInSegs:+(A.kick4/Math.max(1,A.jbars)).toFixed(3),logItems:A.logItems};
  console.log('===',band,JSON.stringify(out[band]));}
const R={};
for(const band of ['b120','b140','bchill'])for(const walk of [0,1]){await p.goto('file://'+html);
  R[band+(walk?'_walk':'')]=await p.evaluate(async ([band,walk])=>{let E;const r=await window.__renderOffline({band,bars:32,seed:4343+walk,auto:true,setup:e=>{E=e;e.jazzForceBar=8;e.jazzForceLen=16;
      const on=e.jazzOn.bind(e);e.jazzOn=(t,l)=>{on(t,l);e.jazz.walk=!!walk;e.jazz.ride=!walk;};}});
    return {peakDb:r.peakDb,nan:r.nan,segs:E.jazzSegs,walk:E.jazz.walk,ride:E.jazz.ride};},[band,walk]);
  console.log('render',band,walk,JSON.stringify(R[band+(walk?'_walk':'')]));}
console.log('SUMMARY',JSON.stringify({sims:out,renders:R}));console.log('errors',errs);await b.close();
