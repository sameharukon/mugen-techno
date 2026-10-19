// v9: chill episodes. (1) long おまかせ renders in both bands: chill sections occur, are spaced, have lower energy /
// density / hats / kicks, and the tempo rules still hold. (2) on-demand chill per mode: smooth entry/exit (per-bar d2 at
// the episode boundaries vs ordinary bars), exact downbeat returns, no doubled kick/bass.
// usage: node v9_chill.mjs [long|demand|all]
import { chromium } from 'playwright-core';
const which=process.argv[2]||'all';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file:///workspace/techno/live/index.html');
const mean=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):null;
const barStarts=bl=>{const T=[];let t=0.01;for(const r of bl){T.push(t);t+=16*60/r[1]/4;}return T;};
function sections(o){const BL=o.bpmLog,secs=[];let cur=null;
  for(const r of BL){const on=r[5]!=="";if(on&&!cur){cur={b0:r[0],b1:r[0],mode:r[5]};secs.push(cur);}else if(on)cur.b1=r[0];else cur=null;}
  return secs;}
function analyse(name,o){
  const BL=o.bpmLog,B=BL.map(r=>r[1]),H=new Map(o.chillLog.map(r=>[r[0],r])),secs=sections(o);
  let mxBar=0,mxPh=0;for(let i=1;i<B.length;i++)mxBar=Math.max(mxBar,Math.abs(B[i]-B[i-1]));for(let i=16;i<B.length;i+=16)mxPh=Math.max(mxPh,Math.abs(B[i]-B[i-16]));
  // bars inside a chill core vs ordinary bars (exclude all break bars and the 8-bar glides around chills)
  const brk=new Set();for(const x of o.breakFull)for(let k=0;k<Math.max(1,x.len);k++)brk.add(x.bar+k);
  const near=bar=>secs.some(s=>bar>=s.b0-9&&bar<=s.b1+8);
  const inC=BL.filter(r=>r[5]!==""&&!brk.has(r[0])),out=BL.filter(r=>r[5]===""&&!brk.has(r[0])&&!near(r[0])&&r[0]>4);
  const stat=rows=>({bars:rows.length,energy:mean(rows.map(r=>r[6])),density:mean(rows.map(r=>r[7])),hatsPerBar:mean(rows.map(r=>(H.get(r[0])||[0,0,0])[1])),kicksPerBar:mean(rows.map(r=>(H.get(r[0])||[0,0,0])[2]))});
  const gaps=[];for(let i=1;i<secs.length;i++)gaps.push(secs[i].b0-secs[i-1].b1);
  return {name,bars:BL.length,seconds:o.seconds,peakDb:o.peakDb,nan:o.nan,chillCount:o.chillCount,
    chills:secs.map(s=>`${s.b0}-${s.b1}:${s.mode}`),firstChillBar:secs[0]?secs[0].b0:null,minGapBetweenChills:gaps.length?Math.min(...gaps):null,
    inChill:stat(inC),outside:stat(out),
    bpmRange:[+Math.min(...B).toFixed(2),+Math.max(...B).toFixed(2)],maxDriftPerPhrase:+mxPh.toFixed(3),maxStepPerBar:+mxBar.toFixed(3),
    bpmStepInsideChill:+Math.max(0,...secs.flatMap(s=>{const a=[];for(let i=Math.max(1,s.b0-8);i<=Math.min(B.length-1,s.b1+8);i++)a.push(Math.abs(B[i]-B[i-1]));return a;})).toFixed(3),
    kicksFromTwoDecksNear:o.kicksFromTwoDecksNear,bassTwoDecksNear:o.bassTwoDecksNear,bassOldDeckAfterSwap:o.bassOldDeckAfterSwap,
    styles:(()=>{const q=[];for(const r of BL)if(!q.length||q[q.length-1][1]!==r[2])q.push([r[0],r[2]]);return q.map(x=>x.join(":")).join(" → ");})(),
    chillLogLines:o.log.filter(l=>/チル/.test(l)).slice(-6)};
}
function demand(name,o){const a=analyse(name,o),secs=sections(o),T=barStarts(o.bpmLog),D=o.barD2;
  const s=secs[0]||{b0:0,b1:0},edges=s?[s.b0-9,s.b0-8,s.b0-1,s.b0,s.b1-6,s.b1-1,s.b1+1]:[];
  const ord=D.filter((x,i)=>i>2&&!edges.some(e=>Math.abs(e-i)<=1)).sort((x,y)=>x-y);
  const retOff=o.returnTimes.map(rt=>Math.min(...T.map(x=>Math.abs(x-rt)))*1e6);
  return {...a,edgesD2:edges.map(e=>`${e}:${D[e]}`),ordinaryD2:{med:ord[Math.floor(ord.length/2)],p95:ord[Math.floor(ord.length*0.95)],max:ord[ord.length-1]},
    returnsOffDownbeatUsMax:+Math.max(0,...retOff).toFixed(3),breaks:o.breakFull.map(x=>`${x.type}@${x.bar}x${x.len}${x.name?"("+x.name+")":""}`).join(" "),
    intents:o.intents.map(x=>x.text+" → "+x.labels.join(" / "))};}
const runs=[];
if(which==='long'||which==='all')runs.push(['120帯 おまかせ 480小節',{bars:480,seed:2024,auto:true,full:true,band:'b120'},analyse],['140帯 おまかせ 480小節',{bars:480,seed:77,auto:true,full:true,band:'b140'},analyse]);
if(which==='demand'||which==='all')runs.push(
  ['「チルに」120帯',{bars:72,seed:3,auto:true,full:true,band:'b120',intents:[{bar:6,text:'チルに'}]},demand],
  ['「ハーフタイムでチル」140帯ハード',{bars:72,seed:4,auto:true,full:true,band:'b140',style:'hard',intents:[{bar:6,text:'ハーフタイムでチル'}]},demand],
  ['「ビートレスで一息」120帯トライバル',{bars:56,seed:5,auto:true,full:true,band:'b120',style:'tribal',intents:[{bar:6,text:'ビートレスで一息'}]},demand],
  ['「ちょっと休憩」→「ずっとこのまま」（進行中は完了）＋「まったり」',{bars:72,seed:6,auto:true,full:true,band:'b140',style:'groove',intents:[{bar:3,text:'ちょっと休憩'},{bar:14,text:'ずっとこのまま'},{bar:40,text:'まったりしたい'}]},demand]);
for(const [name,o,fn] of runs){const t0=Date.now();const out=await p.evaluate(x=>window.__renderOffline(x),o);
  console.log('=== '+name+` (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(fn(name,out),null,1));}
console.log('errors',errs);await b.close();
