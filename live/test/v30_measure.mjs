// v30: jazzy-segment diversity measurement (scheduler-only sims). usage: HTML=... node v30_measure.mjs [seeds=10] [bars=800]
import { chromium } from 'playwright-core';
const NS=+(process.argv[2]||10),BARS=+(process.argv[3]||800),html=process.env.HTML||'/workspace/techno/live/index.html';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const segs=[];
for(const band of ['b120','b140','bchill'])for(let i=0;i<NS;i++){await p.goto('file://'+html);
  const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),5100+i*53,{opening:false});e.cond.auto=true;e.debug=true;
    for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep','drone','kick','bass','hat','clap','jzRide','chipNote','chipArp','chipNoise','jzVibe','jzTpt'])if(e[k])e[k]=()=>{};
    const segs=[];let cur=null;const t0=performance.now();
    const ep=e.jzEP.bind(e);e.jzEP=(t,ns,dur,vel)=>{if(cur){const s=e.step%16;cur.hits.push([e.bar,s,ns.map(x=>x.m)]);}};
    let t=0.01;for(let st=0;st<BARS*16;st++){const was=e.jazz.on;e.scheduleStep(t);t+=e.s16;
      if(e.jazz.on&&!was){cur={band,seed:i,start:e.bar,hits:[],ch:[],tim:e.jazz.tim||'ep',fam:e.jazz.fam||null,rh:e.jazz.rh||null,vs:e.jazz.vs||null};segs.push(cur);}
      if(cur&&e.jazz.on&&st%16===15)cur.ch.push(e.chordOf(e.low,e.bar).semi+(e.low.mode==='dorian'?'d':''));
      if(cur&&!e.jazz.on)cur=null;}
    return segs;},[band,i,BARS]);
  segs.push(...r);}
// signatures
const sig=g=>{const bars={};for(const [bar,s,ns] of g.hits){(bars[bar]=bars[bar]||[]).push(s);}
  const rh=[...new Set(Object.values(bars).map(a=>a.join('.')))];
  const vo=[...new Set(g.hits.map(([,,ns])=>ns.map(m=>m-ns[0]).join(',')))];
  let pr=[];for(const c of g.ch)if(pr[pr.length-1]!==c)pr.push(c);let P=pr;for(let L=1;L<=pr.length;L++)if(pr.every((x,i)=>x===pr[i%L])){P=pr.slice(0,L);break;}const prog=P.join('-');
  return {prog,rh,vo,tim:g.tim,fam:g.fam,rhN:g.rh,vs:g.vs};};
const S=segs.map(sig),U=a=>new Set(a).size,avg=a=>+(a.reduce((x,y)=>x+y,0)/Math.max(1,a.length)).toFixed(2);
const allRh=new Set(),allVo=new Set();S.forEach(x=>{x.rh.forEach(y=>allRh.add(y));x.vo.forEach(y=>allVo.add(y));});
const key=x=>[x.fam||x.prog,x.rhN||'free',x.tim].join('/');let rep=0,combo=0,rep3=0,sameProg=0;for(let k=1;k<S.length;k++){if(segs[k].band!==segs[k-1].band||segs[k].seed!==segs[k-1].seed)continue;combo++;const a=S[k],c=S[k-1];
  if(key(a)===key(c))rep++;if(a.prog===c.prog)sameProg++;for(let j=Math.max(0,k-3);j<k;j++)if(segs[j].band===segs[k].band&&segs[j].seed===segs[k].seed&&key(S[j])===key(a)){rep3++;break;}}
const res={segments:S.length,
  perSeg:{distinctBarRhythms:avg(S.map(x=>x.rh.length)),distinctVoicingShapes:avg(S.map(x=>x.vo.length)),chordsInProg:avg(S.map(x=>x.prog.split('-').length))},
  across:{progressions:U(S.map(x=>x.prog)),families:U(S.map(x=>x.fam)),rhythmNames:U(S.map(x=>x.rhN)),barRhythms:allRh.size,voicingShapes:allVo.size,timbres:U(S.map(x=>x.tim))},
  consecutivePairs:combo,sameComboAsPrev:rep,comboWithinLast3:rep3,sameProgAsPrev:sameProg,distinctCombos:U(S.map(key)),voicingStyles:U(S.map(x=>x.vs)),oneChordSegs:S.filter(x=>!x.prog.includes('-')).length,
  topProgs:Object.entries(S.reduce((o,x)=>(o[x.prog]=(o[x.prog]||0)+1,o),{})).sort((a,b)=>b[1]-a[1]).slice(0,8),
  fams:S.reduce((o,x)=>(o[x.fam]=(o[x.fam]||0)+1,o),{}),tims:S.reduce((o,x)=>(o[x.tim]=(o[x.tim]||0)+1,o),{}),rhNs:S.reduce((o,x)=>(o[x.rhN]=(o[x.rhN]||0)+1,o),{}),
  segsPerBand:segs.reduce((o,x)=>(o[x.band]=(o[x.band]||0)+1,o),{})};
console.log(JSON.stringify(res,null,1));console.log('errors',errs);await b.close();
