// v22: does the jazzy segment mesh with the rest? JAZZ_P forced to 1 (every eligible phrase line starts one) so many segments are judged.
// (A) scheduler-only sims: swing mismatch = 16th windows holding two non-kick onsets whose offsets differ by 0.08-0.42 of a 16th
//     (a swung and a straight event colliding; 32nd doubles / flams excluded by the range), per jazzy bar vs per other bar;
//     jazzy bars overlapping a mix (2 decks / mix running), a break or kick drop, a chill episode, within 2 bars of a mix start,
//     swap or key change; segment count / lengths.
// (B) offline renders with a forced segment (bars 8-24; spectra over bars 10-16, before any planned fade): e-piano-only and pad-only spectra (full minus muted render) in 100-200 / 200-400 /
//     400-800 / 800-1600 Hz, pad-minus-epiano margin in the 200-800 Hz low mids, peak / NaN.
// usage: node v22_jazzmesh.mjs [label] [html] [seeds=4] [bars=384]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const label=process.argv[2]||'',html=process.argv[3]||HTML,NS=+(process.argv[4]||4),BARS=+(process.argv[5]||384);
const b=await chromeLaunch(['--no-sandbox']);
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const res={sims:{},renders:{}};
for(const band of ['b120','b140','bchill']){const A={jb:0,ob:0,jcol:0,ocol:0,segs:0,lens:[],ov:{mix:0,brk:0,chill:0,preMix2:0,swap2:0,key2:0},pairs:{}};
  for(let i=0;i<NS;i++){await p.goto(fileUrl(html));
    const r=await p.evaluate(([band,i,BARS])=>{for(const k in JAZZ_P)JAZZ_P[k]=1;S.band=band;S.style=BANDS[band].first;
      const e=new Engine(new OfflineAudioContext(2,4410,44100),3100+i*53,{opening:true});e.cond.auto=true;
      const ev=[];const R=(t,src)=>ev.push([t,src]);
      for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep'])if(e[k])e[k]=(t)=>R(t,'tonal');
      for(const k of ['drone','chipNote','chipArp','chipNoise','kick','riserFx','noiseWash','revCym'])if(e[k])e[k]=()=>{};
      e.hat=(t,vel,dur,tau,pan,freq,bus)=>R(t,bus===e.jzDrum?'jz':'hat');if(e.metalHat)e.metalHat=t=>R(t,'hat');e.ride=t=>R(t,'perc');
      e.clap=t=>R(t,'clap');if(e.clapK)e.clapK=t=>R(t,'clap');e.snare=t=>R(t,'clap');e.tom=t=>R(t,'perc');if(e.pz)e.pz=t=>R(t,'perc');
      e.jzEP=t=>R(t,'ep');e.bass=t=>R(t,'bass');
      const ST=[];let t=0.01;
      for(let st=0;st<BARS*16;st++){ST.push({T:t,bar:e.bar,s:st&15,j:!!e.jazz.on,mix:e.decks.length>1||!!(e.cond.mix&&e.cond.mix.state!=='planned'),brk:!!e.drop.active,ch:e.chillAmt>0.05,low:e.low.id,key:S.key});e.scheduleStep(t);t+=e.s16;}
      return {ev,ST,s16:e.s16,segs:e.jazzSegs};},[band,i,BARS]);
    // swing windows
    const ST=r.ST,T=ST.map(x=>x.T),W={};
    for(const [t,src] of r.ev){let lo=0,hi=T.length-1,x=t+0.15*(T[1]-T[0]);if(x<T[0])continue;while(lo<hi){const m=(lo+hi+1)>>1;if(T[m]<=x)lo=m;else hi=m-1;}
      const s16=(lo+1<T.length?T[lo+1]-T[lo]:r.s16);(W[lo]||(W[lo]=[])).push([(t-T[lo])/s16,src]);}
    const colBar={};for(const k in W){const L=W[k];let hit=null;
      for(let a=0;a<L.length&&!hit;a++)for(let c=a+1;c<L.length;c++){const d=Math.abs(L[a][0]-L[c][0]);if(d>=0.08&&d<=0.42){hit=[L[a][1],L[c][1]].sort().join('-');break;}}
      if(hit){const bar=ST[k].bar;colBar[bar]=(colBar[bar]||0)+1;if(ST[k].j)A.pairs[hit]=(A.pairs[hit]||0)+1;}}
    const bars=[...new Set(ST.map(x=>x.bar))],jb=new Set(ST.filter(x=>x.j).map(x=>x.bar));
    const mixStarts=[],swaps=[],keys=[];for(let k=16;k<ST.length;k+=16){const a=ST[k-16],c=ST[k];if(c.mix&&!a.mix)mixStarts.push(c.bar);if(c.low!==a.low)swaps.push(c.bar);if(c.key!==a.key)keys.push(c.bar);}
    for(const bar of bars){const isJ=jb.has(bar),c=colBar[bar]||0;if(isJ){A.jb++;A.jcol+=c;}else{A.ob++;A.ocol+=c;}
      if(!isJ)continue;const x=ST[bar*16];
      if(x.mix)A.ov.mix++;if(x.brk)A.ov.brk++;if(x.ch)A.ov.chill++;
      if(mixStarts.some(m=>m>bar&&m-bar<=2))A.ov.preMix2++;if(swaps.some(m=>Math.abs(m-bar)<=2))A.ov.swap2++;if(keys.some(m=>Math.abs(m-bar)<=2))A.ov.key2++;}
    A.segs+=r.segs.length;for(const sg of r.segs)A.lens.push(sg[1]-sg[0]);}
  const q=a=>a.length?{min:Math.min(...a),mean:+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(1),max:Math.max(...a),under8:a.filter(x=>x<8).length}:null;
  res.sims[band]={segments:A.segs,lens:q(A.lens),jazzyBars:A.jb,swingCollPerJazzyBar:+(A.jcol/Math.max(1,A.jb)).toFixed(2),swingCollPerOtherBar:+(A.ocol/Math.max(1,A.ob)).toFixed(3),
    collPairsPerJazzyBar:Object.fromEntries(Object.entries(A.pairs).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>[k,+(v/Math.max(1,A.jb)).toFixed(2)])),
    overlapBars:A.ov,overlapShare:+((A.ov.mix+A.ov.brk+A.ov.chill)/Math.max(1,A.jb)).toFixed(3)};
  console.log('==',band,JSON.stringify(res.sims[band]));}
