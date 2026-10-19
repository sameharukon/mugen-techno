// v11: チル帯 (110–122 BPM: dub techno / ambient techno / deep minimal / downtempo half-time / organic lo-fi).
//  set   : long おまかせ renders in the chill band (tempo range / drift, style + upper-patch variety, gentle drop variety,
//          no inserted chill sections, low energy / density vs a 120帯 reference, no doubled kick/bass, peak, limiter GR)
//  level : per-style loudness / limiter gain reduction
//  band  : band changes to / from チル帯 (120 / 140 / 160 ↔ チル帯, style-name intents) — tempo moves only inside the beatless bridge
// usage: node v11_chillband.mjs [set|level|band|all]
import { chromium } from 'playwright-core';
const which=process.argv[2]||'all';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file:///workspace/techno/live/index.html');
const barStarts=bl=>{const T=[];let t=0.01;for(const r of bl){T.push(t);t+=16*60/r[1]/4;}T.push(t);return T;};
function analyseSet(name,o){
  const BL=o.bpmLog,B=BL.map(r=>r[1]),bars=B.length;
  let mxBar=0,mxPh=0;for(let i=1;i<bars;i++)mxBar=Math.max(mxBar,Math.abs(B[i]-B[i-1]));for(let i=16;i<bars;i+=16)mxPh=Math.max(mxPh,Math.abs(B[i]-B[i-16]));
  const seq=[];for(const r of BL)if(!seq.length||seq[seq.length-1][1]!==r[2])seq.push([r[0],r[2]]);
  const kd=o.breakFull.filter(x=>x.type==="kick"&&x.key);let rep=0;for(let i=1;i<kd.length;i++)if(kd[i].key===kd[i-1].key)rep++;
  const cnt=k=>{const m={};for(const x of kd){const v=x.key.split("|")[k];m[v]=(m[v]||0)+1;}return m;};
  const secs=[];let cur=null;for(const r of BL){const on=r[5]!=="";if(on&&!cur){cur={b0:r[0],b1:r[0],mode:r[5]};secs.push(cur);}else if(on)cur.b1=r[0];else cur=null;}
  const perStyle={};for(const [,ds] of o.arrLog)for(const [id,st,pn] of ds)(perStyle[st]=perStyle[st]||new Set()).add(pn);
  return {name,bars,seconds:o.seconds,peakDb:o.peakDb,rmsDb:o.rmsDb,nan:o.nan,limiterGRdB:o.limGR,
    bpmRange:[+Math.min(...B).toFixed(2),+Math.max(...B).toFixed(2)],maxDriftPerPhrase:+mxPh.toFixed(3),maxStepPerBar:+mxBar.toFixed(3),
    kicksFromTwoDecksNear:o.kicksFromTwoDecksNear,bassTwoDecksNear:o.bassTwoDecksNear,bassOldDeckAfterSwap:o.bassOldDeckAfterSwap,minKickGap:o.minKickGap,
    styles:[...new Set(seq.map(x=>x[1]))].length,styleSeq:seq.map(([bar,st])=>`${bar}:${st}`).join(" → "),
    upperPatchesPerStyle:Object.fromEntries(Object.entries(perStyle).map(([k,v])=>[k,[...v].join("/")])),
    kickDrops:{n:kd.length,distinct:new Set(kd.map(x=>x.key)).size,consecutiveSameRecipe:rep,remove:cnt(2),fill:cnt(3),riser:cnt(4),impact:cnt(5),names:kd.slice(0,6).map(x=>`${x.bar}:${x.name}`)},
    otherBreaks:o.breakFull.filter(x=>x.type!=="kick").map(x=>`${x.type}@${x.bar}`).join(" "),
    chills:secs.map(s=>`${s.b0}-${s.b1}:${s.mode}`),chillCount:o.chillCount,
    energy:{mean:+(BL.reduce((a,r)=>a+r[6],0)/bars).toFixed(3),max:+Math.max(...BL.map(r=>r[6])).toFixed(3)},
    density:{mean:+(BL.reduce((a,r)=>a+r[7],0)/bars).toFixed(3),max:+Math.max(...BL.map(r=>r[7])).toFixed(3)},
    kicksPerBar:+(o.kicks/bars).toFixed(2),breakTypes:[...new Set(o.breakFull.map(x=>x.type))].join(","),
    harshBreaks:o.breakFull.filter(x=>["tapestop","stutter","silence","hpbuild"].includes(x.type)).length,
    rmsPer16:o.segs.map(x=>x.rmsDb).join("/"),rmsSpreadDb:+(Math.max(...o.segs.map(x=>x.rmsDb))-Math.min(...o.segs.map(x=>x.rmsDb))).toFixed(1)};
}
function analyseBand(name,o){
  const T=barStarts(o.bpmLog),B=o.bpmLog.map(r=>r[1]),K=o.kickTimes;
  const kicksIn=i=>K.filter(t=>t>=T[i]-1e-6&&t<T[i+1]-1e-6).length;
  const changing=[];for(let i=1;i<B.length;i++)if(Math.abs(B[i]-B[i-1])>0.05)changing.push(i);
  const wins=[];for(const i of changing){const w=wins[wins.length-1];if(w&&i-w.b1<=1)w.b1=i;else wins.push({b0:i,b1:i});}
  // band change = a window containing a tempo jump (> 0.1 BPM in one bar, only possible inside the bridge); in-band drift is <= 0.0625 / bar
  const big=wins.filter(w=>{for(let i=w.b0;i<=w.b1;i++)if(Math.abs(B[i]-B[i-1])>0.1)return true;return false;});
  const D=o.barD2,retOff=o.returnTimes.map(rt=>Math.min(...T.map(x=>Math.abs(x-rt)))*1e6);
  const seq=[];for(const r of o.bpmLog)if(!seq.length||seq[seq.length-1][1]!==r[2])seq.push([r[0],r[2]]);
  return {name,seconds:o.seconds,peakDb:o.peakDb,nan:o.nan,limiterGRdB:o.limGR,kicksFromTwoDecksNear:o.kicksFromTwoDecksNear,bassTwoDecksNear:o.bassTwoDecksNear,
    tempoChangeWindows:big.map(w=>({bars:`${w.b0}-${w.b1}`,from:+B[w.b0-1].toFixed(2),to:+B[w.b1].toFixed(2),kicks:[...Array(w.b1-w.b0+1).keys()].reduce((a,k)=>a+kicksIn(w.b0+k),0),
      kicksBarAfter:kicksIn(w.b1+1)})),
    kicksDuringBigChange:big.reduce((a,w)=>a+[...Array(w.b1-w.b0+1).keys()].reduce((x,k)=>x+kicksIn(w.b0+k),0),0),
    maxInBandStepPerBar:+Math.max(0,...B.slice(1).map((x,i)=>big.some(w=>i+1>=w.b0&&i+1<=w.b1)?0:Math.abs(x-B[i]))).toFixed(3),
    maxInBandDriftPerPhrase:+Math.max(0,...B.map((x,i)=>i>=16&&!big.some(w=>w.b0<=i&&w.b1>i-16)?Math.abs(x-B[i-16]):0)).toFixed(3),
    returnsOffDownbeatUsMax:+Math.max(0,...retOff).toFixed(2),
    styleSeq:seq.map(([bar,st])=>`${bar}:${st}`).join(" → "),breaks:o.breakFull.map(x=>`${x.type}@${x.bar}x${x.len}`).join(" "),bandEnd:o.band,chillCount:o.chillCount,
    intents:o.intents.map(x=>x.text+" → "+x.labels.join(" / ")),log:o.log.filter(l=>/帯|ブリッジ|テープ|エコー|チル/.test(l)).slice(-6)};
}
const runs=[];
if(which==='set'||which==='all')runs.push(['チル帯 おまかせ 480小節 (seed 116)',{bars:480,seed:116,auto:true,full:true,band:'bchill'},analyseSet],
  ['チル帯 おまかせ 480小節 (seed 5)',{bars:480,seed:5,auto:true,full:true,band:'bchill'},analyseSet],
  ['参考: 120帯 おまかせ 480小節 (seed 116)',{bars:480,seed:116,auto:true,full:true,band:'b120'},analyseSet]);
