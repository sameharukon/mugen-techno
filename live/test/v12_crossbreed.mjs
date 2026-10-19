// v12: 160帯 クロスブリード kick "glue" measurements (vs シュランツ / ハードコア references), steady state and during mixes in / out.
// Renders with stem taps (extra output channels of the OfflineAudioContext) and measures, per style:
//  level    : kick vs rest RMS (pre-master), kick peak vs rest RMS
//  spectrum : band energies (sub/low/low-mid/mid/presence/air) of kick vs bass / drums(hat+clap+perc) / upper(stab incl. returns)
//  click    : kick HF (>2 kHz) in the first 15 ms vs the rest's HF level
//  tail     : kick tail pitch (Hz, note, cents vs key) vs offbeat-bass fundamental; low-band (<150 Hz) correlation kick×bass; low-band hole/overlap over the beat
//  paths    : share of the kick energy from the hardcore-distortion path / hard clip / soft sat / rumble
//  pump     : kick-synchronous envelope depth (dB) of bass / drums / upper pre-master and of the whole non-kick mix after master processing
//  space    : wet share (reverb + delay returns) of the rest vs the kick
//  master   : limiter / clip action at the kick (output-vs-pre envelope at kick vs between kicks)
// usage: node v12_crossbreed.mjs [steady|mix|all] [label] [html file, default ../index.html — pass index.v12pre.bak.html for the 'before' numbers]
import { chromium } from 'playwright-core';
const which=process.argv[2]||'all',label=process.argv[3]||'',html=process.argv[4]||'/workspace/techno/live/index.html';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
// an older build (e.g. index.v12pre.bak.html) lacks the measurement hooks (multi-channel offline render + keep buffer): inject them in a temp copy
// (audio graph untouched — only the render context's channel count and a reference to the rendered buffer)
{const fs=await import('fs');let src=fs.readFileSync(html,'utf8');
  if(!src.includes('if(o.keep)window.__lastBuf')){
    src=src.replace('const oc=new OfflineAudioContext(2,','const oc=new OfflineAudioContext(o.channels||2,').replace('e.debug=true;\n    if(o.auto)','e.debug=true;if(o.channels)oc.destination.channelInterpretation="discrete";\n    if(o.auto)')
      .replace('const buf=await oc.startRendering();const end=t;','const buf=await oc.startRendering();const end=t;if(o.keep)window.__lastBuf={buf,end,kicks:e.kickLog.map(x=>x[0]),bass:e.bassLog.map(x=>x[0]),bpmLog:e.bpmLog,key:S.key,keyOff:keyOff()};');
    if(!src.includes('if(o.keep)window.__lastBuf'))throw new Error('could not inject measurement hooks');
    const tmp='/tmp/v12_measure_'+process.pid+'.html';fs.writeFileSync(tmp,src);await p.goto('file://'+tmp);}
  else await p.goto('file://'+html);}
