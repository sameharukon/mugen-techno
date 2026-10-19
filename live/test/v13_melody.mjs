// v13: repetitiveness of the melodic / pitched parts (上モノ, bass, pads / chill chords) over long おまかせ runs, every band.
// Scheduler-only simulation (no audio rendering): every pitched voice is replaced by a recorder (bar, step, part, midi), so 256-bar sets are fast.
//  per run   : key / pitch-class usage, register, interval distribution, exact bar repeats (within 8 bars), distinct bar patterns per 64/128/256 bars,
//              4-bar n-gram repeats, rhythm-template recurrence (top template share), bass bar-pattern variety, pad/chord changes
//  cross-seed: Jaccard similarity of transposition-invariant motif bars / rhythm templates / bass bar patterns between different seeds
// usage: node v13_melody.mjs [label] [html file (default ../index.html)] [bars=256] [seeds=3]
import { chromium } from 'playwright-core';
const label=process.argv[2]||'',html=process.argv[3]||'/workspace/techno/live/index.html',BARS=+(process.argv[4]||256),NSEED=+(process.argv[5]||3);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file://'+html);
async function sim(band,seed){return await p.evaluate(([band,seed,BARS])=>{
  S.band=band;S.style=BANDS[band].first;if(window.__v13randomKey)window.__v13randomKey(seed);
  const oc=new OfflineAudioContext(2,44100,44100),e=new Engine(oc,seed);e.cond.auto=true;const rec=[];
  const R=(part,midi,extra)=>rec.push([e.bar,e.step%16,part,Math.round(midi),extra||0]);
  const root=()=>57+keyOff();
  // pitched voices -> recorders (the audio graph for them is skipped entirely)
  e.synth=(t,midi,vel)=>R('up',midi,vel);e.stab=()=>R('up',root());e.hardStab=(t,r)=>R('up',r-12);e.acid=(t,midi)=>R('up',midi);e.fmHit=(t,midi)=>R('up',midi);
  e.organ=(t,r)=>R('up',r);e.vox=(t,midi)=>R('up',midi);e.marimba=(t,midi)=>R('up',midi);e.flute=(t,midi)=>R('up',midi);e.pulse=(t,midi)=>R('up',midi);e.bleep=(t,midi)=>R('up',midi);
  e.drone=(t,dur,o)=>R('pad',o.midi);
  const ob=e.bass;e.bass=function(t,note,lm,lift){const r0=33+keyOff();let m=r0+MINOR_PENT[note.deg]+12*note.oct;if(lift&&m<r0)m+=12;R('bass',m);};
  if(e.bassMidi)e.bass=function(t,note,lm,lift){R('bass',e.bassMidi(note,lift));};
  const keys=[];let t=0.01;
  for(let st=0;st<BARS*16;st++){if(st%16===0)keys.push(keyOff());e.scheduleStep(t);t+=e.s16;}
  const styles=e.bpmLog.length?[...new Set(e.bpmLog.map(r=>r[2]))]:[];
  // ---- metrics ----
  const byBar=part=>{const B=Array.from({length:BARS},()=>[]);for(const [bar,s,pt,m] of rec)if(pt===part&&bar<BARS)B[bar].push([s,m]);return B;};
  const sig=(notes,ref)=>notes.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(([s,m])=>s+':'+(m-ref)).join(',');
  const rsig=notes=>[...new Set(notes.map(n=>n[0]))].sort((a,b)=>a-b).join(',');
  const analyse=part=>{const B=byBar(part),ks=keys;const S1=B.map((n,i)=>n.length?sig(n,57+ks[i]):''),RS=B.map(rsig);
    const active=S1.map((x,i)=>i).filter(i=>S1[i]!=='');const n=active.length;if(!n)return {activeBars:0};
    let rep8=0;for(const i of active){for(let j=Math.max(0,i-8);j<i;j++)if(S1[j]===S1[i]){rep8++;break;}}
    const distinct=w=>{const out=[];for(let a=0;a+w<=BARS;a+=w){const s=new Set(active.filter(i=>i>=a&&i<a+w).map(i=>S1[i]));const k=active.filter(i=>i>=a&&i<a+w).length;out.push(k?+(s.size/k).toFixed(3):null);}return out;};
    let g4=0,g4n=0;const seen=new Set();for(let i=0;i+4<=BARS;i++){const g=S1.slice(i,i+4).join('|');if(S1.slice(i,i+4).every(x=>x==='')) continue;g4n++;if(seen.has(g))g4++;seen.add(g);}
    const rc={};for(const i of active)rc[RS[i]]=(rc[RS[i]]||0)+1;const topR=Math.max(...Object.values(rc));
    const all=rec.filter(r=>r[2]===part&&r[0]<BARS);const pcs={};for(const r of all){const pc=((r[3]-(57+ks[Math.min(BARS-1,r[0])]))%12+12)%12;pcs[pc]=(pcs[pc]||0)+1;}
    const ivs={'0':0,'1-2':0,'3-4':0,'5-7':0,'8+':0};let prev=null;for(const r of all.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1])){if(prev!=null){const d=Math.abs(r[3]-prev);ivs[d===0?'0':d<=2?'1-2':d<=4?'3-4':d<=7?'5-7':'8+']++;}prev=r[3];}
    const toSet=i=>new Set(B[i].map(([s,m])=>s+':'+(m-(57+ks[i]))));const simJ=(A,Bs)=>{let k=0;for(const x of A)if(Bs.has(x))k++;return k/Math.max(1,A.size+Bs.size-k);};
    let nr=0,nrHi=0;for(const i of active){const A=toSet(i);let mx=0;for(let j=Math.max(0,i-8);j<i;j++)if(B[j].length)mx=Math.max(mx,simJ(A,toSet(j)));nr+=mx;if(mx>=0.6)nrHi++;}
    const tot=Object.values(ivs).reduce((a,b)=>a+b,0)||1;const mids=all.map(r=>r[3]);
    return {activeBars:n,activeShare:+(n/BARS).toFixed(3),nearRepeat8:+(nr/n).toFixed(3),nearRepeat8Hi:+(nrHi/n).toFixed(3),tonicShare:+((pcs[0]||0)/Math.max(1,all.length)).toFixed(3),notes:all.length,exactRepeatWithin8:+(rep8/n).toFixed(3),distinctPerWindow:{w64:distinct(64),w128:distinct(128),w256:distinct(256)},
      repeated4BarGrams:+(g4/Math.max(1,g4n)).toFixed(3),rhythmTemplates:Object.keys(rc).length,topRhythmShare:+(topR/n).toFixed(3),
      pitchClassesUsed:Object.keys(pcs).length,pcHist:pcs,intervalShare:Object.fromEntries(Object.entries(ivs).map(([k,v])=>[k,+(v/tot).toFixed(3)])),
      register:{min:Math.min(...mids),max:Math.max(...mids),span:Math.max(...mids)-Math.min(...mids)},
      sets:{bars:[...new Set(active.map(i=>S1[i]))],rhythms:Object.keys(rc),barList:active.map(i=>[...toSet(i)])}};};
  const up=analyse('up'),bass=analyse('bass'),pad=analyse('pad');
  const kset=[...new Set(keys)];let kchg=0;for(let i=1;i<keys.length;i++)if(keys[i]!==keys[i-1])kchg++;
  return {band,seed,styles,keys:kset,keyChanges:kchg,up,bass,pad};},[band,seed,BARS]);}
