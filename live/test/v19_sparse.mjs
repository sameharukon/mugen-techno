// v19: the 上モノ "sparse" (まばら) section and the groove organ (オルガン＋ボイス = groove "classic" patch).
//  select : share of upper-active deck-bars per (style / patch / section) combo in おまかせ runs (natural start), per band
//  repeat : per combo (incl. groove-start runs for sample size): exact bar repeat within the previous 8 bars (same deck), mean max Jaccard
//           similarity to the previous 8 bars, distinct rhythm templates / bars, distinct bar patterns / bars, hits per bar
//  timbre : offline render of isolated hits (organ vs the other upper patches) -> RMS, peak, spectral centroid, band shares
// usage: node v19_sparse.mjs [label] [html] [bars=384] [seeds=4]
import { chromium } from 'playwright-core';
const label=process.argv[2]||'',html=process.argv[3]||'/workspace/techno/live/index.html',BARS=+(process.argv[4]||384),NS=+(process.argv[5]||4);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
async function sim(band,seed,style){await p.goto('file://'+html);return await p.evaluate(([band,seed,BARS,style])=>{
  S.band=band;S.style=style||BANDS[band].first;
  const oc=new OfflineAudioContext(2,44100,44100),e=new Engine(oc,seed);e.cond.auto=true;
  let cur=null;const rec=[];
  const ou=e.upperStep;e.upperStep=function(st,t,s,d){const pc=cur;cur=d;try{return ou.apply(e,[st,t,s,d]);}finally{cur=pc;}};
  const R=(ms)=>{if(!cur)return;for(const m of ms)rec.push([cur.id,e.bar,e.step&15,Math.round(m)-(57+offOf(cur.key!=null?cur.key:S.key))]);};
  e.synth=(t,midi,vel,dur,P)=>R((P.chord||[0]).map(iv=>midi+iv+(P.oct||0)));
  e.stab=(t,dest,root=57+keyOff(),ivs=[0,3,7,10])=>R(ivs.map(i=>root+i));e.hardStab=(t,root,b2)=>R([root]);
  e.organ=(t,root,vel,ivs=[0,3,7,10])=>R(ivs.map(i=>root+i));
  for(const n of ['acid','fmHit','vox','marimba','flute','pulse','bleep'])e[n]=(t,midi)=>R([midi]);
  e.drone=()=>{};if(e.chipNote){e.chipNote=()=>{};e.chipArp=()=>{};e.chipNoise=()=>{};}
  const combo={};let t=0.01;
  for(let st=0;st<BARS*16;st++){if((st&15)===8){for(const d of e.decks){if(!d.upOn||(e.melOK&&!e.melOK(d))||!d.arr.init||(e.chip&&e.chip.on))continue;
      const PL=patchList(d),pv=d.arr.chillPatch||PL[d.arr.variant]||PL[0];combo[d.id+':'+(st>>4)]=d.style+'/'+pv.n+'/'+d.arr.section;}}
    e.scheduleStep(t);t+=e.s16;}
  return {combo,rec};},[band,seed,BARS,style]);}
function analyse(runs){const per={};
  for(const {combo,rec} of runs){const bars={};for(const [id,bar,s,m] of rec){const k=id+':'+bar;(bars[k]||(bars[k]=[])).push([s,m]);}
    for(const [k,C] of Object.entries(combo)){const [id,bar]=k.split(':').map(Number);const N=bars[k]||[];
      const A=per[C]||(per[C]={bars:0,active:0,hits:0,rep:0,sim:0,sigs:new Set(),rhy:new Set()});A.bars++;if(!N.length)continue;A.active++;
      const sig=new Set(N.map(([s,m])=>s+':'+m)),rh=[...new Set(N.map(n=>n[0]))].sort((a,b)=>a-b).join(',');A.hits+=new Set(N.map(n=>n[0])).size;
      A.sigs.add([...sig].sort().join('|'));A.rhy.add(rh);
      let mx=0,ex=false;for(let j=bar-8;j<bar;j++){const P=bars[id+':'+j];if(!P||!P.length)continue;const ps=new Set(P.map(([s,m])=>s+':'+m));let i=0;for(const x of sig)if(ps.has(x))i++;
        const jac=i/(sig.size+ps.size-i);mx=Math.max(mx,jac);if(jac===1)ex=true;}
      A.sim+=mx;if(ex)A.rep++;}}
  const out={};for(const [C,A] of Object.entries(per)){if(A.active<16)continue;out[C]={bars:A.bars,active:A.active,hitsPerBar:+(A.hits/A.active).toFixed(2),exactRepeat8:+(A.rep/A.active).toFixed(3),
    nearSim8:+(A.sim/A.active).toFixed(3),distinctRhythms:+(A.rhy.size/A.active).toFixed(3),distinctBars:+(A.sigs.size/A.active).toFixed(3)};}return out;}
