// v28: melodic-line audit (the "ぽわぽわ" + stray-note report). Scheduler-only おまかせ sims (every pitched voice replaced by a recorder that
// keeps its pitch and the sound parameters it would have used), every band, 8 seeds x 384 bars by default.
//  lines   : motif lead (per deck), classic voices (acid / fm hit / vox / marimba / flute / pulse / bleep), chiptune lead, odd-meter pluck,
//            Bells riff, jazzy e-piano top voice. Arps (chip arp) and chords (stabs / organ / pads) are harmony, not lines.
//  pitch   : interval histogram between consecutive notes of a line (gap <= 1 bar), leaps > a 5th, > an octave, octave leaps not to a chord
//            tone or not on a phrase start, notes outside the key's natural minor (A minor in A) / the deck scale, off-chord on strong beats,
//            harsh (semitone / tritone off a chord tone), register span per line (and patch) per 16 bars
//  sound   : share of line notes with a slow attack (>= 20 ms), pitch glide (>= 1 semitone over >= 50 ms; shorter slides are reported as flick), pitch vibrato (>= 8 cents),
//            dull filter (< 650 Hz effective lowpass at the note), wide detune (spread >= 20 cents), long tail (release >= 0.25 s on a line voice),
//            soft-only timbre (sine / triangle without FM); wet sends of the upper layers (delay / reverb per style, chip / jazz / odd / bells)
// ASSERT=1 -> exit 1 when a v28 limit is broken. HTML=<file> to audit another build (e.g. the v28pre backup).
// usage: node v28_melody.mjs [seeds=8] [bars=384]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';
const here=path.dirname(fileURLToPath(import.meta.url)),html=process.env.HTML?path.resolve(process.env.HTML):path.resolve(here,'../index.html');
const NS=+(process.argv[2]||8),BARS=+(process.argv[3]||384),ASSERT=!!process.env.ASSERT;
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
async function sim(band,seed,force){await p.goto('file://'+html+'?noopening');return await p.evaluate(([band,seed,BARS,force])=>{
  if(force==='spice'){for(const k in CHIP_P)CHIP_P[k]=1;}
  S.band=band;S.style=BANDS[band].first;
  const e=new Engine(new OfflineAudioContext(2,4410,44100),seed,{opening:false});e.cond.auto=true;e.debug=false;
  const NM=[0,2,3,5,7,8,10],rec=[];let ctx=null;
  const keyRoot=d=>57+offOf(d&&d.key!=null?d.key:S.key);
  const R=(line,midi,f={})=>{const d=(ctx&&ctx.deck)||f.deck||e.low,root=keyRoot(d),pcs=e.chordPcs(d);
    rec.push({line:(line.startsWith('motif')||line.startsWith('cl:'))?line+'@'+d.id:line,patch:f.patch||'',midi:Math.round(midi),q:e.bar*16+e.step%16,bar:e.bar,s:e.step%16,
      pc:(((Math.round(midi)-root)%12)+12)%12,dpc:d.scale?d.scale.includes((((Math.round(midi)-root)%12)+12)%12):true,chord:pcs.includes((((Math.round(midi)-root)%12)+12)%12),harsh:e.harsh(Math.round(midi),root,pcs),
      att:f.att||0,glide:f.glide||0,flick:!!f.flick,vib:f.vib||0,cut:f.cut||0,det:f.det||0,rel:f.rel||0,soft:!!f.soft,dur:f.dur||0,ph:ctx&&ctx.ph,poly:!!f.poly});};
  const wrapCtx=(name,mk)=>{const o=e[name].bind(e);e[name]=(...a)=>{const px=ctx;ctx=mk(...a);try{return o(...a);}finally{ctx=px;}};};
  wrapCtx('playMotif',(st,t,s,deck,pv)=>({deck,pv,src:'motif'}));
  wrapCtx('upperClassic',(st,t,s,deck)=>({deck,src:'classic'}));
  const src=()=>ctx&&ctx.src==='motif'?'motif':'cl:';
  e.synth=(t,midi,vel,dur,P)=>{const {k}=e.upCut(),dets=P.osc.map(o=>o[1]),soft=!P.fm&&P.osc.every(o=>o[0]==='sine'||o[0]==='triangle');
    const B=P.bend||null;R(src()==='motif'?'motif':'cl:synth',midi+(P.oct||0),{patch:P.n,att:P.a.a,glide:B&&Math.abs(B.from)>=1&&B.time>=0.05?Math.abs(B.from):0,
      cut:P.f?(e.synthCut?e.synthCut(P):Math.min(12000,P.f.cut*k)):0,det:Math.max(...dets)-Math.min(...dets),rel:P.a.r,soft,dur,poly:P.chord.length>=3});};
  e.acid=(t,midi,acc,slide)=>{const {k}=e.upCut(),sl=slide&&e.lastAcidQ===e.bar*16+e.step%16-1,slT=e.acidBase?0.042:0.12;   // slide ~3 tau (v28 tau 14 ms, was ~40 ms)
    R(src()==='motif'?'motif':'cl:acid',midi,{patch:'acid',att:0.003,glide:sl&&slT>=0.05?1:0,flick:sl&&slT<0.05,cut:(e.acidBase?e.acidBase(k):Math.min(3000,260*k))*1.6,rel:0.01});e.lastAcidQ=e.bar*16+e.step%16;};
  e.fmHit=(t,midi)=>R('cl:fmhit',midi,{patch:'fmhit',att:0.002,rel:0.05});
  e.vox=(t,midi,dest,len)=>R(src()==='motif'?'motif':'cl:vox',midi,{patch:'vox',att:0.006,rel:0.02});
  e.marimba=(t,midi,vel,pan,kal)=>R(src()==='motif'?'motif':'cl:mar'+(kal?'K':''),midi,{patch:'marimba',att:0.002,rel:kal?0.35:0.22});
  e.flute=(t,midi,dur)=>{const F=typeof FLUTE!=='undefined'?FLUTE:{att:0.18,vib:5,rel:0.35};R(src()==='motif'?'motif':'cl:flute',midi,{patch:'flute',att:F.att,vib:F.vib,rel:F.rel,soft:true,dur});};
  e.pulse=(t,midi)=>{const {k}=e.upCut();R(src()==='motif'?'motif':'cl:pulse',midi,{patch:'pulse',att:0.002,cut:e.pulseCut?e.pulseCut():Math.min(7000,900*k),rel:0.015});};
  e.bleep=(t,midi)=>R(src()==='motif'?'motif':'cl:bleep',midi,{patch:'bleep',att:0.002,rel:0.045});
  e.chipNote=(t,midi,dur,vel,o={})=>{R('chip',midi,{deck:e.chip.deck,patch:'chip',att:0.003,glide:o.slide&&Math.abs(o.slide)>=1&&!e.lineNote?Math.abs(o.slide):0,flick:!!o.slide&&!!e.lineNote,   // v28 chip slide: 22 ms (was a ±2 st glide)
    vib:o.vib?(typeof o.vib==='number'?o.vib:22):0,soft:e.chip.chill,rel:0.01,dur});};
  e.chipArp=(t,ms)=>{for(const m of ms)R('chiparp',m,{deck:e.chip.deck,patch:'arp',poly:true});};
  e.oddPluck=(t,midi)=>R('odd',midi,{deck:e.odd.deck,patch:'odd',att:0.003,rel:0.1});
  e.bellFM=(t,midi)=>R('bell',midi,{deck:e.show.deck,patch:'bell',att:0.002,rel:0.2});
  e.jzEP=(t,notes)=>R('jazz',Math.max(...notes.map(x=>x.m)),{deck:e.low,patch:'ep',att:0.004,rel:0.35,poly:true});
  const H={drone:0,droneSlow:0,droneLfo:0,droneDet:0};
  e.drone=(t,dur,o)=>{H.drone++;if(o.att>=1)H.droneSlow++;if(o.depth>=200)H.droneLfo++;if(o.det>=12)H.droneDet++;};
  for(const k of ['stab','hardStab','organ','noiseWash','revCym','riserFx'])if(e[k])e[k]=()=>{};
  for(const k of ['hat','metalHat','ride','clap','clapK','snare','tom','pz','spSnare','spTom','kick','bass','chipNoise','kitHatHit','jzRide'])if(e[k])e[k]=()=>{};
  // wet: per 16th, the upper-layer send levels in use for the playing style
  const W={n:0,dly:0,verb:0};let t=0.01;
  for(let st=0;st<BARS*16;st++){if(st%16===0&&e.cond.set){const cur=e.cond.set.list[e.cond.set.idx];e.__ph=cur?cur.phase:'';}
    e.scheduleStep(t);t+=e.s16;
    if(st%4===0){const s0=e.upSend[e.low.style];W.n++;W.dly+=s0.ds.gain.value*e.send.gain.value;W.verb+=s0.vs.gain.value;}}
  return {rec,H,W:{dly:W.dly/W.n,verb:W.verb/W.n},band};},[band,seed,BARS,force]);}
