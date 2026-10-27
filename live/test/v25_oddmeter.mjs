// v25: odd-meter (変拍子) accents over a rigid 4/4.
//  A) forced segments (every grouping, every band): kick on every quarter of every bar, pluck exactly on the group starts
//     ((bar-start)*16+s) mod span (chill band: the deck's own kick pattern, untouched), pluck notes on chord tones of the current chord, bar length unchanged (16 steps / bar)
//  B) long おまかせ sims (scheduler only, voices replaced by recorders): share of bars with the accents (overall / by phase),
//     segment lengths + start lines, and coexistence with other upper parts (chip / jazzy / strip / layer-2 / dense lead / 2 decks)
// usage: node v25_oddmeter.mjs [seeds=6] [bars=448]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';
const here=path.dirname(fileURLToPath(import.meta.url)),html=path.resolve(here,'../index.html');
const NS=+(process.argv[2]||6),BARS=+(process.argv[3]||448);
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file://'+html);
const A=await p.evaluate(()=>{const out=[];
  for(const band of ['b120','b140','bchill'])for(const pat of Object.keys(ODD_PATS)){S.band=band;S.style=BANDS[band].first;
    const e=new Engine(new OfflineAudioContext(2,4410,44100),4242+pat.length,{opening:false});e.cond.auto=false;e.debug=true;
    const K=[],Pl=[];let bad=0;e.kick=(t,v)=>K.push([e.bar,e.step%16]);
    e.oddPluck=(t,m)=>{const d=e.odd.deck,root=57+offOf(d.key!=null?d.key:S.key),pcs=e.chordPcs(d);if(!pcs.includes((((m-root)%12)+12)%12))bad++;Pl.push([e.bar,e.step%16]);};
    e.oddForceBar=32;e.oddForceLen=16;e.oddForcePat=pat;let t=0.01;const dropBars=new Set(),upBad=[],KB={};
    for(let st=0;st<56*16;st++){e.scheduleStep(t);t+=e.s16;if(e.drop.active)dropBars.add(e.bar);if(st%16===0)KB[e.bar]=e.low.kickBar.map((v,i)=>v?i:-1).filter(i=>i>=0).join(',');
      if(st%16===0&&e.odd.on){const A=e.low.arr;if(A.section==='main'||A.section==='intense'||e.chip.on||e.jazz.on||e.decks.length>1)upBad.push(e.bar);}}
    const P=ODD_PATS[pat];let kickMiss=0,stepsOK=e.step===56*16;
    let kickOff=0;for(let bar=16;bar<56;bar++){if(dropBars.has(bar))continue;const got=K.filter(x=>x[0]===bar).map(x=>x[1]).join(',');if(got!==KB[bar])kickOff++;   // only the deck's own kick pattern
      if(band!=='bchill')for(const q of [0,4,8,12])if(!K.some(x=>x[0]===bar&&x[1]===q))kickMiss++;}
    const exp=[];for(let bar=32;bar<48;bar++)for(let s=0;s<16;s++)if(P.starts.includes(((bar-32)*16+s)%P.span))exp.push(bar+':'+s);
    const got=Pl.map(x=>x[0]+':'+x[1]),same=exp.length===got.length&&exp.every((x,i)=>x===got[i]);
    out.push({band,pat,lab:P.lab,kickMiss,kickOff,plucks:got.length,expected:exp.length,exactSteps:same,offChord:bad,upBad:upBad.length,segs:e.oddSegs.map(x=>x.slice(0,2).join('-')).join(','),steps16:stepsOK});}
  return out;});
