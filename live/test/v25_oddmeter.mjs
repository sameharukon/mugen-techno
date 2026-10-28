// v25: odd-meter (変拍子) accents over a rigid 4/4.
//  A) forced segments (every grouping, every band): kick on every quarter of every bar, pluck exactly on the group starts
//     ((bar-start)*16+s) mod span (chill band: the deck's own kick pattern, untouched), pluck notes on chord tones of the current chord, bar length unchanged (16 steps / bar)
//  B) long おまかせ sims (scheduler only, voices replaced by recorders): share of bars with the accents (overall / by phase),
//     segment lengths + start lines, distance to the DJ mixes (曲のつなぎ目), and coexistence with other upper parts (chip / jazzy / strip / layer-2 / dense lead / 2 decks)
//  C) v26 clutter audit (A and B): during every odd bar, the upper voices other than the pluck that are actually sounding
//     (lead / arp / stab / organ / vox / classic drones, layer-2 pad / noise / fx tails, chip, jazzy, risers / reverse cymbals / washes,
//     snare fills, chill pad unless ducked) must be 0. A voice counts unless the upper duck (e.odd.duck) is fully closed.
// usage: node v25_oddmeter.mjs [seeds=6] [bars=448]      HTML=path/to/other.html  (e.g. the pre-v26 backup, for before numbers; AUDIT_ONLY=1 skips the pass/fail)
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';
const here=path.dirname(fileURLToPath(import.meta.url)),html=process.env.HTML?path.resolve(process.env.HTML):path.resolve(here,'../index.html');
const NS=+(process.argv[2]||6),BARS=+(process.argv[3]||448);
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.addInitScript(()=>{
  // v26 audit: records, per bar, which upper voices start or sustain; real=true keeps the voices running (forced runs)
  window.__audit=function(e,real){const R={bars:{},sp:[]},bd=()=>16*e.s16;let U=0,L2=0;
    const B=k=>R.bars[k]||(R.bars[k]={lead:0,l2:0,chip:0,jazz:0,fx:0,fill:0,perc:0,pad:0,pluck:0,duck:1,padDuck:false,odd:false});
    const wrap=(k,fn,call)=>{if(!e[k])return;const o=e[k].bind(e);e[k]=(...a)=>{const x=fn(...a);return call?o(...a):x;};};
    {const ou=Engine.prototype.upperStep.bind(e);e.upperStep=(...a)=>{U++;try{return ou(...a);}finally{U--;}};}
    for(const k of ['synth','acid','fmHit','vox','marimba','flute','pulse','bleep','stab','hardStab','organ'])wrap(k,()=>{if(U)B(e.bar).lead++;},real);
    wrap('drone',(t,dur)=>{if(U){B(e.bar).lead++;R.sp.push(['lead',e.bar,e.bar+Math.ceil(dur/bd()-0.01)]);}},real);
    {const o=e.upperLayer2.bind(e);e.upperLayer2=(d,kind,t)=>{B(e.bar).l2++;R.sp.push(['l2',e.bar,e.bar+(kind==='fx'?16:8)]);if(real){L2++;try{return o(d,kind,t);}finally{L2--;}}};}
    for(const k of ['riserFx','revCym','noiseWash'])wrap(k,(t0,tr)=>{if(!L2){B(e.bar).fx++;}},real);
    for(const k of ['chipNote','chipArp'])wrap(k,()=>{B(e.bar).chip++;},real);
    wrap('jzEP',()=>{B(e.bar).jazz++;},real);
    {const o=e.onStep;e.onStep=(st,t,ev,bar)=>{if(ev.fill)B(e.bar).fill++;if(o)o(st,t,ev,bar);};}   // phrase-end / break fills (not the chill backbeat)
    wrap('chillPad',(t,a,span)=>{B(e.bar).pad++;R.sp.push(['pad',e.bar,e.bar+Math.max(1,span||8)]);},real);
    {const o=e.kitPerc.bind(e);e.kitPerc=(d,K,t,tsw,s,ev,...a)=>{const p0=ev.perc;const x=o(d,K,t,tsw,s,ev,...a);if(ev.perc&&ev.perc!==p0)B(e.bar).perc++;return x;};}
    {const o=e.scheduleStep.bind(e);e.scheduleStep=t=>{const s=e.step%16;o(t);if(s===0){const b=B(e.bar);b.odd=!!e.odd.on;b.duck=e.odd.duck??1;b.padDuck=!!e.odd.padDuck;const K=e.low.kit;b.pl=K&&K.perc?Math.min(K.perc.filter(L=>L.on).length,e.ornB().perc,e.jazz.on?1:9):0;}};}
    R.score=(k)=>{const b=R.bars[k]||B(k),cov=w=>R.sp.some(x=>x[0]===w&&x[1]<=k&&k<x[2]),open=b.duck>0.05;
      const act={lead:open&&(b.lead>0||cov('lead')),l2:open&&cov('l2'),chip:b.chip>0,jazz:b.jazz>0,fx:b.fx>0,pad:cov('pad')&&!b.padDuck,fill:b.fill>0};
      return {...act,n:Object.entries(act).filter(([k,v])=>v&&k!=='fill').length,perc:b.perc,pl:b.pl||0};};
    return R;};});