// ---- metrics
const LEAP_B=[['0',0,0],['1-2',1,2],['3-4',3,4],['5',5,5],['6-7',6,7],['8-11',8,11],['12',12,12],['>12',13,99]];
function metrics(rec){const lines={};for(const n of rec)(lines[n.line]||(lines[n.line]=[])).push(n);
  const M={notes:0,lineNotes:0,ints:0,hist:Object.fromEntries(LEAP_B.map(x=>[x[0],0])),gt5:0,gt8:0,octBad:0,gtOct:0,offNM:0,offDeck:0,offChordStrong:0,strong:0,harsh:0,
    flick:0,slowAtt:0,glide:0,vib:0,dull:0,wideDet:0,longRel:0,soft:0,mushy:0,span:[],vp:[],figs:0,ufigs:0,byLine:{},worst:[]};
  for(const [ln,N] of Object.entries(lines)){N.sort((a,b)=>a.q-b.q);const arp=ln.endsWith(':chiparp'),jz=ln.endsWith(':jazz');   // jazz top voice: its own 7th/9th voicings, so chord metrics skip it (leaps still count)
    const bk=ln.replace(/^\d+:/,'').replace(/@\d+$/,''),BL=M.byLine[bk]||(M.byLine[bk]={n:0,ints:0,gt5:0,gt8:0,mushy:0});
    for(let i=0;i<N.length;i++){const n=N[i];M.notes++;if(!n.dpc)M.offDeck++;if(!(([0,2,3,5,7,8,10]).includes(n.pc)))M.offNM++;if(n.harsh&&!jz)M.harsh++;
      if(n.s%4===0&&!arp&&!jz){M.strong++;if(!n.chord)M.offChordStrong++;}
      if(arp)continue;M.lineNotes++;BL.n++;
      if(n.flick)M.flick++;const fl={slowAtt:n.att>=0.02,glide:n.glide>=1,vib:n.vib>=8,dull:n.cut>0&&n.cut<650,wideDet:n.det>=20,longRel:n.rel>=0.25&&!n.poly,soft:n.soft};
      for(const k in fl)if(fl[k])M[k]++;const mu=fl.slowAtt||fl.glide||fl.vib||fl.dull||fl.wideDet;if(mu){M.mushy++;BL.mushy++;}
      if(i>0){const pv=N[i-1];if(n.q===pv.q)continue;if(n.q-pv.q>16)continue;if(n.patch!==pv.patch)continue;
        const d=Math.abs(n.midi-pv.midi);M.ints++;BL.ints++;for(const [k,a,z] of LEAP_B)if(d>=a&&d<=z)M.hist[k]++;
        if(d>7){M.gt5++;BL.gt5++;}if(d>8){M.gt8++;BL.gt8++;}if(d>12)M.gtOct++;
        if(d>=8&&(!n.chord||(n.s!==0&&n.q-pv.q<8))){M.octBad++;if(M.worst.length<12)M.worst.push([ln,n.patch,pv.midi,n.midi,n.bar,n.s]);}}}
    // register span per 16 bars
    const B={};for(const n of N){if(arp)continue;const k=Math.floor(n.bar/16)+'|'+n.patch;(B[k]||(B[k]=[])).push(n.midi);}
    for(const k in B){const a=B[k];if(a.length>=4){M.span.push(Math.max(...a)-Math.min(...a));M.vp.push(new Set(a).size);}}
    // variety (reported, not a limit): distinct pitches per 16 bars, share of distinct 1-bar pitch/rhythm figures
    if(!arp){const F={};for(const n of N)(F[n.bar]||(F[n.bar]=[])).push(n.s+':'+n.midi);const fs=Object.values(F).map(x=>x.join(','));M.figs+=fs.length;M.ufigs+=new Set(fs).size;}}
  const r=(x,y)=>y?+(x/y).toFixed(4):0;M.span.sort((a,b)=>a-b);
  return {notes:M.notes,lineNotes:M.lineNotes,ints:M.ints,hist:Object.fromEntries(Object.entries(M.hist).map(([k,v])=>[k,r(v,M.ints)])),
    leapGt5:r(M.gt5,M.ints),leapGt6th:r(M.gt8,M.ints),leapGtOct:r(M.gtOct,M.ints),badBigLeap:r(M.octBad,M.ints),offNatMinor:r(M.offNM,M.notes),offDeckScale:r(M.offDeck,M.notes),
    offChordStrong:r(M.offChordStrong,M.strong),harsh:r(M.harsh,M.notes),
    mushy:r(M.mushy,M.lineNotes),flick:r(M.flick,M.lineNotes),slowAtt:r(M.slowAtt,M.lineNotes),glide:r(M.glide,M.lineNotes),vib:r(M.vib,M.lineNotes),dull:r(M.dull,M.lineNotes),wideDet:r(M.wideDet,M.lineNotes),longRel:r(M.longRel,M.lineNotes),soft:r(M.soft,M.lineNotes),
    spanP50:M.span[Math.floor(M.span.length*0.5)]||0,pitchesPer16:+(M.vp.reduce((a,b)=>a+b,0)/Math.max(1,M.vp.length)).toFixed(2),uniqueBarFigures:r(M.ufigs,M.figs),spanP90:M.span[Math.floor(M.span.length*0.9)]||0,spanMax:M.span[M.span.length-1]||0,
    byLine:Object.fromEntries(Object.entries(M.byLine).map(([k,v])=>[k,{n:v.n,gt5:r(v.gt5,v.ints),gt6th:r(v.gt8,v.ints),mushy:r(v.mushy,v.n)}])),worst:M.worst};}