const jac=(a,b)=>{const A=new Set(a),B=new Set(b);let i=0;for(const x of A)if(B.has(x))i++;return +(i/Math.max(1,A.size+B.size-i)).toFixed(3);};
const summary={};
for(const band of ['b120','b140','b160','bchill']){const runs=[];const t0=Date.now();
  for(let k=0;k<NSEED;k++)runs.push(await sim(band,1000+k*77));
  const cross={};for(const part of ['up','bass','pad']){const bj=[],rj=[],nj=[];for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){if(!runs[i][part].sets||!runs[j][part].sets)continue;bj.push(jac(runs[i][part].sets.bars,runs[j][part].sets.bars));rj.push(jac(runs[i][part].sets.rhythms,runs[j][part].sets.rhythms));
      const LA=runs[i][part].sets.barList,LB=runs[j][part].sets.barList.map(x=>new Set(x));let acc=0;for(const a of LA){const A=new Set(a);let mx=0;for(const Bs of LB){let k=0;for(const x of A)if(Bs.has(x))k++;mx=Math.max(mx,k/Math.max(1,A.size+Bs.size-k));}acc+=mx;}nj.push(acc/Math.max(1,LA.length));}
    const m=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):null;cross[part]={barJaccard:m(bj),rhythmJaccard:m(rj),nearSim:m(nj)};}
  for(const r of runs)for(const part of ['up','bass','pad'])if(r[part].sets)delete r[part].sets;
  const avg=(part,f)=>{const v=runs.map(r=>r[part].activeBars?f(r[part]):null).filter(x=>x!=null);return v.length?+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(3):null;};
  const S={keysPerRun:runs.map(r=>r.keys.length),keyChanges:runs.map(r=>r.keyChanges),distinctKeysAcrossSeeds:new Set(runs.flatMap(r=>r.keys)).size};
  for(const part of ['up','bass','pad'])S[part]={activeShare:avg(part,x=>x.activeShare),exactRepeatWithin8:avg(part,x=>x.exactRepeatWithin8),nearRepeat8:avg(part,x=>x.nearRepeat8),nearRepeat8Hi:avg(part,x=>x.nearRepeat8Hi),tonicShare:avg(part,x=>x.tonicShare),repeated4BarGrams:avg(part,x=>x.repeated4BarGrams),
    distinctPer64:avg(part,x=>x.distinctPerWindow.w64.filter(v=>v!=null).reduce((a,b)=>a+b,0)/x.distinctPerWindow.w64.filter(v=>v!=null).length),
    distinctPer256:avg(part,x=>x.distinctPerWindow.w256[0]),topRhythmShare:avg(part,x=>x.topRhythmShare),rhythmTemplates:avg(part,x=>x.rhythmTemplates),
    pitchClasses:avg(part,x=>x.pitchClassesUsed),span:avg(part,x=>x.register.span),step12Share:avg(part,x=>x.intervalShare['1-2']),repeatNoteShare:avg(part,x=>x.intervalShare['0']),leap5plusShare:avg(part,x=>x.intervalShare['5-7']+x.intervalShare['8+']),
    crossSeedBarJaccard:cross[part].barJaccard,crossSeedRhythmJaccard:cross[part].rhythmJaccard,crossSeedNearSim:cross[part].nearSim};
  summary[band]=S;
  console.log(`=== ${band} ${label} (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(S));
  console.log('runs',JSON.stringify(runs.map(r=>({seed:r.seed,styles:r.styles,keys:r.keys,up:{rep8:r.up.exactRepeatWithin8,g4:r.up.repeated4BarGrams,pcs:r.up.pcHist,reg:r.up.register}}))));}
console.log('SUMMARY',JSON.stringify(summary));
console.log('errors',errs);await b.close();
