// v27: showpieces -- Spastik-style drum section and Bells-style riff (rare autopilot spice, never with the v25 odd-meter accents).
//  A) forced segments (b120 / b140 x spastik / bells, real voices): kick on every quarter of every bar, no other upper voice in any segment bar
//     (v26 audit), no snare fills, bass silent during the Spastik body (back by the last bar), Spastik density builds (first vs last bars),
//     Bells riff 8-12 notes over 1-2 bars, every bell note inside the key's natural minor and consonant with the chord
//  B) long おまかせ sims (scheduler only): share of bars / segments per band and phase, start on 16-bar lines, 8-16 bars, cooldown,
//     no overlap with (and >= 16 bars from) odd-meter segments, mix seams (>= 16 bars after a two-deck bar, out >= 3 bars before the next),
//     never in the chill band, clutter audit = 0, bell notes in A minor (key-relative)
//  C) offline audio renders of each section (140): peak / clipping, and the Spastik loudness without the bass vs. the bars before
// usage: node v27_showpieces.mjs [seeds=8] [bars=448]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';
const here=path.dirname(fileURLToPath(import.meta.url)),html=process.env.HTML?path.resolve(process.env.HTML):path.resolve(here,'../index.html');
const NS=+(process.argv[2]||8),BARS=+(process.argv[3]||448);
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.addInitScript(()=>{
  // per-bar audit of the upper voices (same rules as test/v25_oddmeter.mjs); the duck is the showpiece's while one plays
  window.__audit=function(e,real){const R={bars:{},sp:[]},bd=()=>16*e.s16;let U=0,L2=0;
    const B=k=>R.bars[k]||(R.bars[k]={lead:0,l2:0,chip:0,jazz:0,fx:0,fill:0,perc:0,pad:0,bass:0,duck:1,padDuck:false,odd:false,show:''});
    const wrap=(k,fn,call)=>{if(!e[k])return;const o=e[k].bind(e);e[k]=(...a)=>{const x=fn(...a);return call?o(...a):x;};};
    {const ou=Engine.prototype.upperStep.bind(e);e.upperStep=(...a)=>{U++;try{return ou(...a);}finally{U--;}};}
    for(const k of ['synth','acid','fmHit','vox','marimba','flute','pulse','bleep','stab','hardStab','organ'])wrap(k,()=>{if(U)B(e.bar).lead++;},real);
    wrap('drone',(t,dur)=>{if(U){B(e.bar).lead++;R.sp.push(['lead',e.bar,e.bar+Math.ceil(dur/bd()-0.01)]);}},real);
    {const o=e.upperLayer2.bind(e);e.upperLayer2=(d,kind,t)=>{B(e.bar).l2++;R.sp.push(['l2',e.bar,e.bar+(kind==='fx'?16:8)]);if(real){L2++;try{return o(d,kind,t);}finally{L2--;}}};}
    for(const k of ['riserFx','revCym','noiseWash'])wrap(k,()=>{if(!L2){B(e.bar).fx++;}},real);
    for(const k of ['chipNote','chipArp'])wrap(k,()=>{B(e.bar).chip++;},real);
    wrap('jzEP',()=>{B(e.bar).jazz++;},real);
    wrap('oddPluck',()=>{B(e.bar).pluck=(B(e.bar).pluck||0)+1;},real);
    wrap('bass',()=>{B(e.bar).bass++;},real);
    {const o=e.onStep;e.onStep=(st,t,ev,bar)=>{if(ev.fill)B(e.bar).fill++;if(o)o(st,t,ev,bar);};}
    wrap('chillPad',(t,a,span)=>{B(e.bar).pad++;R.sp.push(['pad',e.bar,e.bar+Math.max(1,span||8)]);},real);
    {const o=e.kitPerc.bind(e);e.kitPerc=(d,K,t,tsw,s,ev,...a)=>{const p0=ev.perc;const x=o(d,K,t,tsw,s,ev,...a);if(ev.perc&&ev.perc!==p0)B(e.bar).perc++;return x;};}
    {const o=e.scheduleStep.bind(e);e.scheduleStep=t=>{const s=e.step%16;o(t);if(s===0){const b=B(e.bar),SH=e.show;b.odd=!!e.odd.on;b.show=SH.on?SH.kind:'';b.fading=!!SH.fading;
      b.duck=SH.on?SH.duck:(e.odd.duck??1);b.padDuck=SH.on?!!SH.padDuck:!!e.odd.padDuck;b.bassOut=!!(SH.on&&SH.bassDuck&&!SH.fading);}};}
    R.score=(k)=>{const b=R.bars[k]||B(k),cov=w=>R.sp.some(x=>x[0]===w&&x[1]<=k&&k<x[2]),open=b.duck>0.05;
      const act={lead:open&&(b.lead>0||cov('lead')),l2:open&&cov('l2'),chip:b.chip>0,jazz:b.jazz>0,fx:b.fx>0,pad:cov('pad')&&!b.padDuck,pluck:(b.pluck||0)>0};
      return {...act,n:Object.values(act).filter(Boolean).length,fill:b.fill,perc:b.perc,bass:b.bass};};
    return R;};
  // bell notes: key-relative pitch class + consonance with the current chord
  window.__bellAudit=function(e){const R={n:0,offMinor:0,harsh:0,pcs:{}};const o=e.bellFM.bind(e);
    e.bellFM=(t,m,vel,op)=>{const d=e.show.deck||e.low,root=57+offOf(d.key!=null?d.key:S.key),pc=(((m-root)%12)+12)%12;R.n++;R.pcs[pc]=(R.pcs[pc]||0)+1;
      if(![0,2,3,5,7,8,10].includes(pc))R.offMinor++;if(e.harsh(m,root,e.chordPcs(d)))R.harsh++;return o(t,m,vel,op);};return R;};});
