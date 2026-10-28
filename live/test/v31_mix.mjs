// v31: mix audit -- offline renders with per-bus stems (extra discrete channels), per state (intro / warm / build / peak / break / jazz / odd / spastik / bells / chip)
//  per stem: RMS / peak (dBFS at the stem tap), share of the summed energy, five spectral bands (sub <60, low 60-250, lowmid 250-800, mid 800-3k, high 3k+),
//  master: integrated RMS, pre-limiter peak, limiter gain reduction, kick peak scaled to the pre-limiter point, band balance per state
// usage: HTML=... node v31_mix.mjs [out.json] [bands=bchill,b120,b140] [seed=7]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';import fs from 'fs';
const here=path.dirname(fileURLToPath(import.meta.url)),html=process.env.HTML?path.resolve(process.env.HTML):path.resolve(here,'../index.html');
const OUT=process.argv[2]||'/tmp/v31_mix.json',BANDS=(process.argv[3]||'bchill,b120,b140').split(','),SEED=+(process.argv[4]||7);
const STEMS=['kick','bass','hat','clap','perc','stab','fill','riser','verb','dly','pad','jazz','chip','odd','bells','showdr','lead','pre','echo'];
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--js-flags=--max-old-space-size=6000']});
const errs=[];
const RUNS=[
  {name:'intro',o:{opening:true,bars:48}},
  {name:'set',o:{bars:64,intents:[{bar:2,text:'ピークを作って'}]}},
  {name:'jazz',o:{bars:32},force:{jazzForceBar:8,jazzForceLen:16}},
  {name:'chip',o:{bars:32},force:{chipForceBar:8,chipForceLen:16}},
  {name:'odd',o:{bars:32},force:{oddForceBar:8,oddForceLen:16}},
  {name:'spastik',o:{bars:32},force:{showForceBar:8,showForceLen:16,showForceKind:'spastik'}},
  {name:'bells',o:{bars:32},force:{showForceBar:8,showForceLen:16,showForceKind:'bells'}},
];
const all={};
const ONLY=process.env.RUNS?process.env.RUNS.split(','):null,NOSPICE=!!process.env.NOSPICE;   // NOSPICE: no jazz / chip segments (A/B listening of the same material)
for(const band of BANDS)for(const R of RUNS){if(ONLY&&!ONLY.includes(R.name))continue;
  const p=await b.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.goto('file://'+html);await p.waitForFunction(()=>window.__renderOffline);
  const r=await p.evaluate(async({band,R,STEMS,SEED,NOSPICE})=>{
    const lab=[];let E;
    const res=await window.__renderOffline({band,bars:R.o.bars,seed:SEED,auto:true,opening:!!R.o.opening,intents:R.o.intents,keep:true,channels:2+STEMS.length,
      setup:e=>{E=e;Object.assign(e,R.force||{});if(NOSPICE){e.jazzPre=()=>{};e.chipBar=()=>{};}const c=e.ctx,m=c.createChannelMerger(2+STEMS.length);m.connect(c.destination);
        const tap={kick:[e.bus.kick],bass:[e.bus.bass],hat:[e.bus.hat],clap:[e.bus.clap],perc:[e.bus.perc],stab:[e.pumpUp],fill:[e.fillBus],riser:[e.riserBus],verb:[e.verbRet],dly:[e.wet],
          pad:[e.padEQ],jazz:[e.jzFade],chip:[e.chipFade],odd:[e.oddFade],bells:[e.shBFade],showdr:[e.shDrFade],lead:Object.values(e.upSend).map(x=>x.dry),pre:[e.fadeG],echo:[e.echoOut]};
        STEMS.forEach((k,i)=>{for(const n of tap[k])if(n)n.connect(m,0,2+i);});
        const o=e.scheduleStep.bind(e);e.scheduleStep=t=>{if(e.step%16===0){const cd=e.cond,cur=cd.set&&cd.set.list[cd.set.idx];let L;
          if(e.show&&e.show.on)L=e.show.kind;else if(e.odd&&e.odd.on)L='odd';else if(e.jazz&&e.jazz.on)L='jazz';else if(e.chip&&e.chip.on)L='chip';
          else if(e.drop&&e.drop.active)L='break';else if(cd.opening)L='intro';else L=cd.chill?'chill':(cur?cur.phase:'warm');
          lab.push([Math.floor(e.step/16),t,L]);}o(t);};}});
    const {buf,end}=window.__lastBuf,sr=buf.sampleRate,N=4096;
    // FFT (radix-2) power per band
    const fftBand=(x,i0)=>{const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=(x[i0+i]||0)*(0.5-0.5*Math.cos(2*Math.PI*i/N));
      for(let i=1,j=0;i<N;i++){let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];}}
      for(let len=2;len<=N;len<<=1){const a=-2*Math.PI/len;for(let i=0;i<N;i+=len)for(let k=0;k<len/2;k++){const wr=Math.cos(a*k),wi=Math.sin(a*k),u=i+k,v=u+len/2;const tr=re[v]*wr-im[v]*wi,ti=re[v]*wi+im[v]*wr;re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;}}
      const B=[0,0,0,0,0];for(let k=1;k<N/2;k++){const f=k*sr/N,pw=re[k]*re[k]+im[k]*im[k];B[f<60?0:f<250?1:f<800?2:f<3000?3:4]+=pw;}return B;};
    const st={};const chans=[['mix',[0,1]],...STEMS.map((k,i)=>[k,[2+i]])];
    const D=chans.map(([k,cs])=>[k,cs.map(c=>buf.getChannelData(c))]);
    for(let i=0;i<lab.length;i++){const [bar,t0,L]=lab[i],t1=lab[i+1]?lab[i+1][1]:end;const a=Math.floor(t0*sr),z=Math.floor(t1*sr);
      const S=st[L]||(st[L]={bars:0,n:0,ch:{}});S.bars++;S.n+=z-a;
      for(const [k,xs] of D){const C=S.ch[k]||(S.ch[k]={ss:0,pk:0,bands:[0,0,0,0,0]});for(const x of xs){for(let j=a;j<z;j++){const v=x[j];C.ss+=v*v;const av=v<0?-v:v;if(av>C.pk)C.pk=av;}
        for(let j=a;j+N<=z;j+=N*2){const bb=fftBand(x,j);for(let q=0;q<5;q++)C.bands[q]+=bb[q];}}C.nch=xs.length;}}
    const db=v=>v>0?+(10*Math.log10(v)).toFixed(1):-120;
    const out={};for(const [L,S] of Object.entries(st)){out[L]={bars:S.bars,ch:{}};for(const [k,C] of Object.entries(S.ch)){const tb=C.bands.reduce((x,y)=>x+y,0);
      out[L].ch[k]={rms:db(C.ss/(S.n*C.nch)),pk:db(C.pk*C.pk),bands:C.bands.map(v=>tb>0?+(100*v/tb).toFixed(1):0),bandDb:C.bands.map(db)};}}
    window.__lastBuf=null;
    return {states:out,limGR:res.limGR,rmsDb:res.rmsDb,peakDb:res.peakDb,nan:res.nan,trim:E.trim.gain.value,labels:lab.map(x=>x[2]).join(',')};
  },{band,R,STEMS,SEED,NOSPICE});
  all[band+'/'+R.name]=r;console.log(band,R.name,'rms',r.rmsDb,'pk',r.peakDb,'GR',JSON.stringify(r.limGR),'trim',r.trim.toFixed(3),Object.entries(r.states).map(([k,v])=>k+':'+v.bars).join(' '));
  await p.close();
}
fs.writeFileSync(OUT,JSON.stringify({all,errs},null,0));console.log('errors',errs.length,errs.slice(0,5));await b.close();
