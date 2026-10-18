// features measured on the isolated kick bus (+ master trim): [sub55, low130, harmonic330, mid700 at the hit, rumble tail 130Hz between kicks, crest factor]
// Kick timbre continuity into hard techno: per-kick spectral features (sub / low / mid band energy at the hit,
// rumble tail energy between kicks) and the size of the biggest kick-to-kick step during the transition,
// v8 (index.html) vs v7 (index.v7.bak.html).
import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
async function harness(cfg){
  const sr=44100,saved=JSON.stringify(S);
  if(cfg.band)S.band=cfg.band;S.style=cfg.style;
  try{
  const bars=cfg.bars,secs=bars*16*60/118/4+2;
  const oc=new OfflineAudioContext(4,Math.ceil(sr*secs),sr),e=new Engine(oc,cfg.seed>>>0);e.debug=true;
  // isolated kick bus (kick + rumble, before master trim / limiter) on channel 2
  const mg=oc.createChannelMerger(4);e.bus.kick.connect(mg,0,2);mg.connect(oc.destination);const trimAt=[];
  let t=0.01,said=false,mixInfo=null;const barT=[];e.onStep=(s,tt)=>{if(s===0)barT.push(tt);};
  const sched=lim=>{while(e.step<bars*16&&t<lim){if(!said&&e.step===24){said=true;e.cond.intent(cfg.say);}
    if(e.cond.mix&&!mixInfo)mixInfo={m:e.cond.mix.m,swap:e.cond.mix.swap,end:e.cond.mix.end,brk:e.cond.mix.breakType||null};
    e.scheduleStep(t);if(e.step%16===1)trimAt.push([t,e.trimEnv.valueAt(t)]);t+=e.s16;}};
  sched(1.5);for(let k=1;k<secs-0.5;k++)oc.suspend(k).then(()=>{sched(k+1.5);oc.resume();});
  const buf=await oc.startRendering();const L=buf.getChannelData(0),R=buf.getChannelData(1),n=Math.min(L.length,Math.ceil(t*sr));
  const KB=buf.getChannelData(2),mono=new Float32Array(n);for(let i=0;i<n;i++)mono[i]=KB[i];
  const trimDbAt=tt=>{let v=1;for(const [a,g] of trimAt)if(a<=tt)v=g;return 20*Math.log10(v);};
  const bp=(f0,Q)=>{const w=2*Math.PI*f0/sr,al=Math.sin(w)/(2*Q),a0=1+al,b0=al/a0,b2=-al/a0,a1=-2*Math.cos(w)/a0,a2=(1-al)/a0,y=new Float32Array(n);
    let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<n;i++){const x=mono[i],v=b0*x+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=v;y[i]=v;}return y;};
  const B={sub:bp(55,1.4),low:bp(130,1.2),h2:bp(330,1.4),mid:bp(700,0.9)};
  const en=(y,a,z)=>{let s=0;const i0=Math.round(a*sr),i1=Math.min(n,Math.round(z*sr));for(let i=i0;i<i1;i++)s+=y[i]*y[i];return 10*Math.log10(s/(i1-i0)+1e-12);};
  const K=e.kickLog.map(x=>x[0]);const feats=[];
  for(let i=0;i<K.length;i++){const tk=K[i];if((i>0&&tk-K[i-1]<0.4)||(i<K.length-1&&K[i+1]-tk<0.4))continue;if(tk+0.3>t)continue;
    const bar=barT.findIndex((x,j)=>x<=tk+1e-6&&(barT[j+1]??1e9)>tk+1e-6);
    // crest factor of the low band (hard clipping flattens it) as a 'hardness' proxy
    const i0=Math.round(tk*sr),i1=Math.round((tk+0.08)*sr);let pk=0;for(let j=i0;j<i1;j++)pk=Math.max(pk,Math.abs(B.sub[j]+B.low[j]));
    const rmsL=0.5*(en(B.sub,tk,tk+0.08)+en(B.low,tk,tk+0.08)),crest=20*Math.log10(pk+1e-9)-rmsL;
    const g=trimDbAt(tk);feats.push({t:tk,bar,f:[g+en(B.sub,tk,tk+0.08),g+en(B.low,tk,tk+0.08),g+en(B.h2,tk,tk+0.08),g+en(B.mid,tk,tk+0.08),g+en(B.low,tk+0.13,tk+0.22),crest]});}
  const step=(a,c)=>a.f.reduce((s,v,k)=>s+Math.abs(v-c.f[k]),0)/a.f.length;
  const steps=[];for(let i=1;i<feats.length;i++)steps.push({bar:feats[i].bar,d:step(feats[i-1],feats[i]),gap:+(feats[i].t-feats[i-1].t).toFixed(2)});
  const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
  const M=mixInfo,base=steps.filter(x=>x.bar>=2&&x.bar<M.m).map(x=>x.d),tr=steps.filter(x=>x.bar>=M.m&&x.bar<=M.end+4);
  const mx=tr.reduce((a,x)=>x.d>a.d?x:a,{d:0});
  const swapStep=steps.find(x=>x.bar>=M.swap);
  const pre=feats.filter(x=>x.bar>=2&&x.bar<M.m),post=feats.filter(x=>x.bar>M.end+4);
  const mean=arr=>arr[0].f.map((_,k)=>arr.reduce((s,x)=>s+x.f[k],0)/arr.length);
  const A=mean(pre),Z=mean(post),total=A.reduce((s,v,k)=>s+Math.abs(v-Z[k]),0)/A.length;
  const r1=x=>+x.toFixed(2);
  // how many kicks carry 80% of the total change (spread of the morph)
  return {cfg:cfg.name,mix:M,bpmEnd:+e.bpm.toFixed(1),steadyStepMedDb:r1(med(base)),totalChangeDb:r1(total),
    maxStepDb:r1(mx.d),maxStepBar:mx.bar,maxStepGapS:mx.gap,maxStepShareOfTotal:r1(mx.d/total),
    swapStepDb:swapStep?r1(swapStep.d):null,
    featBefore:A.map(r1),featAfter:Z.map(r1),
    trace:feats.filter(x=>x.bar>=M.m-2&&x.bar<=M.end+2&&x.bar%2===0).filter((x,i,a)=>i===0||a[i-1].bar!==x.bar).map(x=>`${x.bar}:${x.f.map(v=>v.toFixed(0)).join("/")}`).join(" ")};
  }finally{Object.assign(S,JSON.parse(saved));}
}
const runs=[
  ['/workspace/techno/live/index.v7.bak.html',{name:'v7 minimal→hard(142)',style:'minimal',say:'もっとハードに',seed:21,bars:44}],
  ['/workspace/techno/live/index.html',{name:'v8 120帯 minimal→インダストリアル',band:'b120',style:'minimal',say:'もっとハードに',seed:21,bars:44}],
  ['/workspace/techno/live/index.v7.bak.html',{name:'v7 groove→hard',style:'groove',say:'もっとハードに',seed:22,bars:44}],
  ['/workspace/techno/live/index.html',{name:'v8 140帯 groove→ハードテクノ',band:'b140',style:'groove',say:'もっとハードに',seed:22,bars:44}],
  ['/workspace/techno/live/index.html',{name:'v8 140帯 tribal→ハードテクノ',band:'b140',style:'tribal',say:'もっとハードに',seed:23,bars:44}],
];
for(const [f,cfg] of runs){const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+f);
  const r=await p.evaluate(`(${harness.toString()})(${JSON.stringify(cfg)})`);console.log(JSON.stringify(r));if(errs.length)console.log('errors',errs);await p.close();}
await b.close();
