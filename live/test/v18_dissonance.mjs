// v18: dissonance + upper-layer clutter over long おまかせ runs (scheduler-only sim, every pitched voice replaced by a recorder).
// Recorded note-ons: [t, dur, midi, part, deck]; parts: bass / pad (drone, chill pad, layer-2 pads) / up (motif lead & patches) / stab (stab, hard stab, organ)
//   / l2 (layer-2 arps etc.) / chip. Each 16th slice: the notes sounding at its midpoint.
// clashes (per bar):
//   m2   : minor 2nd / minor 9th between two different layers (part@deck), counted once per layer pair per slice
//   tri  : a layer a tritone from the sounding bass note (once per layer per slice)
//   okey : during mixes, note-ons outside the other deck's key/scale
// v20: 'jazz' = jazzy e-piano voicing. m2a / ncta / totala = the same counts with its intended 9th / 11th / 6th extensions treated as chord tones
//   (raw m2 / nct / total keep counting them).
//   nct  : lead/chip note-ons on a strong 16th (step%4==0) held > 1.2 16ths that are not tones of the audible chord (low deck)
// splits: normal / mix (2 decks) / key-change window (-4..+8 bars round a key change), chip on/off, low-deck mode.
// clutter: melodic upper layers (up / stab / l2 / chip, per deck) sounding at once (mean, share of slices ≥3), upper-register (midi ≥ 60) note-ons per bar.
// usage: node v18_dissonance.mjs [label] [html] [bars=384] [seeds=4]
import { chromium } from 'playwright-core';
const label=process.argv[2]||'',html=process.argv[3]||'/workspace/techno/live/index.html',BARS=+(process.argv[4]||384),NS=+(process.argv[5]||4);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
async function sim(band,seed){await p.goto('file://'+html);return await p.evaluate(([band,seed,BARS])=>{
  S.band=band;S.style=BANDS[band].first;
  const oc=new OfflineAudioContext(2,44100,44100),e=new Engine(oc,seed);e.cond.auto=true;
  const rec=[];let cur=null,ctx=null;const AEO=[0,2,3,5,7,8,10];
  const R=(t,dur,ms,part,d)=>{d=d||cur||e.low;for(const m of ms)rec.push([t,dur,Math.round(m),part,d.id]);};
  const wrap=(name,c,deckOf)=>{const o=e[name];if(!o)return;e[name]=function(...a){const pc=cur,px=ctx;cur=deckOf(a)||cur;ctx=c;try{return o.apply(e,a);}finally{cur=pc;ctx=px;}};};
  wrap('upperStep','up',a=>a[3]);wrap('upperLayer2','l2',a=>a[0]);wrap('chillPad','pad',()=>e.low);wrap('chipStep','chip',()=>e.chip&&e.chip.deck||e.low);
  const ko=()=>typeof keyOff==='function'?keyOff():0,s16=()=>e.s16;
  const upPart=()=>ctx==='l2'?'l2':ctx==='pad'?'pad':ctx==='chip'?'chip':'up';
  e.synth=(t,midi,vel,dur,P)=>R(t,Math.max(P.a.a+0.01,dur)+0.3*P.a.r,(P.chord||[0]).map(iv=>midi+iv+(P.oct||0)),ctx==='l2'&&P.a.a>0.3?'pad':upPart());
  e.stab=(t,dest,root=57+ko(),ivs=[0,3,7,10])=>R(t,0.1,ivs.map(i=>root+i),'stab');
  e.hardStab=(t,root,b2)=>R(t,0.25,(b2?[0,1,7]:[0,7,12]).map(i=>root-12+i),'stab');
  e.organ=(t,root,vel,ivs=[0,3,7,10])=>R(t,0.12,ivs.map(i=>root+i),'stab');
  e.acid=(t,midi)=>R(t,s16()*0.92,[midi],upPart());e.fmHit=(t,midi)=>R(t,0.15,[midi],upPart());
  e.vox=(t,midi,dest,len=0.13)=>R(t,len,[midi],upPart());e.marimba=(t,midi)=>R(t,0.25,[midi],upPart());
  e.flute=(t,midi,dur)=>R(t,dur||0.3,[midi],upPart());e.pulse=(t,midi)=>R(t,s16()*0.6,[midi],upPart());e.bleep=(t,midi)=>R(t,0.1,[midi],upPart());
  e.drone=(t,dur,o)=>R(t,dur,[o.midi],'pad');
  e.jzEP=(t,ns,dur)=>{for(const x of ns)rec.push([t,dur+0.1,Math.round(x.m),'jazz',e.low.id,x.ext||0]);};
  if(e.chipNote){e.chipNote=(t,midi,dur)=>R(t,dur,[midi],'chip');e.chipArp=(t,ms,dur)=>R(t,dur,ms,'chip');e.chipNoise=()=>{};}
  e.bass=function(t,note,lm=1,lift=false){let m;if(e.bassMidi)m=e.bassMidi(note,lift);else{const r0=33+ko();m=r0+MINOR_PENT[note.deg]+12*note.oct;if(lift&&m<r0)m+=12;}R(t,s16()*0.85*lm,[m],'bass',e.low);};
  // per-step state
  const ST=[];let t=0.01;
  const scaleOf=d=>{const k=d.key!=null?d.key:(S.key!=null?S.key:9);return new Set((d.scale||AEO).map(x=>(k+x)%12));};
  for(let st=0;st<BARS*16;st++){const bar=st>>4,L=e.low;const key=S.key!=null?S.key:9;
    let chord;if(e.chordOf&&e.chordTones&&L.harm){const c=e.chordOf(L,bar);chord=e.chordTones(L,c.semi,4).map(x=>((key+x)%12+12)%12);}else chord=[0,3,7,10].map(x=>(key+x)%12);const ch7=new Set(chord);chord=chord.slice(0,3);
    ST.push({T:t,bar,s:st&15,mix:e.decks.length>1,key,chip:!!(e.chip&&e.chip.on),jazz:!!(e.jazz&&e.jazz.on),ch7,mode:L.mode||'aeolian',chord:new Set(chord),decks:e.decks.map(d=>({id:d.id,sc:scaleOf(d)}))});
    e.scheduleStep(t);t+=e.s16;}
  // key-change window
  const kc=[];for(let i=16;i<ST.length;i+=16)if(ST[i].key!==ST[i-16].key)kc.push(ST[i].bar);
  const inKW=bar=>kc.some(k=>bar>=k-4&&bar<=k+8);
  // sweep
  rec.sort((a,b)=>a[0]-b[0]);let ri=0;let act=[];
  const MEL=new Set(['up','stab','l2','chip','jazz']);
  const cats={};const cat=n=>cats[n]||(cats[n]={slices:0,m2a:0,ncta:0,m2:0,tri:0,okey:0,nct:0,mel:0,ge3:0,upN:0,bars:0,barLay:0,bar3:0,barLead2:0});
  let barSet=new Set();
  const pairs={};
  for(let i=0;i<ST.length;i++){const S0=ST[i],T1=i+1<ST.length?ST[i+1].T:S0.T+e.s16,mid=(S0.T+T1)/2,sl=T1-S0.T;
    const ons=[];while(ri<rec.length&&rec[ri][0]<T1-1e-6){if(rec[ri][0]<S0.T-1e-6&&rec[ri][0]+rec[ri][1]<S0.T){ri++;continue;}act.push(rec[ri]);ons.push(rec[ri]);ri++;}
    act=act.filter(n=>n[0]+n[1]>mid||ons.includes(n));
    const snd=act.filter(n=>n[0]<=mid+1e-6&&n[0]+n[1]>mid);
    const layers={},extp={};for(const n of snd){const k=n[3]+'@'+n[4],pc=((n[2]%12)+12)%12;(layers[k]||(layers[k]=new Set())).add(pc);if(n[5])(extp[k]||(extp[k]=new Set())).add(pc);}
    const keys=Object.keys(layers);let m2=0,tri=0,m2a=0;
    for(let a=0;a<keys.length;a++)for(let c=a+1;c<keys.length;c++){const A=layers[keys[a]],B=layers[keys[c]];let hit=false;
      let hitA=false;const EA=extp[keys[a]],EB=extp[keys[c]];
      for(const x of A){for(const y of B){const d=(x-y+12)%12;if(d===1||d===11){hit=true;if(!(EA&&EA.has(x))&&!(EB&&EB.has(y)))hitA=true;}}}if(hitA)m2a++;
      if(hit){m2++;const pa=keys[a].split('@'),pb=keys[c].split('@');const nm=[pa[0],pb[0]].sort().join('-')+(pa[1]!==pb[1]?' (x)':'');pairs[nm]=(pairs[nm]||0)+1;}}
    const bassL=keys.filter(k=>k.startsWith('bass@'));
    if(bassL.length){const bp=[...layers[bassL[0]]][0];for(const k of keys){if(k.startsWith('bass@'))continue;for(const x of layers[k])if((x-bp+12)%12===6){tri++;pairs['tritone-bass:'+k.split('@')[0]]=(pairs['tritone-bass:'+k.split('@')[0]]||0)+1;break;}}}
    let okey=0,nct=0,ncta=0;
    if(S0.mix)for(const n of ons){if(n[3]==='bass')continue;const o=S0.decks.find(d=>d.id!==n[4]);if(o&&!o.sc.has(((n[2]%12)+12)%12))okey++;}
    if(S0.s%4===0)for(const n of ons)if((n[3]==='up'||n[3]==='chip')&&n[1]>1.2*sl&&!S0.chord.has(((n[2]%12)+12)%12)){nct++;ncta++;}
    for(const n of ons)if(n[3]==='jazz'&&!S0.ch7.has(((n[2]%12)+12)%12)){nct++;if(!n[5])ncta++;}   // e-piano: chord = triad + 7th; extensions only allowed in the adjusted count
    const mel=keys.filter(k=>MEL.has(k.split('@')[0])).length;
    const upN=ons.filter(n=>MEL.has(n[3])&&n[2]>=60).length;
    for(const k of keys)if(MEL.has(k.split('@')[0]))barSet.add(k);
    const cn=['all',S0.mix?'mix':(inKW(S0.bar)?'keychg':'normal'),S0.chip?'chipOn':'chipOff','mode:'+S0.mode,S0.jazz?'jazzOn':'jazzOff'];
    for(const c of cn){const C=cat(c);C.slices++;C.m2+=m2;C.m2a+=m2a;C.ncta+=ncta;C.tri+=tri;C.okey+=okey;C.nct+=nct;C.mel+=mel;C.ge3+=mel>=3?1:0;C.upN+=upN;if(S0.s===15){C.bars++;C.barLay+=barSet.size;C.bar3+=barSet.size>=3?1:0;}}
    if(S0.s===15)barSet=new Set();}
  const out={};for(const [k,C] of Object.entries(cats)){const bars=C.slices/16;out[k]={bars:+bars.toFixed(0),m2:+(C.m2/bars).toFixed(2),tri:+(C.tri/bars).toFixed(2),okey:+(C.okey/bars).toFixed(2),nct:+(C.nct/bars).toFixed(2),
    total:+((C.m2+C.tri+C.okey+C.nct)/bars).toFixed(2),m2a:+(C.m2a/bars).toFixed(2),ncta:+(C.ncta/bars).toFixed(2),totala:+((C.m2a+C.tri+C.okey+C.ncta)/bars).toFixed(2),melLayers:+(C.mel/C.slices).toFixed(2),ge3:+(C.ge3/C.slices).toFixed(3),upNotesPerBar:+(C.upN/bars).toFixed(1),barLayers:+(C.barLay/Math.max(1,C.bars)).toFixed(2),bars3plus:+(C.bar3/Math.max(1,C.bars)).toFixed(3)};}
  return {band,seed,keyChanges:kc.length,cats:out,pairs};},[band,seed,BARS]);}
