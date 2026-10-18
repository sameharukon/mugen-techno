// Offline render of every break type: peak/NaN, continuity at entry / internal marks / return,
// HPF + riser probe continuity, and exact downbeat recovery (kick lands on the computed return time,
// audio onset after tape stop / silence is not delayed).
import { chromium } from 'playwright-core';
const file = process.argv[2] || '/workspace/techno/live/index.html';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox'] });
async function harness(cfg){
  const sr=44100,saved=JSON.stringify(S);
  Object.assign(S,{style:cfg.style,crash:cfg.crash??true,riser:true,fill:true,dropManual:false,autoDrop:false});
  try{
  const e0bpm=STYLES[cfg.style].bpm,pre=cfg.pre||4,bars=pre+cfg.len+4,secs=bars*16*60/e0bpm/4+2;
  const oc=new OfflineAudioContext(4,Math.ceil(sr*secs),sr),e=new Engine(oc,cfg.seed>>>0);e.debug=true;
  const m=oc.createChannelMerger(4);e.hpCtl.connect(m,0,2);e.lvlCtl.connect(m,0,3);m.connect(oc.destination);
  if(cfg.mix){const ls=[];e.cond.requestStyle(cfg.mix,{len:16,grid:4,gap:1,dropLen:cfg.len,breakType:cfg.type},ls);}
  else e.cond.addEvent({bar:pre,type:"break",len:cfg.len,btype:cfg.type,label:"test"});
  const barT=[];let t=0.01;
  e.onStep=(s,tt)=>{if(s===0)barT.push(tt);};
  const sched=lim=>{while(e.step<bars*16&&t<lim){e.scheduleStep(t);t+=e.s16;}};
  sched(1.5);for(let k=1;k<secs-0.5;k++)oc.suspend(k).then(()=>{sched(k+1.5);oc.resume();});
  const buf=await oc.startRendering();
  const L=buf.getChannelData(0),R=buf.getChannelData(1),P=[buf.getChannelData(2),buf.getChannelData(3)],at=T=>Math.round(T*sr),n=at(t);
  let pk=0,nan=0;for(const x of [L,R])for(let i=0;i<n;i++){if(!Number.isFinite(x[i]))nan++;else pk=Math.max(pk,Math.abs(x[i]));}
  const met=T=>{let d1=0,d2=0;for(let i=at(T-0.025);i<at(T+0.025);i++)for(const x of [L,R]){d1=Math.max(d1,Math.abs(x[i]-x[i-1]));d2=Math.max(d2,Math.abs(x[i]-2*x[i-1]+x[i-2]));}
    const F=Math.round(0.005*sr),fr=[];for(let i=at(T-0.04);i<at(T+0.15);i+=F){let q=0;for(let j=i;j<i+F;j++){const a=L[j]-L[j-1],c=R[j]-R[j-1];q+=a*a+c*c;}fr.push(Math.sqrt(q/F/2)+1e-9);}
    let dr=0;for(let k=1;k<fr.length;k++)dr=Math.max(dr,20*Math.log10(fr[k-1]/fr[k]));return {d1:+d1.toFixed(3),d2:+d2.toFixed(3),hf:+dr.toFixed(1)};};
  const normal=[1,2,3].map(bb=>met(barT[bb]));
  const bl=e.breakLog[0]||{},entry=bl.t,ret=e.returnTimes[0];
  const expectRet=entry!=null?barT[bl.bar+bl.len]:null;
  const kAfter=e.kickLog.find(k=>k[0]>=ret-1e-9);
  // audio onset after the return (only meaningful where the bar before is near silent)
  let onset=null;{const thr=0.02;for(let i=at(ret);i<at(ret+0.2);i++)if(Math.abs(L[i])>thr||Math.abs(R[i])>thr){onset=+((i/sr-ret)*1000).toFixed(2);break;}}
  let latRef=null;{for(let i=at(barT[0]);i<at(barT[0]+0.2);i++)if(Math.abs(L[i])>0.02||Math.abs(R[i])>0.02){latRef=+((i/sr-barT[0])*1000).toFixed(2);break;}}
  let preRms=0;{const i0=at(ret-0.02),i1=at(ret-0.004);for(let i=i0;i<i1;i++)preRms+=L[i]*L[i];preRms=+(10*Math.log10(preRms/(i1-i0)+1e-12)).toFixed(1);}
  const pst=P.map(p=>{let md=0;for(let i=1;i<n;i++)md=Math.max(md,Math.abs(p[i]-p[i-1]));return +md.toPrecision(3);});
  return {cfg:`${cfg.type}${cfg.mix?"(mix→"+cfg.mix+")":""} ${cfg.style} len${cfg.len}`,peakDb:+(20*Math.log10(pk)).toFixed(2),nan,
    normal,entry:entry!=null?met(entry):null,marks:e.brkMarks.map(([T,k])=>({k,...met(T)})),ret:ret!=null?met(ret):null,
    retExact:ret!=null&&Math.abs(ret-expectRet)<1e-9,kickOnReturn:kAfter?+((kAfter[0]-ret)*1e6).toFixed(3):null,
    onsetMs:onset,onsetRefFromSilenceMs:latRef,preReturnRmsDb:preRms,probeMaxStep:{hpHz:pst[0],riser:pst[1]},
    bpmAfter:e.bpm,breaks:e.breakLog.map(x=>x.type+"@"+x.bar),drops:e.stats.drops};
  }finally{Object.assign(S,JSON.parse(saved));}
}
const p=await b.newPage();const errs=[];p.on('pageerror',x=>errs.push(x.message));p.on('console',x=>{if(x.type()==='error')errs.push(x.text());});
await p.goto('file://'+file);
const types=await p.evaluate('BREAK_ORDER');
const cfgs=types.map((type,i)=>({type,style:'minimal',seed:11+i,len:{kick:2,breakdown:8,filter:4,hpbuild:4,bassonly:2,perconly:2,tapestop:1,stutter:1,echo:1,halftime:4,silence:1}[type]}));
cfgs.push({type:'tapestop',style:'hard',seed:3,len:1},{type:'stutter',style:'groove',seed:4,len:1},{type:'halftime',style:'tribal',seed:5,len:8},
  {type:'echo',style:'broken',seed:6,len:2},{type:'breakdown',style:'hard',seed:7,len:16,pre:2},{type:'silence',style:'tribal',seed:8,len:1},
  {type:'tapestop',style:'minimal',seed:9,len:1,mix:'hard',pre:0},{type:'hpbuild',style:'groove',seed:10,len:2,mix:'tribal',pre:0},{type:'echo',style:'tribal',seed:12,len:1,mix:'minimal',pre:0});
const t0=Date.now();
for(const c of cfgs){if(c.mix)c.len=c.len;const r=await p.evaluate(`(${harness.toString()})(${JSON.stringify({...c,len:c.mix?c.len:c.len,pre:c.mix?20:c.pre})})`);console.log(JSON.stringify(r));}
console.log('errors',errs,'secs',(Date.now()-t0)/1000);
await b.close();