let failA=0;for(const r of A){const ok=r.kickMiss===0&&r.kickOff===0&&r.exactSteps&&r.offChord===0&&r.upBad===0&&r.steps16&&r.segs==='32-48';if(!ok)failA++;console.log(ok?'ok  ':'FAIL',JSON.stringify(r));}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0,r3=x=>+x.toFixed(3);
const res={};let failB=0;
for(const band of ['b120','b140','bchill']){const T={bars:0,odd:0,ph:{},segs:[],lens:[],viol:[],maxUp:0,kickMiss:0,oddUpper:[]};
  for(let i=0;i<NS;i++){await p.goto('file://'+html);
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),7100+i*61,{opening:true});e.cond.auto=true;
      const B={};const bar=()=>B[e.bar]||(B[e.bar]={lead:0,chip:0,jazz:0,l2:0,pluck:0,kick:new Set()});let U=0;
      const ou=e.upperStep.bind(e);e.upperStep=(...a)=>{U++;try{return ou(...a);}finally{U--;}};
      for(const k of ['synth','acid','fmHit','vox','marimba','flute','pulse','bleep','stab','hardStab','organ'])if(e[k])e[k]=()=>{if(U)bar().lead++;};
      for(const k of ['chipNote','chipArp'])if(e[k])e[k]=()=>{bar().chip++;};if(e.chipNoise)e.chipNoise=()=>{};e.jzEP=()=>{bar().jazz++;};
      e.upperLayer2=()=>{bar().l2++;};e.oddPluck=()=>{bar().pluck++;};e.kick=()=>{bar().kick.add(e.step%16);};
      for(const k of ['hat','metalHat','ride','clap','clapK','snare','tom','pz','bass','drone','noiseWash','revCym','riserFx','chillPad'])if(e[k])e[k]=()=>{};
      const info={};let t=0.01,closeAt=BARS-48,openEnd=null;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;}
        e.scheduleStep(t);t+=e.s16;
        if(st%16===0){const cd=e.cond,cur=cd.set&&cd.set.list[cd.set.idx],A=e.low.arr;
          info[e.bar]={odd:e.odd.on,ph:cd.closing?'closing':(cd.opening?'opening':(cd.chill?'chill':(cur?cur.phase:''))),sec:A.section,strip:!!(e.orn&&e.orn.strip),chip:!!e.chip.on,jazz:!!e.jazz.on,decks:e.decks.length,drop:!!e.drop.active,mix:!!(cd.mix&&cd.mix.state!=='planned')};}
        if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;}
      const bars=[];for(let k=openEnd;k<BARS;k++){const x=B[k]||{lead:0,chip:0,jazz:0,l2:0,pluck:0,kick:new Set()};bars.push({bar:k,...info[k],lead:x.lead,chipN:x.chip,jazzN:x.jazz,l2:x.l2,pluck:x.pluck,kick:[...x.kick].sort((a,b)=>a-b).join(',')});}
      return {bars,segs:e.oddSegs};},[band,i,BARS]);
    // layer-2 voices last up to 8 bars after a trigger
    let l2Until=-1;for(const x of r.bars){if(x.l2)l2Until=x.bar+8;x.l2on=x.bar<l2Until;}
    for(const x of r.bars){if(x.ph==='closing')continue;T.bars++;(T.ph[x.ph]||(T.ph[x.ph]=[0,0]))[0]++;
      if(x.odd){T.odd++;T.ph[x.ph][1]++;
        const up=1+(x.lead>0?1:0)+(x.chip||x.chipN?1:0)+(x.jazz||x.jazzN?1:0)+(x.l2on?1:0);T.oddUpper.push(up);T.maxUp=Math.max(T.maxUp,up);
        if(x.chip||x.jazz||x.strip||x.l2||x.l2on||x.sec==='main'||x.sec==='intense'||x.decks>1||x.mix)T.viol.push([i,x.bar,x.chip,x.jazz,x.strip,x.l2,x.l2on,x.sec,x.decks,x.mix]);
        if(band!=='bchill'&&!x.drop&&!['0','4','8','12'].every(q=>x.kick.split(',').includes(q)))T.kickMiss++;}}
    for(const s of r.segs){T.segs.push(s);T.lens.push(s[1]-s[0]);}}
  const ph={};for(const k in T.ph)ph[k]=r3(T.ph[k][1]/Math.max(1,T.ph[k][0]));
  const starts16=T.segs.every(s=>s[0]%16===0);
  res[band]={oddShare:r3(T.odd/Math.max(1,T.bars)),byPhase:ph,segments:T.segs.length,perSet:r3(T.segs.length/NS),meanLen:r3(mean(T.lens)),starts16,
    patterns:T.segs.reduce((o,s)=>(o[s[3]]=(o[s[3]]||0)+1,o),{}),startPhase:T.segs.reduce((o,s)=>(o[s[4]]=(o[s[4]]||0)+1,o),{}),
    upperPartsDuringOdd:{mean:r3(mean(T.oddUpper)),max:T.maxUp},violations:T.viol.length,kickMissOddBars:T.kickMiss};
  const ok=T.viol.length===0&&T.kickMiss===0&&starts16&&T.maxUp<=2&&res[band].oddShare>0.02&&res[band].oddShare<0.2;if(!ok)failB++;
  console.log(ok?'ok  ':'FAIL','==',band,JSON.stringify(res[band]));if(T.viol.length)console.log('  viol',JSON.stringify(T.viol.slice(0,8)));}
console.log('RESULT',JSON.stringify({forcedFail:failA,longFail:failB,res}));console.log('errors',errs);await b.close();
process.exit(failA||failB||errs.length?1:0);