await p.goto('file://'+html+'?noopening');
const fails=[];
// ---- A) forced segments
const A=await p.evaluate(()=>{const out=[];
  for(const band of ['b120','b140'])for(const kind of ['spastik','bells'])for(const seed of [4242,515]){S.band=band;S.style=BANDS[band].first;
    const e=new Engine(new OfflineAudioContext(2,4410,44100),seed,{opening:false});e.cond.auto=false;e.debug=true;
    const AU=__audit(e,true),BA=__bellAudit(e),K=[];const ok0=e.kick.bind(e);e.kick=(t,v,...a)=>{K.push([e.bar,e.step%16]);return ok0(t,v,...a);};
    e.showForceBar=32;e.showForceLen=16;e.showForceKind=kind;let t=0.01;const drop=new Set();
    for(let st=0;st<56*16;st++){e.scheduleStep(t);t+=e.s16;if(e.drop.active)drop.add(e.bar);}
    let kickMiss=0;for(let bar=17;bar<56;bar++){if(drop.has(bar))continue;for(const q of [0,4,8,12])if(!K.some(x=>x[0]===bar&&x[1]===q))kickMiss++;}
    const sc=[];for(let k=32;k<48;k++)sc.push(AU.score(k));
    const hits=k=>e.showLog.filter(x=>x[0]===k).length,early=[32,33,34].map(hits).reduce((a,b)=>a+b,0)/3,late=[44,45,46].map(hits).reduce((a,b)=>a+b,0)/3;
    const bassBody=[];for(let k=33;k<46;k++)bassBody.push(AU.score(k).bass);const bassBack=[48,49].map(k=>AU.score(k).bass);
    const R=e.show.riff;
    out.push({band,kind,seed,segs:e.showSegs.map(x=>x[0]+'-'+x[1]+':'+x[3]).join(','),othersMax:Math.max(...sc.map(x=>x.n)),fills:sc.reduce((a,x)=>a+x.fill,0),percBars:sc.filter(x=>x.perc>0).length,kickMiss,
      hitsEarly:+early.toFixed(1),hitsLate:+late.toFixed(1),maxHitsBar:Math.max(...[...Array(16).keys()].map(i=>hits(32+i))),bassBody:bassBody.reduce((a,b)=>a+b,0),bassBack:bassBack.reduce((a,b)=>a+b,0),
      riff:R?{steps:R.L,notes:R.P.length}:null,bell:BA,leadBefore:AU.score(30).lead,leadAfter:[49,50,51,52].map(k=>AU.bars[k]&&AU.bars[k].lead||0).reduce((a,b)=>a+b,0)});}
  return out;});
for(const r of A){const ok=r.segs==='32-48:'+r.kind&&r.othersMax===0&&r.fills===0&&r.kickMiss===0&&
    (r.kind==='spastik'?(r.bassBody===0&&r.bassBack>0&&r.hitsLate>r.hitsEarly*1.5&&r.maxHitsBar<=14&&r.percBars===0):(r.riff&&r.riff.notes>=8&&r.riff.notes<=12&&r.bell.n>0&&r.bell.offMinor===0&&r.bell.harsh===0&&r.bassBody>0));
  if(!ok)fails.push('A '+r.band+' '+r.kind);console.log(ok?'ok  ':'FAIL','A',JSON.stringify(r));}