await p.goto('file://'+html);
const A=await p.evaluate(()=>{const out=[];
  for(const band of ['b120','b140','bchill'])for(const pat of Object.keys(ODD_PATS)){S.band=band;S.style=BANDS[band].first;
    const e=new Engine(new OfflineAudioContext(2,4410,44100),4242+pat.length,{opening:false});e.cond.auto=false;e.debug=true;
    const AU=__audit(e,true);
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
    const au=[];for(let k=32;k<48;k++)au.push(AU.score(k));const ac={};for(const x of au)for(const k of ['lead','l2','chip','jazz','fx','pad'])if(x[k])ac[k]=(ac[k]||0)+1;const before=AU.score(31),after=[48,49,50,51].map(k=>AU.bars[k]&&AU.bars[k].lead||0).reduce((a,b)=>a+b,0);
    out.push({band,pat,lab:P.lab,othersMax:Math.max(...au.map(x=>x.n)),act:ac,leadBars:au.filter(x=>x.lead).length,l2Bars:au.filter(x=>x.l2).length,fillBars:au.filter(x=>x.fill).length,padOpen:au.filter(x=>x.pad).length,leadBackAfter:after,kickMiss,kickOff,plucks:got.length,expected:exp.length,exactSteps:same,offChord:bad,upBad:upBad.length,segs:e.oddSegs.map(x=>x.slice(0,2).join('-')).join(','),steps16:stepsOK});}
  return out;});