if(which==='band'||which==='all')runs.push(
  ['120→チル帯→120 (「チル帯で」/「120帯で」)',{bars:120,seed:31,full:true,auto:true,band:'b120',intents:[{bar:4,text:'チル帯で'},{bar:64,text:'120帯で'}]},analyseBand],
  ['140→チル帯 (「ダブテクノ」) → 140 (「140帯で」)',{bars:120,seed:32,full:true,auto:true,band:'b140',style:'hard',intents:[{bar:4,text:'ダブテクノにして'},{bar:64,text:'140帯で'}]},analyseBand],
  ['チル帯→160 (「160帯で」) → チル帯 (「アンビエント・テクノ」)',{bars:120,seed:33,full:true,auto:true,band:'bchill',intents:[{bar:4,text:'160帯で'},{bar:64,text:'アンビエント・テクノにして'}]},analyseBand],
  ['チル帯 内: 「ハードに」「ダウンテンポ」「もっと速く」',{bars:96,seed:34,full:true,auto:true,band:'bchill',intents:[{bar:4,text:'ハードにして'},{bar:36,text:'ダウンテンポに'},{bar:66,text:'もっと速く'}]},analyseBand]);
if(which==='level'||which==='all'){const t0=Date.now();console.log('=== loudness per style (32 bars each)');
  for(const [band,style] of [['b120','minimal'],['b140','groove'],...['minimal','groove','tribal','broken','hard'].map(s=>['bchill',s])]){
    const o=await p.evaluate(x=>window.__renderOffline(x),{bars:32,seed:7,band,style});
    console.log(JSON.stringify({band,style,peakDb:o.peakDb,rmsDb:o.rmsDb,limiterGRmeanDb:o.limGR.mean,limiterGRmaxDb:o.limGR.max,nan:o.nan,kicks:o.kicks,bassNotes:o.bassNotes}));}
  console.log(`(${((Date.now()-t0)/1000).toFixed(0)}s)`);}
for(const [name,o,fn] of runs){const t0=Date.now();const out=await p.evaluate(x=>window.__renderOffline(x),o);
  console.log('=== '+name+` (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(fn(name,out),null,1));}
console.log('errors',errs);await b.close();