async function measure(opts,win){
  return await p.evaluate(async ([opts,win])=>{
    const CH={kick:2,bass:3,hat:4,clap:5,perc:6,stab:7,verb:8,dly:9,sum:10,pre:11,gab:12,hard:13,rumble:14,sat:15,fill:16,room:17,upPost:18};
    const r=await window.__renderOffline({...opts,channels:19,keep:true,full:true,setup:e=>{
      const c=e.ctx,m=c.createChannelMerger(19);m.connect(c.destination);
      const tap=(node,ch)=>{const g=c.createGain();g.channelCount=2;node.connect(g);g.connect(m,0,ch);};
      for(const k of ["kick","bass","hat","clap","perc","stab"])tap(e.bus[k],CH[k]);
      tap(e.verbRet,CH.verb);tap(e.wet,CH.dly);tap(e.sum,CH.sum);tap(e.fadeG,CH.pre);tap(e.kickGabOut,CH.gab);tap(e.kickHard,CH.hard);tap(e.rout,CH.rumble);tap(e.kickSat,CH.sat);tap(e.fillBus,CH.fill);if(e.kickRoom)tap(e.kickRoom,CH.room);tap(e.pumpUp||e.bus.stab,CH.upPost);}});
    const B=window.__lastBuf,buf=B.buf,sr=buf.sampleRate;
    const bars=B.bpmLog;const barT=[];{let tt=0.01;for(const row of bars){barT.push(tt);tt+=16*60/row[1]/4;}barT.push(tt);}
    const t0=barT[win[0]],t1=barT[Math.min(win[1],barT.length-1)],i0=Math.floor(t0*sr),i1=Math.floor(t1*sr),N=i1-i0;
    const ch=k=>buf.getChannelData(CH[k]).subarray(i0,i1);
    const mix=(...ks)=>{const o=new Float32Array(N);for(const k of ks){const a=ch(k);for(let i=0;i<N;i++)o[i]+=a[i];}return o;};
    // sum tap = 0.8 × (all buses + returns); per-bus taps are pre-0.8 → scale buses by 0.8 for the same domain
    const kick=ch('kick').map(x=>x*0.8),bass=ch('bass').map(x=>x*0.8),drums=mix('hat','clap','perc').map(x=>x*0.8),upper=ch('upPost').map(x=>x*0.8);   // 上モノ as it reaches the sum (after the v12 pump, if any)
    const sum=ch('sum'),rest=mix('bass','hat','clap','perc','upPost','fill').map(x=>x*0.8);   // rest from stems (subtracting the kick from the sum leaves a residue from the kick bus low-cut's phase shift)
    const L=buf.getChannelData(0).subarray(i0,i1),R=buf.getChannelData(1).subarray(i0,i1),outM=L.map((x,i)=>0.5*(x+R[i])),pre=ch('pre');
    const db=x=>+(10*Math.log10(x+1e-20)).toFixed(1),ms=a=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*a[i];return s/a.length;};
    // biquads for band / HF filtering
    const biq=(a,type,f,q=0.707)=>{const w=2*Math.PI*f/sr,cs=Math.cos(w),al=Math.sin(w)/(2*q);let b0,b1,b2,a0=1+al,a1=-2*cs,a2=1-al;
      if(type==='lp'){b0=(1-cs)/2;b1=1-cs;b2=(1-cs)/2;}else{b0=(1+cs)/2;b1=-(1+cs);b2=(1+cs)/2;}
      const o=new Float32Array(a.length);let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<a.length;i++){const x=a[i],y=(b0*x+b1*x1+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=x;y2=y1;y1=y;o[i]=y;}return o;};
    // FFT band energies (Welch, 4096 hann)
    const NF=4096,hann=new Float32Array(NF).map((_,i)=>0.5-0.5*Math.cos(2*Math.PI*i/NF));
    const fft=(re,im)=>{const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
      for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const ar=re[i+k],ai=im[i+k],br=re[i+k+len/2]*cr-im[i+k+len/2]*ci,bi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
        re[i+k]=ar+br;im[i+k]=ai+bi;re[i+k+len/2]=ar-br;im[i+k+len/2]=ai-bi;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}};
    const psd=a=>{const P=new Float64Array(NF/2);let fr=0;for(let s=0;s+NF<=a.length;s+=NF){const re=new Float64Array(NF),im=new Float64Array(NF);for(let i=0;i<NF;i++)re[i]=a[s+i]*hann[i];fft(re,im);for(let k=0;k<NF/2;k++)P[k]+=re[k]*re[k]+im[k]*im[k];fr++;}for(let k=0;k<NF/2;k++)P[k]/=Math.max(1,fr);return P;};
    const BANDS=[["sub",20,60],["low",60,150],["lowmid",150,500],["mid",500,2000],["pres",2000,6000],["air",6000,16000]];
    const bandE=P=>Object.fromEntries(BANDS.map(([n,a,b])=>{let s=0;for(let k=Math.ceil(a*NF/sr);k<Math.floor(b*NF/sr);k++)s+=P[k];return [n,s];}));
    const Ps={kick:psd(kick),bass:psd(bass),drums:psd(drums),upper:psd(upper),rest:psd(rest),sum:psd(sum)},Es=Object.fromEntries(Object.entries(Ps).map(([k,P])=>[k,bandE(P)]));
    const tot=Object.values(Es.sum).reduce((a,b)=>a+b,0);
    const spectrum=Object.fromEntries(["kick","bass","drums","upper","rest"].map(k=>[k,Object.fromEntries(BANDS.map(([n])=>[n,db(Es[k][n]/tot)]))]));
    const kickMinusRest=Object.fromEntries(BANDS.map(([n])=>[n,+(db(Es.kick[n])-db(Es.rest[n])).toFixed(1)]));
    // kick events in the window
    const K=B.kicks.filter(x=>x>=t0+0.02&&x<t1-0.4).map(x=>Math.round((x-t0)*sr));
    const beat=60/bars[win[0]][1],bS=Math.round(beat*sr);
    // click: kick HF (>2 kHz) energy in the first 15 ms vs rest HF over the whole window
    const kHF=biq(biq(kick,'hp',2000),'hp',2000),rHF=biq(biq(rest,'hp',2000),'hp',2000);let cs=0,cn=0;for(const k of K){for(let i=k;i<k+Math.round(0.015*sr)&&i<N;i++){cs+=kHF[i]*kHF[i];cn++;}}
    const click={kickHF15msDb:db(cs/Math.max(1,cn)),restHFDb:db(ms(rHF)),clickOverRestHFdB:+(db(cs/Math.max(1,cn))-db(ms(rHF))).toFixed(1)};
    // kick tail pitch (zero crossings of LP-200 kick, 90..(beat-60ms) after the hit) and bass fundamental (PSD peak 30..200 Hz)
    const kLP=biq(biq(kick,'lp',200),'lp',200);const fz=[];for(const k of K){const a=k+Math.round(0.09*sr),z=k+Math.round(Math.min(0.26,beat-0.06)*sr);let zc=0,first=-1,last=-1;for(let i=a+1;i<z&&i<N;i++)if(kLP[i-1]<0&&kLP[i]>=0){zc++;if(first<0)first=i;last=i;}if(zc>2)fz.push((zc-1)*sr/(last-first));}
    fz.sort((a,b)=>a-b);const tailHz=fz.length?fz[fz.length>>1]:null;
    const NB=16384,hb=new Float32Array(NB).map((_,i)=>0.5-0.5*Math.cos(2*Math.PI*i/NB));
    const peakHz=a=>{const P=new Float64Array(NB/2);for(let s=0;s+NB<=a.length;s+=NB>>1){const re=new Float64Array(NB),im=new Float64Array(NB);for(let i=0;i<NB;i++)re[i]=a[s+i]*hb[i];fft(re,im);for(let k=0;k<NB/2;k++)P[k]+=re[k]*re[k]+im[k]*im[k];}
      let bk=0,bv=0;for(let k=Math.ceil(30*NB/sr);k<200*NB/sr;k++)if(P[k]>bv){bv=P[k];bk=k;}if(bv<=0)return null;const y0=P[bk-1],y1=P[bk],y2=P[bk+1],dl=0.5*(y0-y2)/(y0-2*y1+y2||1);return (bk+dl)*sr/NB;};
    const note=f=>{if(!f)return null;const m=69+12*Math.log2(f/440),rm=Math.round(m);return {hz:+f.toFixed(1),midi:+m.toFixed(2),name:["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][((rm%12)+12)%12]+(Math.floor(rm/12)-1),cents:Math.round((m-rm)*100)};};
    const rootPc=((57+B.keyOff)%12+12)%12;const vsKey=f=>{if(!f)return null;const m=69+12*Math.log2(f/440);let d=((m-rootPc)%12+12)%12;if(d>6)d-=12;return +d.toFixed(2);};
    // low-band kick×bass correlation and low-band coverage across the beat
    const kL=biq(kick,'lp',150),bL=biq(bass,'lp',150),sL=biq(biq(sum,'lp',150),'lp',150);let kb=0,kk=0,bb=0;for(let i=0;i<N;i++){kb+=kL[i]*bL[i];kk+=kL[i]*kL[i];bb+=bL[i]*bL[i];}
    const slots=16,env=(a,smooth=true)=>{const E=new Float64Array(slots),C=new Float64Array(slots);for(const k of K){for(let s=0;s<slots;s++){const a0=k+Math.floor(s*bS/slots),a1=k+Math.floor((s+1)*bS/slots);for(let i=a0;i<a1&&i<N;i++){E[s]+=a[i]*a[i];C[s]++;}}}return [...E].map((x,i)=>db(x/Math.max(1,C[i])));};
    const lowEnv=env(sL),lowHoleDb=+(Math.max(...lowEnv)-Math.min(...lowEnv)).toFixed(1);
    const depth=a=>{const E=env(a);const mx=Math.max(...E.slice(4)),mn=Math.min(...E.slice(0,4));return {dipDb:+(mx-mn).toFixed(1),env:E.join(" ")};};
    // pump of the non-kick parts (pre-master) and of the post-master mix minus kick contribution (approx: output vs pre ratio around kicks)
    const pump={bass:depth(bass),drums:depth(drums),upper:depth(upper),restPre:depth(rest)};
    // master: ratio output/pre (gain applied by clip + limiter) at kick (0..30 ms) vs between (beat/2 .. beat-30 ms)
    let gk=0,nk=0,gb=0,nb=0;const pe=biq(pre,'lp',30),oe=biq(outM,'lp',30);
    {const ab=x=>Math.abs(x);const rmsAt=(a,s,e)=>{let q=0;for(let i=s;i<e&&i<N;i++)q+=a[i]*a[i];return Math.sqrt(q/Math.max(1,e-s));};
      for(const k of K){const pk=rmsAt(pre,k,k+Math.round(0.03*sr)),ok=rmsAt(outM,k,k+Math.round(0.03*sr)),pb=rmsAt(pre,k+(bS>>1),k+bS-Math.round(0.03*sr)),ob=rmsAt(outM,k+(bS>>1),k+bS-Math.round(0.03*sr));if(pk>0&&pb>0){gk+=20*Math.log10(ok/pk);nk++;gb+=20*Math.log10(ob/pb);nb++;}}}
    const master={gainAtKickDb:+(gk/Math.max(1,nk)).toFixed(2),gainBetweenDb:+(gb/Math.max(1,nb)).toFixed(2)};master.kickOnlyReductionDb=+(master.gainAtKickDb-master.gainBetweenDb).toFixed(2);
    // kick path shares
    const kE=ms(ch('kick')),paths=Object.fromEntries(["gab","hard","sat","rumble"].map(k=>[k,+(ms(ch(k))/kE).toFixed(3)]));
    // space: wet share
    const wetE=(ms(ch('verb'))+ms(ch('dly')))*0.64;
    const kpk=(()=>{let m=0;for(const k of K)for(let i=k;i<k+Math.round(0.03*sr)&&i<N;i++)m=Math.max(m,Math.abs(kick[i]));return m;})();
    return {style:opts.style,window:win,bpm:+bars[win[0]][1].toFixed(2),kicks:K.length,
      level:{kickRmsDb:db(ms(kick)),restRmsDb:db(ms(rest)),kickMinusRestDb:+(db(ms(kick))-db(ms(rest))).toFixed(1),kickPeakOverRestRmsDb:+(20*Math.log10(kpk)-db(ms(rest))).toFixed(1),outRmsDb:db(ms(outM))},
      spectrum,kickMinusRestPerBand:kickMinusRest,click,
      tail:{kickTail:note(tailHz),kickTailVsRootSemis:vsKey(tailHz),bassFund:note(peakHz(bass)),bassVsRootSemis:vsKey(peakHz(bass)),kickPsdPeak:note(peakHz(kick)),key:B.key,
        lowCorrKickBass:+(kb/Math.sqrt(kk*bb+1e-20)).toFixed(3),bassLowShareDb:db(bb/(kk+1e-20)),lowBandOverBeatDb:lowEnv.join(" "),lowBandSpreadDb:lowHoleDb},
      paths,pump,master,space:{restWetShareDb:db(wetE/ms(rest)),kickRumbleShare:paths.rumble,kickRoomSendDb:db(ms(ch('room'))/kE),kickMidsDryOnly:!(ms(ch('room'))>0)},peakDb:r.peakDb,nan:r.nan,limGR:r.limGR,kicksFromTwoDecksNear:r.kicksFromTwoDecksNear,bassTwoDecksNear:r.bassTwoDecksNear,seq:r.bpmLog?undefined:undefined};
  },[opts,win]);
}
const out=[];
if(which==='steady'||which==='all')for(const st of ['broken','groove','hard','tribal','minimal']){const t0=Date.now();const m=await measure({bars:20,seed:162,band:'b160',style:st},[4,20]);out.push(m);
  console.log(`=== steady ${st} ${label} (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(m));}
if(which==='mix'||which==='all'){
  // mix into crossbreed from schranz, and out of crossbreed into hardcore; measure during the overlap and after
  for(const [name,o,wins] of [['シュランツ→クロスブリード',{bars:56,seed:163,band:'b160',style:'groove',intents:[{bar:1,text:'クロスブリードに'}]},[[8,24],[32,52]]],
                              ['クロスブリード→ハードコア',{bars:56,seed:164,band:'b160',style:'broken',intents:[{bar:1,text:'ハードコアにして'}]},[[8,24],[32,52]]]]){
    for(const w of wins){const t0=Date.now();const m=await measure(o,w);out.push({name,...m});console.log(`=== mix ${name} bars ${w.join('-')} ${label} (${((Date.now()-t0)/1000).toFixed(0)}s)`);console.log(JSON.stringify(m));}}}
console.log('errors',errs);await b.close();