const agg={};const pairAgg={};
for(const band of ['b120','b140','bchill']){for(let i=0;i<NS;i++){const seed=1000+i*7919+(band==='b140'?3:band==='bchill'?5:0);const r=await sim(band,seed);
  for(const [k,v] of Object.entries(r.cats)){const A=(agg[band]||(agg[band]={}))[k]||(agg[band][k]={n:0});A.n+=v.bars;for(const f of ['m2','tri','okey','nct','total','m2a','ncta','totala','melLayers','ge3','upNotesPerBar','barLayers','bars3plus'])A[f]=(A[f]||0)+v[f]*v.bars;}
  for(const [k,v] of Object.entries(r.pairs))pairAgg[k]=(pairAgg[k]||0)+v;}
  process.stderr.write(band+' done\n');}
const res={};for(const [band,C] of Object.entries(agg)){res[band]={};for(const [k,A] of Object.entries(C)){const o={bars:A.n};for(const f of ['m2','tri','okey','nct','total','m2a','ncta','totala','melLayers','ge3','upNotesPerBar','barLayers','bars3plus'])o[f]=+(A[f]/A.n).toFixed(f==='ge3'||f==='bars3plus'?3:2);res[band][k]=o;}}
const totBars=Object.values(agg).reduce((s,C)=>s+C.all.n,0);
const topPairs=Object.entries(pairAgg).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>[k,+(v/totBars).toFixed(3)]);
console.log('LABEL',label,html);
for(const [band,C] of Object.entries(res)){console.log('==',band);for(const k of ['all','normal','mix','keychg','chipOn','chipOff','mode:aeolian','mode:dorian','mode:phrygian','jazzOn','jazzOff'])if(C[k])console.log(' ',k.padEnd(14),JSON.stringify(C[k]));}
console.log('top pairs per bar (all bands)',JSON.stringify(topPairs));
console.log('RESULT',JSON.stringify({label,res,topPairs}));console.log('errors',errs);await b.close();