// ---- B) long autopilot sims
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0,r3=x=>+x.toFixed(3);
const RES={};
for(const band of ['b120','b140','bchill']){const T={bars:0,show:{spastik:0,bells:0},ph:{},segs:[],viol:[],seam:[],oddClash:0,oddGap:99,clutter:[],fills:0,kickMiss:0,bassBody:0,bell:{n:0,offMinor:0,harsh:0},cancels:0,odd:0,gapSame:99};
  for(let i=0;i<NS;i++){await p.goto('file://'+html+'?noopening');
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),7100+i*61,{opening:true});e.cond.auto=true;
      const AU=__audit(e,false),BA=__bellAudit(e);const KB={};
      if(e.chipNoise)e.chipNoise=()=>{};e.oddPluck=()=>{};e.bellFM=(()=>{const o=e.bellFM;return (...a)=>{o(...a.slice(0,0).concat(a));};})();
      e.kick=()=>{(KB[e.bar]||(KB[e.bar]=new Set())).add(e.step%16);};
      for(const k of ['hat','metalHat','ride','clap','clapK','snare','tom','pz','spSnare','spTom'])if(e[k])e[k]=()=>{};
      const info={};let t=0.01,closeAt=BARS-48,openEnd=null;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;}
        e.scheduleStep(t);t+=e.s16;
        if(st%16===0){const cd=e.cond,cur=cd.set&&cd.set.list[cd.set.idx];
          info[e.bar]={show:e.show.on?e.show.kind:'',odd:!!e.odd.on,ph:cd.closing?'closing':(cd.opening?'opening':(cd.chill?'chill':(cur?cur.phase:''))),strip:!!(e.orn&&e.orn.strip),chip:!!e.chip.on,jazz:!!e.jazz.on,decks:e.decks.length,drop:!!e.drop.active,mix:!!(cd.mix&&cd.mix.state!=='planned')};}
        if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;}
      const bars=[];for(let k=openEnd;k<BARS;k++){const ab=AU.bars[k]||{};bars.push({bar:k,...info[k],sc:AU.score(k),bassOut:!!ab.bassOut,kick:[...(KB[k]||[])].join(',')});}
      return {bars,segs:e.showSegs,odd:e.oddSegs,cancels:e.show.cancels,bell:BA};},[band,i,BARS]);
    T.cancels+=r.cancels;T.bell.n+=r.bell.n;T.bell.offMinor+=r.bell.offMinor;T.bell.harsh+=r.bell.harsh;
    for(const x of r.bars){if(x.ph==='closing')continue;T.bars++;const P=(T.ph[x.ph]||(T.ph[x.ph]={bars:0,spastik:0,bells:0}));P.bars++;if(x.odd)T.odd++;
      if(x.show){T.show[x.show]++;P[x.show]++;if(x.odd)T.oddClash++;T.clutter.push(x.sc.n);T.fills+=x.sc.fill>0?1:0;if(x.bassOut&&x.sc.bass)T.bassBody++;
        if(x.chip||x.jazz||x.strip||x.decks>1||x.mix)T.viol.push([i,x.bar,x.chip,x.jazz,x.strip,x.decks,x.mix]);
        if(!x.drop&&!['0','4','8','12'].every(q=>x.kick.split(',').includes(q)))T.kickMiss++;}}
    const two=r.bars.filter(x=>x.decks>1||x.mix).map(x=>x.bar);
    for(const s of r.segs){T.segs.push(s);const bef=two.filter(m=>m<s[0]).map(m=>s[0]-m),aft=two.filter(m=>m>=s[1]).map(m=>m-s[1]);
      const a=bef.length?Math.min(...bef):99,z=aft.length?Math.min(...aft)+1:99;
      if(a<16||z<3||two.some(m=>m>=s[0]&&m<s[1]))T.seam.push([i,s[0],s[1],a,z]);
      for(const o of r.odd){const g=o[0]>=s[1]?o[0]-s[1]:(s[0]>=o[1]?s[0]-o[1]:-1);T.oddGap=Math.min(T.oddGap,g);}}
    for(let k=1;k<r.segs.length;k++)T.gapSame=Math.min(T.gapSame,r.segs[k][0]-r.segs[k-1][1]);}
  const ph={};for(const k in T.ph)ph[k]={spastik:r3(T.ph[k].spastik/T.ph[k].bars),bells:r3(T.ph[k].bells/T.ph[k].bars),bars:T.ph[k].bars};
  const lens=T.segs.map(s=>s[1]-s[0]),lensN=T.segs.filter(s=>s[6]!=="close").map(s=>s[1]-s[0]);
  const res=RES[band]={share:{spastik:r3(T.show.spastik/T.bars),bells:r3(T.show.bells/T.bars),odd:r3(T.odd/T.bars)},segments:{spastik:T.segs.filter(s=>s[3]==='spastik').length,bells:T.segs.filter(s=>s[3]==='bells').length},
    perSet:r3(T.segs.length/NS),meanLen:r3(mean(lens)),minLen:lensN.length?Math.min(...lensN):0,   // 0 = no segment that ran its course (closing cuts are exempt)
    maxLen:lens.length?Math.max(...lens):0,starts16:T.segs.every(s=>s[0]%16===0),
    startPhase:T.segs.reduce((o,s)=>(o[s[3]+':'+s[4]]=(o[s[3]+':'+s[4]]||0)+1,o),{}),byPhase:ph,minGapBetweenShows:T.gapSame,minGapToOdd:T.oddGap,oddOverlapBars:T.oddClash,
    clutterMax:Math.max(0,...T.clutter),fillBars:T.fills,bassInSpastikBody:T.bassBody,kickMiss:T.kickMiss,violations:T.viol.length,seamBad:T.seam.length,cancelledPre:T.cancels,bell:T.bell};
  const tot=res.share.spastik+res.share.bells;
  const ok=band==='bchill'?T.segs.length===0:(res.starts16&&(res.minLen>=6||!lensN.length)&&res.maxLen<=16&&T.oddClash===0&&T.oddGap>=16&&res.clutterMax===0&&res.fillBars===0&&res.bassInSpastikBody===0&&res.kickMiss===0&&res.violations===0&&res.seamBad===0&&
    T.bell.offMinor===0&&T.bell.harsh===0&&(T.segs.length===0||T.gapSame>=48)&&tot<0.12&&(band!=='b140'||(res.segments.spastik>0&&res.segments.bells>0&&tot>0.01)));
  if(!ok)fails.push('B '+band);console.log(ok?'ok  ':'FAIL','B',band,JSON.stringify(res));if(T.seam.length)console.log('  seam',JSON.stringify(T.seam.slice(0,6)));if(T.viol.length)console.log('  viol',JSON.stringify(T.viol.slice(0,6)));}