const SEL={},REP={};const all=[];
for(const band of ['b120','b140','bchill']){const runs=[];
  for(let i=0;i<NS;i++){const r=await sim(band,2000+i*104729+band.length,null);runs.push(r);all.push(r);}
  const cnt={};let tot=0;for(const r of runs)for(const C of Object.values(r.combo)){cnt[C]=(cnt[C]||0)+1;tot++;}
  SEL[band]=Object.fromEntries(Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(100*v/tot).toFixed(1)]));
  if(band!=='bchill')for(let i=0;i<NS;i++)all.push(await sim(band,3000+i*7919,'groove'));
  process.stderr.write(band+' done\n');}
const rep=analyse(all);
// timbre: isolated hits through the groove upper bus
const timbre=await p.evaluate(async()=>{await new Promise(r=>setTimeout(r,10));S.band='b140';S.style='groove';
  const sr=44100,oc=new OfflineAudioContext(2,sr*40,sr),e=new Engine(oc,77);const out={};
  const segs=[];const dest=e.upG.groove,PL=PATCHES.groove,PM=PATCHES.minimal;
  const list=[['organ',t=>e.organ(t,57,1,[0,3,7])],...(typeof ORGAN_ART!=='undefined'?[['organLeslie',t=>e.organ(t,57,1,[0,3,7],'leslie')],['organSwell',t=>e.organ(t,57,1,[0,3,7],'swell')]]:[]),['clav',t=>e.synth(t,57,1,e.s16,PL.find(x=>x.n==='clav'),dest)],['brass',t=>e.synth(t,57,1,e.s16*1.6,PL.find(x=>x.n==='brass'),dest)],
    ['piano',t=>e.synth(t,57,1,e.s16*1.6,PL.find(x=>x.n==='piano'),dest)],['dubchord',t=>e.synth(t,57,1,e.s16*1.6,PM.find(x=>x.n==='dubchord'),dest)],['dubstab',t=>e.stab(t,dest,57,[0,3,7])]];
  let t0=0.5;for(const [n,f] of list){for(let i=0;i<8;i++)f(t0+i*0.42);segs.push([n,t0,t0+8*0.42]);t0+=4.5;}
  const buf=await oc.startRendering(),L=buf.getChannelData(0),Rr=buf.getChannelData(1);
  const fft=(re,im)=>{const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
    for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len;for(let i=0;i<n;i+=len)for(let k=0;k<len/2;k++){const c=Math.cos(a*k),s=Math.sin(a*k),xr=re[i+k+len/2]*c-im[i+k+len/2]*s,xi=re[i+k+len/2]*s+im[i+k+len/2]*c;
      re[i+k+len/2]=re[i+k]-xr;im[i+k+len/2]=im[i+k]-xi;re[i+k]+=xr;im[i+k]+=xi;}}};
  for(const [n,a,z] of segs){const i0=Math.floor(a*sr),i1=Math.floor((z+0.4)*sr);let ss=0,pk=0;for(let i=i0;i<i1;i++){const x=(L[i]+Rr[i])/2;ss+=x*x;pk=Math.max(pk,Math.abs(L[i]),Math.abs(Rr[i]));}
    const N=4096,P=new Float64Array(N/2);for(let s0=i0;s0+N<i1;s0+=N/2){const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=(L[s0+i]+Rr[s0+i])/2*(0.5-0.5*Math.cos(2*Math.PI*i/N));fft(re,im);for(let k=0;k<N/2;k++)P[k]+=re[k]*re[k]+im[k]*im[k];}
    let tot=0,cen=0;const band={'<250':0,'250-1k':0,'1k-3k':0,'3k-6k':0,'>6k':0};for(let k=1;k<N/2;k++){const f=k*sr/N;tot+=P[k];cen+=f*P[k];band[f<250?'<250':f<1000?'250-1k':f<3000?'1k-3k':f<6000?'3k-6k':'>6k']+=P[k];}
    out[n]={rmsDb:+(10*Math.log10(ss/(i1-i0))).toFixed(1),peakDb:+(20*Math.log10(pk)).toFixed(1),centroidHz:Math.round(cen/tot),bands:Object.fromEntries(Object.entries(band).map(([k,v])=>[k,+(v/tot).toFixed(3)]))};}
  return out;});
console.log('LABEL',label,html);
for(const [b,S] of Object.entries(SEL))console.log('select',b,JSON.stringify(Object.fromEntries(Object.entries(S).slice(0,14))));
const keys=Object.keys(rep).sort();for(const k of keys)console.log('repeat',k.padEnd(26),JSON.stringify(rep[k]));
for(const [n,v] of Object.entries(timbre))console.log('timbre',n.padEnd(9),JSON.stringify(v));
console.log('RESULT',JSON.stringify({label,SEL,rep,timbre}));console.log('errors',errs);await b.close();