const OUT={};   // each seed's lines are kept apart (prefix i:)
for(const band of ['b120','b140','bchill'])for(const force of ['', 'spice']){const all=[];let H={drone:0,droneSlow:0,droneLfo:0,droneDet:0},W={dly:0,verb:0};
  const ns=force?Math.max(2,NS>>2):NS;
  for(let i=0;i<ns;i++){const r=await sim(band,9100+i*37,force);for(const n of r.rec)n.line=i+':'+n.line;all.push(...r.rec);for(const k in H)H[k]+=r.H[k];W.dly+=r.W.dly/ns;W.verb+=r.W.verb/ns;}
  const m=metrics(all);m.drone=H;m.wet={dly:+W.dly.toFixed(3),verb:+W.verb.toFixed(3)};OUT[band+(force?'+'+force:'')]=m;
  console.log('RUN',band+(force?'+'+force:''),JSON.stringify(m));}
// ---- v28 limits
const fails=[];
for(const [k,m] of Object.entries(OUT)){
  const chk=(c,msg)=>{if(!c)fails.push(k+': '+msg);};
  chk(m.leapGt5<=0.03,'leaps > a 5th '+m.leapGt5);chk(m.leapGtOct===0,'leaps > an octave '+m.leapGtOct);chk(m.badBigLeap===0,'big leap not to a chord tone on a phrase start '+m.badBigLeap);
  chk(m.offDeckScale===0,'off the deck scale '+m.offDeckScale);   // dorian / phrygian decks are intended, so off-natural-minor is reported onlychk(m.offChordStrong<=0.08,'off-chord strong-beat notes '+m.offChordStrong);chk(m.harsh<=0.03,'harsh '+m.harsh);
  chk(m.glide<=0.01,'glides '+m.glide);chk(m.vib===0,'pitch vibrato '+m.vib);chk(m.slowAtt<=0.02,'slow attacks '+m.slowAtt);chk(m.dull<=0.03,'dull filter '+m.dull);
  chk(m.wideDet<=0.03,'wide detune '+m.wideDet);chk(m.mushy<=0.06,'mushy share '+m.mushy);chk(m.spanP90<=17,'register span p90 '+m.spanP90);}
console.log('SUMMARY',JSON.stringify(Object.fromEntries(Object.entries(OUT).map(([k,m])=>[k,{lineNotes:m.lineNotes,offDeckScale:m.offDeckScale,leapGt5:m.leapGt5,leapGtOct:m.leapGtOct,badBigLeap:m.badBigLeap,offNatMinor:m.offNatMinor,offChordStrong:m.offChordStrong,harsh:m.harsh,mushy:m.mushy,glide:m.glide,flick:m.flick,vib:m.vib,slowAtt:m.slowAtt,dull:m.dull,wideDet:m.wideDet,spanP90:m.spanP90,pitchesPer16:m.pitchesPer16,uniqueBarFigures:m.uniqueBarFigures,wet:m.wet}]))));
console.log('ERRORS',JSON.stringify(errs.slice(0,5)));
if(fails.length)console.log('LIMITS',JSON.stringify(fails));else console.log('all ok');
await b.close();if(ASSERT&&(fails.length||errs.length))process.exit(1);