// ---- C) offline audio
const C={};
for(const kind of ['spastik','bells']){await p.goto('file://'+html+'?noopening');
  C[kind]=await p.evaluate(async kind=>{await __renderOffline({band:'b140',bars:70,seed:3131,auto:false,keep:true,setup:e=>{window.__e=e;e.showForceBar=48;e.showForceLen=16;e.showForceKind=kind;}});
    const {buf}=window.__lastBuf,TL=__e.barTL,sr=buf.sampleRate,L=buf.getChannelData(0),R=buf.getChannelData(1);
    const win=(b0,b1)=>{const i0=Math.floor(TL[b0]*sr),i1=Math.floor(TL[b1]*sr);let ss=0,pk=0,cl=0;for(let i=i0;i<i1;i++)for(const x of [L[i],R[i]]){ss+=x*x;const a=Math.abs(x);if(a>pk)pk=a;if(a>=0.999)cl++;}return {rms:Math.sqrt(ss/(2*(i1-i0))),pk,cl};};
    const db=x=>20*Math.log10(x);const pre=win(36,46),body=win(52,62),post=win(64,69);
    return {preDb:+db(pre.rms).toFixed(2),bodyDb:+db(body.rms).toFixed(2),postDb:+db(post.rms).toFixed(2),diffDb:+(db(body.rms)-db(pre.rms)).toFixed(2),peak:+Math.max(pre.pk,body.pk,post.pk).toFixed(3),clipped:pre.cl+body.cl+post.cl,segs:__e.showSegs.map(x=>x.slice(0,4))};},kind);
  const r=C[kind],ok=r.clipped===0&&r.peak<1&&r.diffDb>-4.5&&r.diffDb<2.5&&r.segs.length===1;if(!ok)fails.push('C '+kind);console.log(ok?'ok  ':'FAIL','C',kind,JSON.stringify(r));}
console.log('RESULT',JSON.stringify({fails,res:RES,audio:C}));console.log('errors',errs);await b.close();
process.exit(fails.length||errs.length?1:0);
