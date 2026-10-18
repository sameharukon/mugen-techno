// v8: tempo bands / setlists / upper variety / kick-drop variety (long おまかせ renders) + beatless band changes.
// usage: node v8_sets.mjs [tempo|band|all]
import { chromium } from 'playwright-core';
const which=process.argv[2]||'all';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file:///workspace/techno/live/index.html');
const barStarts=bpmLog=>{const T=[];let t=0.01;for(const r of bpmLog){T.push(t);t+=16*60/r[1]/4;}T.push(t);return T;};
function analyseSet(name,o){
  const B=o.bpmLog.map(r=>r[1]),bars=B.length;
  let mxBar=0,mxPh=0;for(let i=1;i<bars;i++)mxBar=Math.max(mxBar,Math.abs(B[i]-B[i-1]));
  for(let i=16;i<bars;i+=16)mxPh=Math.max(mxPh,Math.abs(B[i]-B[i-16]));
  // style sequence of the kick/bass owner
  const seq=[];for(const r of o.bpmLog)if(!seq.length||seq[seq.length-1][1]!==r[2])seq.push([r[0],r[2]]);
  // upper variety per 64 bars
  const win=[];for(let w=0;w+64<=bars;w+=64){const rows=o.arrLog.filter(r=>r[0]>=w&&r[0]<w+64);
    const v=new Set(),m=new Set(),sec=new Set(),l2=new Set();for(const [,ds] of rows)for(const [id,st,pn,se,mo,l] of ds){v.add(st+"/"+pn);m.add(mo);sec.add(se);if(l)l2.add(l);}
    win.push({bars:`${w}-${w+63}`,variants:v.size,motifs:m.size,sections:[...sec].join("/"),layer2:[...l2].join("/")||"-"});}
  // similarity of consecutive phrases: Jaccard of (step, pitch-class) note events played by the kick/bass owner's 上モノ (motif voices only)
  const low=i=>{const r=o.arrLog[i];return r&&r[1].length?r[1][r[1].length-1][0]:null;};
  const ph=[];for(let k=0;k*16<bars;k++){const S=new Set();for(const [bar,s,st,pn,midi,id] of o.upLog)if(bar>=k*16&&bar<k*16+16)S.add(`${bar%4}:${s}:${midi}`);ph.push(S);}
  const jac=[];for(let k=1;k<ph.length;k++){const A=ph[k-1],C=ph[k];if(!A.size&&!C.size)continue;let i=0;for(const x of A)if(C.has(x))i++;jac.push(i/(A.size+C.size-i||1));}
  const avg=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):null;
  // kick-drop recipes
  const kd=o.breakFull.filter(x=>x.type==="kick"&&x.key);let rep=0,fillRep=0;for(let i=1;i<kd.length;i++){if(kd[i].key===kd[i-1].key)rep++;if(kd[i].key.split("|")[3]===kd[i-1].key.split("|")[3])fillRep++;}
  const cnt=k=>{const m={};for(const x of kd){const v=x.key.split("|")[k];m[v]=(m[v]||0)+1;}return m;};
  return {name,bars,seconds:o.seconds,peakDb:o.peakDb,nan:o.nan,bpmRange:[+Math.min(...B).toFixed(2),+Math.max(...B).toFixed(2)],maxDriftPerPhrase:+mxPh.toFixed(3),maxStepPerBar:+mxBar.toFixed(3),
    kicksFromTwoDecksNear:o.kicksFromTwoDecksNear,bassTwoDecksNear:o.bassTwoDecksNear,bassOldDeckAfterSwap:o.bassOldDeckAfterSwap,
    styleSeq:seq.map(([bar,st])=>`${bar}:${st}`).join(" → "),setNow:o.set,
    upper:{per64:win,phraseJaccardMean:avg(jac),phraseJaccardMax:jac.length?+Math.max(...jac).toFixed(3):null,phrasesCompared:jac.length},
    kickDrops:{n:kd.length,distinct:new Set(kd.map(x=>x.key)).size,consecutiveSameRecipe:rep,consecutiveSameFill:fillRep,
      remove:cnt(2),fill:cnt(3),riser:cnt(4),impact:cnt(5),names:kd.slice(0,8).map(x=>`${x.bar}:${x.name}`)},
    otherBreaks:o.breakFull.filter(x=>x.type!=="kick").map(x=>`${x.type}@${x.bar}`).join(" ")};
}
function analyseBand(name,o){
  const T=barStarts(o.bpmLog),B=o.bpmLog.map(r=>r[1]),K=o.kickTimes;
  const kicksIn=i=>K.filter(t=>t>=T[i]-1e-6&&t<T[i+1]-1e-6).length;
  const changing=[];for(let i=1;i<B.length;i++)if(Math.abs(B[i]-B[i-1])>0.05)changing.push(i);
  // group consecutive changing bars into windows
  const wins=[];for(const i of changing){const w=wins[wins.length-1];if(w&&i-w.b1<=1)w.b1=i;else wins.push({b0:i,b1:i});}
  return {name,seconds:o.seconds,peakDb:o.peakDb,nan:o.nan,kicksFromTwoDecksNear:o.kicksFromTwoDecksNear,bassTwoDecksNear:o.bassTwoDecksNear,
    tempoChangeWindows:wins.map(w=>({bars:`${w.b0}-${w.b1}`,from:+B[w.b0-1].toFixed(2),to:+B[w.b1].toFixed(2),kicks:[...Array(w.b1-w.b0+1).keys()].reduce((a,k)=>a+kicksIn(w.b0+k),0),
      kicksBarBefore:kicksIn(w.b0-1),kicksBarAfter:kicksIn(w.b1+1)})),
    kicksDuringBigChange:wins.filter(w=>Math.abs(B[w.b1]-B[w.b0-1])>1).reduce((a,w)=>a+[...Array(w.b1-w.b0+1).keys()].reduce((x,k)=>x+kicksIn(w.b0+k),0),0),
    breaks:o.breakFull.map(x=>`${x.type}@${x.bar}x${x.len}`).join(" "),bandEnd:o.band,
    bpmPath:o.bpmPath,log:o.log.filter(l=>/帯|ブリッジ|セットリスト|テープ|エコー/.test(l))};
}
const runs=[];
if(which==='tempo'||which==='all')runs.push(
  ['120帯 おまかせ 304小節',{bars:304,seed:2024,auto:true,full:true,band:'b120'},analyseSet],
  ['140帯 おまかせ 304小節',{bars:304,seed:77,auto:true,full:true,band:'b140'},analyseSet],
  ['120帯 おまかせ + もっとハードに（帯内に留まるか）',{bars:96,seed:5,auto:true,full:true,band:'b120',intents:[{bar:2,text:'もっとハードに'},{bar:40,text:'一気にハードに'},{bar:60,text:'テンポを上げて'}]},analyseSet]);
if(which==='band'||which==='all')runs.push(
  ['band up→down (intents)',{bars:128,seed:11,full:true,band:'b120',intents:[{bar:4,text:'140帯に上げて'},{bar:40,text:'もっとハードに'},{bar:74,text:'120帯に戻して'}]},analyseBand],
  ['band during おまかせ (ハイテンポで / ゆったりめのセット)',{bars:150,seed:31,auto:true,full:true,band:'b120',intents:[{bar:20,text:'ハイテンポで'},{bar:90,text:'ゆったりめのセットにして'}]},analyseBand],
  ['band down from 140 hard (start b140)',{bars:56,seed:4,full:true,band:'b140',style:'hard',intents:[{bar:6,text:'120帯で'}]},analyseBand]);
for(const [name,o,fn] of runs){const t0=Date.now();const out=await p.evaluate(x=>window.__renderOffline(x),o);
  console.log('=== '+name+` (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(fn(name,out),null,1));}
console.log('errors',errs);await b.close();