// (B) spectra
for(const band of ['b120','bchill']){const X={};
  for(const v of ['full','noEP','noPad']){await p.goto(fileUrl(html));
    X[v]=await p.evaluate(async ([band,v])=>{const r=await window.__renderOffline({band,bars:28,seed:777,auto:true,keep:true,setup:e=>{e.jazzForceBar=8;e.jazzForceLen=16;
        if(v==='noEP')e.jzEP=()=>{};if(v==='noPad'){const od=e.drone.bind(e);e.drone=(t,dur,o,dest)=>od(t,dur,dest===e.padBus?{...o,lvl:0}:o,dest);}   /* silent pad voices, same random stream */}});
      const {buf,bpmLog}=window.__lastBuf,sr=44100,bpm=(bpmLog[12]||[0,124])[1],spb=240/bpm,L=buf.getChannelData(0),R=buf.getChannelData(1);
      const i0=Math.floor(10*spb*sr),i1=Math.floor(16*spb*sr),x=new Float32Array(i1-i0);for(let i=0;i<x.length;i++)x[i]=(L[i0+i]+R[i0+i])/2;
      return {peak:r.peakDb,nan:r.nan,x:Array.from(x)};},[band,v]);}
  const N=8192,spec=sig=>{const P=new Float64Array(N/2);let fr=0;for(let o=0;o+N<=sig.length;o+=N/2){const re=new Float64Array(N),im=new Float64Array(N);
      for(let i=0;i<N;i++)re[i]=sig[o+i]*(0.5-0.5*Math.cos(2*Math.PI*i/N));
      for(let i=1,j=0;i<N;i++){let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
      for(let len=2;len<=N;len<<=1){const a=-2*Math.PI/len;for(let i=0;i<N;i+=len)for(let k=0;k<len/2;k++){const c=Math.cos(a*k),s=Math.sin(a*k),xr=re[i+k+len/2]*c-im[i+k+len/2]*s,xi=re[i+k+len/2]*s+im[i+k+len/2]*c;
        re[i+k+len/2]=re[i+k]-xr;im[i+k+len/2]=im[i+k]-xi;re[i+k]+=xr;im[i+k]+=xi;}}
      for(let k=0;k<N/2;k++)P[k]+=re[k]*re[k]+im[k]*im[k];fr++;}return P.map(v=>v/fr);};
  const n=Math.min(X.full.x.length,X.noEP.x.length,X.noPad.x.length),F=X.full.x.slice(0,n);
  const ep=spec(F.map((v,i)=>v-X.noEP.x[i])),pad=spec(F.map((v,i)=>v-X.noPad.x[i])),full=spec(F);
  const band_=(P,f0,f1)=>{let s=0;for(let k=Math.ceil(f0*N/44100);k<f1*N/44100;k++)s+=P[k];return +(10*Math.log10(s+1e-12)).toFixed(1);};
  const B=[[100,200],[200,400],[400,800],[800,1600]],o={};for(const [f0,f1] of B)o[f0+'-'+f1]={ep:band_(ep,f0,f1),pad:band_(pad,f0,f1),mix:band_(full,f0,f1)};
  const lm=(P)=>{let s=0;for(let k=Math.ceil(200*N/44100);k<800*N/44100;k++)s+=P[k];return 10*Math.log10(s+1e-12);};
  res.renders[band]={bands:o,padMinusEpLowMid:+(lm(pad)-lm(ep)).toFixed(1),epLowMidVsMix:+(lm(ep)-lm(full)).toFixed(1),padLowMidVsMix:+(lm(pad)-lm(full)).toFixed(1),peak:[X.full.peak,X.noEP.peak,X.noPad.peak],nan:X.full.nan};
  console.log('render',band,JSON.stringify(res.renders[band]));}
console.log('RESULT',JSON.stringify({label,...res}));console.log('errors',errs);await b.close();
