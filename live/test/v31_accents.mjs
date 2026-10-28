// v31: accent-time audit (scheduler-only おまかせ sims, audio voices stubbed) -- how much of the time any accent / spice element is active per band
//  ('fx' 2nd layer = one reverse cymbal into the next phrase: counted on its last bar only)
//  accents: jazz / chip / odd-meter / showpiece segments, 2nd upper layer (l2), FX one-shots (riser / reverse cymbal / noise wash), snare-style fills
//  core: kick / bass / hats / clap / perc + at most one sparse upper part (lead)
//  targets (v31): any-accent bars <= 20 %, two or more accents stacked in a bar ~0 (fill on a segment's own last bar excepted only if < 1 %), kick on every quarter
//  also: lead-type voice notes above C6 (after the v31 fold), CHECK=1 turns the targets into a pass / fail
// usage: [CHECK=1] HTML=... node v31_accents.mjs [seeds=6] [bars=448] [out.json]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';import fs from 'fs';
const here=path.dirname(fileURLToPath(import.meta.url)),html=process.env.HTML?path.resolve(process.env.HTML):path.resolve(here,'../index.html');
const NS=+(process.argv[2]||6),BARS=+(process.argv[3]||448),OUT=process.argv[4];
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
    {const o=e.upperLayer2.bind(e);e.upperLayer2=(d,kind,t)=>{B(e.bar).l2++;if(kind==='fx')R.sp.push(['l2',e.bar+15,e.bar+16]);else R.sp.push(['l2',e.bar,e.bar+8]);if(real){L2++;try{return o(d,kind,t);}finally{L2--;}}};}
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
const RES={},fails=[];
for(const band of ['bchill','b120','b140']){const T={bars:0,any:0,stack:0,el:{},core1:0,leadMulti:0,kickMiss:0,byPh:{}};
  for(let i=0;i<NS;i++){await p.goto('file://'+html+'?noopening');
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),9100+i*37,{opening:true});e.cond.auto=true;
      const AU=__audit(e,false);
      const HV={n:0,hi:0,max:0,organ:0,organBars:new Set(),leadBars:new Set()};
      for(const k of ['fmHit','bleep','vox','marimba','flute','pulse','synth','chipNote','bellFM','oddPluck','jzVibe','jzTpt'])if(e[k]){const o=e[k].bind(e);
        e[k]=(t,m,...a)=>{if(typeof m==='number'){const mm=typeof hiFold==='function'?hiFold(m):m;HV.n++;if(mm>84)HV.hi++;HV.max=Math.max(HV.max,mm);}return o(t,m,...a);};}
      {const o=e.upperStep.bind(e);e.upperStep=(st,t,s,d)=>{const h=o(st,t,s,d);if(h)HV.leadBars.add(e.bar);return h;};}const KB={};
      if(e.chipNoise)e.chipNoise=()=>{};e.oddPluck=()=>{};if(e.bellFM)e.bellFM=()=>{};
      e.kick=()=>{(KB[e.bar]||(KB[e.bar]=new Set())).add(e.step%16);};
      for(const k of ['hat','metalHat','ride','clap','clapK','snare','tom','pz','spSnare','spTom','jzDrumHit'])if(e[k])e[k]=()=>{};
      const info={};let t=0.01,closeAt=BARS-48;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;}
        e.scheduleStep(t);t+=e.s16;
        if(st%16===0){const cd=e.cond,cur=cd.set&&cd.set.list[cd.set.idx];
          info[e.bar]={show:e.show.on?e.show.kind:'',odd:!!e.odd.on,chip:!!e.chip.on,jazz:!!e.jazz.on,drop:!!e.drop.active,ph:cd.closing?'closing':(cd.opening?'opening':(cd.chill?'chill':(cur?cur.phase:'')))};}}
      const bars=[];for(let k=0;k<BARS;k++){const ab=AU.bars[k]||{},sc=AU.score(k);bars.push({...info[k],sc,lead:ab.lead||0,kick:[...(KB[k]||[])].join(',')});}
      return {bars,hv:{n:HV.n,hi:HV.hi,max:HV.max,organ:HV.organ,organBars:HV.organBars.size,leadBars:HV.leadBars.size}};},[band,i,BARS]);
    T.hv=T.hv||{n:0,hi:0,max:0,organ:0,organBars:0,leadBars:0};for(const k in r.hv)T.hv[k]=k==='max'?Math.max(T.hv[k],r.hv[k]):T.hv[k]+r.hv[k];
    for(const x of r.bars){if(!x.ph||x.ph==='closing')continue;T.bars++;const P=T.byPh[x.ph]||(T.byPh[x.ph]={bars:0,any:0});P.bars++;
      const A={jazz:x.jazz,chip:x.chip,odd:x.odd,show:!!x.show,l2:x.sc.l2,fx:x.sc.fx,fill:x.sc.fill>0};
      const n=Object.values(A).filter(Boolean).length;for(const k in A)if(A[k])T.el[k]=(T.el[k]||0)+1;
      if(n>0){T.any++;P.any++;}if(n>1){T.stack++;const key=Object.keys(A).filter(k=>A[k]).join('+');T.el['stack:'+key]=(T.el['stack:'+key]||0)+1;}
      if(n===0&&x.sc.lead&&!x.sc.pad)T.core1++;
      if(!x.drop&&!x.show&&!x.odd&&!['0','4','8','12'].every(q=>x.kick.split(',').includes(q)))T.kickMiss++;}}
  const pc=v=>+(100*v/T.bars).toFixed(1),el={};for(const k in T.el)el[k]=pc(T.el[k]);const ph={};for(const k in T.byPh)ph[k]=+(100*T.byPh[k].any/T.byPh[k].bars).toFixed(1);
  RES[band]={bars:T.bars,anyAccentPct:pc(T.any),stackedPct:pc(T.stack),elementsPct:el,anyByPhasePct:ph,kickMiss:T.kickMiss,
    voices:{notes:T.hv.n,aboveC6Pct:+(100*T.hv.hi/Math.max(1,T.hv.n)).toFixed(2),maxMidi:T.hv.max}};
  if(process.env.CHECK&&(RES[band].anyAccentPct>20||RES[band].stackedPct>1.5||RES[band].voices.aboveC6Pct>0))fails.push(band);
  console.log(band,JSON.stringify(RES[band]));}
if(OUT)fs.writeFileSync(OUT,JSON.stringify(RES));
console.log(fails.length?'FAIL '+JSON.stringify(fails):'PASS');
console.log('errors',errs.length,errs.slice(0,3));await b.close();process.exit(fails.length||errs.length?1:0);
