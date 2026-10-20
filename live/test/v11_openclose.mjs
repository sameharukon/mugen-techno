// v11: gradual start / stop.
//  offline : opening (kick enters on the bar-16 downbeat, no clicks in the build-in) and closing (phrase-aligned end, kick out, tails fade,
//            engine closed, silence at the end, pending mix / break / band change cancelled) in every band; hard-stop escape is click-free
//  live    : real-time UI — opening state, ストップ → クロージング中 (remaining bars) → auto stop; Space → closing → Space → immediate stop
// usage: node v11_openclose.mjs [offline|live|all]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const which=process.argv[2]||'all';
const b=await chromeLaunch(['--autoplay-policy=no-user-gesture-required','--no-sandbox']);
const p=await b.newPage({viewport:{width:1080,height:1000}});const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text());});
const barStarts=bl=>{const T=[];let t=0.01;for(const r of bl){T.push(t);t+=16*60/r[1]/4;}T.push(t);return T;};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
function analyse(name,o){
  const T=o.barTimes||barStarts(o.bpmLog),K=o.kickTimes,C=o.closing,R=o.rmsPerBar,D=o.barD2;
  const res={name,seconds:o.seconds,peakDb:o.peakDb,nan:o.nan,limiterGRdB:o.limGR,kicksFromTwoDecksNear:o.kicksFromTwoDecksNear,bassTwoDecksNear:o.bassTwoDecksNear};
  if(o.firstKickT!=null){let kb=0;for(let i=0;i<T.length;i++)if(Math.abs(T[i]-o.firstKickT)<Math.abs(T[kb]-o.firstKickT))kb=i;
    res.opening={firstKickBar:kb,firstKickOffFromDownbeatUs:+((o.firstKickT-T[kb])*1e6).toFixed(2),firstKickSec:o.firstKickT,
      rmsBars0to17:R.slice(0,18).join(' '),openingBarD2Max:Math.max(...D.slice(1,16)),playingBarD2Median:med(D.slice(20,36))};}
  if(o.d2Win)res.d2Windows=o.d2Win;
  if(C){const o0=C.E-8;res.closing={pressedAtBar:C.bar,endBar:C.E,barsToEnd:C.E-C.bar,phraseAligned:C.E%16===0,closed:C.closed,
      kicksAfterOutroStart:K.filter(t=>t>=T[o0]-1e-6).length,lastKickBar:(()=>{const lk=K[K.length-1];let i=0;while(i<T.length-1&&T[i+1]<=lk)i++;return i;})(),
      bassNotes:o.bassNotes,rmsPerBarFromPress:R.slice(C.bar,C.E+1).join(' '),tailRmsDb:o.tailRmsDb,
      maxBarD2InClosing:Math.max(...D.slice(C.bar,C.E+1)),playingBarD2Median:med(D.slice(Math.max(1,C.bar-16),C.bar)),closeDoneT:+C.closeDoneT.toFixed(2),seconds:o.seconds,labels:C.labels};}
  if(o.hardStopT!=null)res.hardStop={t:+o.hardStopT.toFixed(3),tailRmsDb:o.tailRmsDb};
  res.cancelled=o.log.filter(l=>/取消|キャンセル/.test(l));
  res.log=o.log.filter(l=>/オープニング|クロージング|ストップ/.test(l));
  res.breaks=o.breakFull.map(x=>`${x.type}@${x.bar}x${x.len}`).join(' ');
  return res;
}
if(which==='offline'||which==='all'){
  await p.goto(fileUrl(HTML));
  const runs=[
    ['120帯 オープニング→おまかせ→ストップ(40小節目)',{bars:90,seed:11,auto:true,full:true,band:'b120',opening:true,closeAt:40}],
    ['140帯 オープニング→ミックス中にストップ(「一気にハードに」34→ストップ40)',{bars:100,seed:12,auto:true,full:true,band:'b140',opening:true,intents:[{bar:34,text:'一気にハードに'}],closeAt:40}],
    ['140帯 オープニング→ブレイク予約直後にストップ',{bars:90,seed:13,auto:true,full:true,band:'b140',opening:true,intents:[{bar:38,text:'ブレイク入れて'}],closeAt:39}],
    ['チル帯 オープニング→ストップ(48)',{bars:100,seed:14,auto:true,full:true,band:'bchill',opening:true,closeAt:48}],
    ['120帯 帯変更予約(「140帯で」)直後にストップ',{bars:90,seed:15,auto:true,full:true,band:'b120',intents:[{bar:20,text:'140帯で'}],closeAt:21}],
    ['即停止エスケープ: クロージング中(30)に 64秒でハードストップ',{bars:50,seed:16,auto:true,full:true,band:'b120',closeAt:30,hardStopAt:64,d2Windows:[[63.5,64],[64,64.4],[64.4,66]]}]];
  for(const [name,o] of runs){const t0=Date.now();const out=await p.evaluate(x=>window.__renderOffline(x),o);
    console.log('=== '+name+` (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(analyse(name,out),null,1));}
}
if(which==='live'||which==='all'){
  await p.goto(fileUrl(HTML));await p.waitForTimeout(300);
  const st=async l=>{const s=await p.evaluate(()=>({playing,bar:eng?eng.bar:null,band:eng?eng.cond.band:null,opening:eng?!!eng.cond.opening:null,
    drop:eng&&eng.drop.active?eng.drop.type:null,closing:eng&&eng.cond.closing?{E:eng.cond.closing.E}:null,closed:eng?eng.closed:null,minLead:eng?+eng.minLead.toFixed(4):null,
    btn:document.getElementById('play').textContent,btnClosing:document.getElementById('play').classList.contains('closing'),
    arcOn:[...document.querySelectorAll('.arc span.on')].map(x=>x.textContent).join(','),setl:[...document.querySelectorAll('.setl i.oc')].map(x=>x.textContent).join(','),
    mixinfo:document.getElementById('mixinfo').textContent}));console.log(l,JSON.stringify(s));return s;};
  await p.click('#bandb140');await p.click('#play');await p.waitForTimeout(1500);
  await st('opening');
  const kickAt=await p.evaluate(()=>new Promise(r=>{const e=eng,f=e.kick.bind(e);let k=null;e.kick=(...a)=>{if(k==null)k=e.bar;return f(...a);};const iv=setInterval(()=>{if(k!=null||e.bar>=20){clearInterval(iv);r(k);}},200);}));
  console.log('live first kick bar:',kickAt);await st('after opening');
  await p.waitForTimeout(3000);
  const t0=Date.now();await p.click('#play');await p.waitForTimeout(400);const s1=await st('stop pressed → closing');
  let mid=null;while(Date.now()-t0<120000){const pl=await p.evaluate(()=>playing);if(!pl)break;if(!mid&&Date.now()-t0>15000)mid=await st('closing mid');await p.waitForTimeout(250);}
  const s2=await st('auto-stopped');console.log('closing wall time s',((Date.now()-t0)/1000).toFixed(1),'bars',s1.closing&&s1.bar!=null?s1.closing.E-s1.bar:null);
  console.log('log:',(await p.locator('#log li').allTextContents()).slice(0,6).join(' | '));
  await p.screenshot({path:'/tmp/v11/live_closed.png'});
  // Space: start → Space (closing) → Space (immediate)
  await p.keyboard.press('Space');await p.waitForTimeout(2500);await st('space start (opening)');
  await p.keyboard.press('Space');await p.waitForTimeout(500);await st('space during opening → closing (no kick-in)');
  const noKick=await p.evaluate(()=>new Promise(r=>{const e=eng,f=e.kick.bind(e);let k=0;e.kick=(...a)=>{k++;return f(...a);};setTimeout(()=>r(k),6000);}));console.log('kicks during opening-closing (6s):',noKick);
  await st('opening-closing after 6s');
  const t1=Date.now();await p.keyboard.press('Space');await p.waitForTimeout(50);const s3=await st('space again → immediate stop');console.log('immediate stop within ms',Date.now()-t1,'playing',s3.playing);
}
console.log('errors',errs);await b.close();