let failA=0;for(const r of A){const ok=r.kickMiss===0&&r.kickOff===0&&r.exactSteps&&r.offChord===0&&r.upBad===0&&r.steps16&&r.segs==='32-48'&&(process.env.AUDIT_ONLY||(r.othersMax===0&&r.fillBars===0));if(!ok)failA++;console.log(ok?'ok  ':'FAIL',JSON.stringify(r));}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0,r3=x=>+x.toFixed(3);
const res={};let failB=0;
for(const band of ['b120','b140','bchill']){const T={cancels:0,aud:{pl:[],bars:0,lead:0,l2:0,chip:0,jazz:0,fx:0,pad:0,fill:0,others:[],perc:[]},lensN:[],seam:[],minAfter:99,minBefore:99,bars:0,odd:0,ph:{},segs:[],lens:[],viol:[],maxUp:0,kickMiss:0,oddUpper:[]};
  for(let i=0;i<NS;i++){await p.goto('file://'+html);
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),7100+i*61,{opening:true});e.cond.auto=true;
      const AU=__audit(e,false);
      const B={};const bar=()=>B[e.bar]||(B[e.bar]={lead:0,chip:0,jazz:0,l2:0,pluck:0,kick:new Set()});let U=0;
      if(e.chipNoise)e.chipNoise=()=>{};e.oddPluck=()=>{bar().pluck++;};e.kick=()=>{bar().kick.add(e.step%16);};
      for(const k of ['hat','metalHat','ride','clap','clapK','snare','tom','pz','bass'])if(e[k])e[k]=()=>{};
      const info={};let t=0.01,closeAt=BARS-48,openEnd=null;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;}
        e.scheduleStep(t);t+=e.s16;
        if(st%16===0){const cd=e.cond,cur=cd.set&&cd.set.list[cd.set.idx],A=e.low.arr;
          info[e.bar]={odd:e.odd.on,ph:cd.closing?'closing':(cd.opening?'opening':(cd.chill?'chill':(cur?cur.phase:''))),sec:A.section,strip:!!(e.orn&&e.orn.strip),chip:!!e.chip.on,jazz:!!e.jazz.on,decks:e.decks.length,drop:!!e.drop.active,mix:!!(cd.mix&&cd.mix.state!=='planned')};}
        if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;}
      const bars=[];for(let k=openEnd;k<BARS;k++){const x=B[k]||{pluck:0,kick:new Set()},ab=AU.bars[k]||{},sc=AU.score(k);
        bars.push({bar:k,...info[k],lead:ab.lead||0,chipN:ab.chip||0,jazzN:ab.jazz||0,l2:ab.l2||0,pluck:x.pluck,kick:[...x.kick].sort((a,b)=>a-b).join(','),sc});}
      return {bars,segs:e.oddSegs,cancels:e.odd.cancels||0};},[band,i,BARS]);
    T.cancels+=r.cancels;
    // layer-2 voices last up to 8 bars after a trigger
    let l2Until=-1;for(const x of r.bars){if(x.l2)l2Until=x.bar+8;x.l2on=x.bar<l2Until;}
    for(const x of r.bars){if(x.ph==='closing')continue;T.bars++;(T.ph[x.ph]||(T.ph[x.ph]=[0,0]))[0]++;
      if(x.odd){T.odd++;T.ph[x.ph][1]++;const sc=x.sc,a=T.aud;a.bars++;for(const k of ['lead','l2','chip','jazz','fx','pad','fill'])if(sc[k])a[k]++;a.others.push(sc.n);a.perc.push(sc.perc);a.pl.push(sc.pl);
        const up=1+(x.lead>0?1:0)+(x.chip||x.chipN?1:0)+(x.jazz||x.jazzN?1:0)+(x.l2on?1:0);T.oddUpper.push(up);T.maxUp=Math.max(T.maxUp,up);
        if(x.chip||x.jazz||x.strip||x.l2||x.l2on||x.sec==='main'||x.sec==='intense'||x.decks>1||x.mix)T.viol.push([i,x.bar,x.chip,x.jazz,x.strip,x.l2,x.l2on,x.sec,x.decks,x.mix]);
        if(band!=='bchill'&&!x.drop&&!['0','4','8','12'].every(q=>x.kick.split(',').includes(q)))T.kickMiss++;}}
    for(const s of r.segs){T.segs.push(s);T.lens.push(s[1]-s[0]);if(s[6]!=="close")T.lensN.push(s[1]-s[0]);}
    // 曲のつなぎ目: two-deck / band-move bars vs. the segments (start >= 16 bars after, end >= 2 clear bars before)
    const two=r.bars.filter(x=>x.decks>1||x.mix).map(x=>x.bar);
    for(const s of r.segs){const bef=two.filter(m=>m<s[0]).map(m=>s[0]-m),aft=two.filter(m=>m>=s[1]).map(m=>m-s[1]);
      const a=bef.length?Math.min(...bef):99,z=aft.length?Math.min(...aft)+1:99;T.minAfter=Math.min(T.minAfter,a);T.minBefore=Math.min(T.minBefore,z);
      if(a<16||z<3||two.some(m=>m>=s[0]&&m<s[1]))T.seam.push([i,s[0],s[1],a,z]);}}
  const ph={};for(const k in T.ph)ph[k]=r3(T.ph[k][1]/Math.max(1,T.ph[k][0]));
  const starts16=T.segs.every(s=>s[0]%16===0);
  res[band]={oddShare:r3(T.odd/Math.max(1,T.bars)),byPhase:ph,segments:T.segs.length,perSet:r3(T.segs.length/NS),meanLen:r3(mean(T.lens)),minLen:Math.min(...T.lensN),starts16,
    patterns:T.segs.reduce((o,s)=>(o[s[3]]=(o[s[3]]||0)+1,o),{}),startPhase:T.segs.reduce((o,s)=>(o[s[4]]=(o[s[4]]||0)+1,o),{}),
    upperPartsDuringOdd:{mean:r3(mean(T.oddUpper)),max:T.maxUp},
    clutter:{oddBars:T.aud.bars,othersMean:r3(mean(T.aud.others)),othersMax:Math.max(0,...T.aud.others),barsWith:{lead:T.aud.lead,layer2:T.aud.l2,chip:T.aud.chip,jazz:T.aud.jazz,fx:T.aud.fx,padUnducked:T.aud.pad,snareFill:T.aud.fill},percHitsPerBar:r3(mean(T.aud.perc)/1),percLayers:{mean:r3(mean(T.aud.pl)),max:Math.max(0,...T.aud.pl)}},cancelledPre:T.cancels,violations:T.viol.length,mixSeam:{barsAfterLastMix:T.minAfter,barsBeforeNextMix:T.minBefore,bad:T.seam.length},kickMissOddBars:T.kickMiss};
  const ok=(process.env.AUDIT_ONLY||(Math.max(0,...T.aud.others)===0&&T.aud.fill===0))&&T.seam.length===0&&T.viol.length===0&&T.kickMiss===0&&starts16&&T.maxUp<=2&&res[band].oddShare>0.01&&res[band].minLen>=6&&res[band].oddShare<0.2;if(!ok)failB++;
  console.log(ok?'ok  ':'FAIL','==',band,JSON.stringify(res[band]));if(T.viol.length)console.log('  viol',JSON.stringify(T.viol.slice(0,8)));}
console.log('RESULT',JSON.stringify({forcedFail:failA,longFail:failB,res}));console.log('errors',errs);await b.close();
process.exit(failA||failB||errs.length?1:0);
