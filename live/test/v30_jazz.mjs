// v30: jazzy-segment variety. (A) long おまかせ sims (scheduler only): per segment the progression family, comping rhythm,
// timbre, voicing style, inflections; diversity across segments, no family + rhythm + timbre combo repeated within the last
// 3 segments, per-4-bar variation inside 16-bar segments; consonance (in key, no b9 / tritone / maj7 over the chord root, no
// semitone clusters, bass on the jazzy chord's root / fifth on beat 1), line rules (comp top voice, motif line), no clutter
// (comp and motif never overlap, no lead / chip under the jazz), EN log texts. (B) voice levels (same hit pattern per timbre).
// (C) offline renders with forced segments per timbre: peak / NaN.   usage: node v30_jazz.mjs [seeds=10] [bars=900]
import { chromium } from 'playwright-core';
const NS=+(process.argv[2]||10),BARS=+(process.argv[3]||900),html=process.env.HTML||'/workspace/techno/live/index.html';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const SC={aeolian:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],minpent:[0,3,5,7,10]};
const segs=[];
for(const band of ['b120','b140','bchill'])for(let i=0;i<NS;i++){await p.goto('file://'+html);
  const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),7300+i*41,{opening:false});e.cond.auto=true;e.debug=true;
    for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep','drone','kick','hat','clap','jzRide','chipNote','chipArp','chipNoise'])if(e[k])e[k]=()=>{};
    const segs=[];let cur=null,st=0,upDuringJazz=0,pend=[];const PAT=()=>e.chordOf(e.low).semi;
    const lg=e.cond.logItem.bind(e.cond);e.cond.logItem=(x,...a)=>{if(/^ジャジー/.test(x))pend.push([x,enTx(x)]);return lg(x,...a);};
    e.jzEP=(t,ns,dur)=>{if(cur)cur.hits.push({q:st,d:dur/e.s16,ns:ns.map(x=>x.m),semi:PAT(),key:e.low.key,mode:e.low.mode,bar:e.bar,tim:e.jazz.tim});};
    const mv=(t,m,dur)=>{if(cur)cur.mot.push({q:st,d:dur/e.s16,m,semi:PAT(),key:e.low.key,mode:e.low.mode,pcs:e.chordPcs(e.low)});};e.jzVibe=mv;e.jzTpt=mv;
    e.bass=(t,n,lm,lift)=>{if(cur&&e.jazz.on)cur.bass.push({q:st,m:e.bassMidi(n,lift),semi:PAT(),tn:e.chordTones(e.low,PAT(),3),key:e.low.key,mode:e.low.mode});};
    const us=e.upperStep.bind(e);e.upperStep=(...a)=>{if(e.jazz.on)upDuringJazz++;return us(...a);};
    let t=0.01;for(st=0;st<BARS*16;st++){const was=e.jazz.on;
      if(st%16===0&&e.jazz.on&&cur&&e.chip.on)cur.chip++;
      e.scheduleStep(t);t+=e.s16;
      if(e.jazz.on&&!was){const J=e.jazz;cur={band,seed:i,start:e.bar,len:J.end-J.start,fam:J.fam,rh:J.rh,tim:J.tim,vs:J.vs,motK:J.mot,walk:J.walk,cyc:J.prog.join(','),hits:[],mot:[],bass:[],logs:pend.splice(0),chip:0,status:null};segs.push(cur);}
      if(cur&&e.jazz.on&&st%16===8&&!cur.status){cur.status=[e.jazzDesc(false)];}
      if(cur&&!e.jazz.on){cur.end=e.bar;cur=null;}}
    return {segs,upDuringJazz};},[band,i,BARS]);
  r.segs.forEach(x=>x.upDuringJazz=0);if(r.segs.length)r.segs[0].upDuringJazz=r.upDuringJazz;segs.push(...r.segs);}
const pc=x=>((x%12)+12)%12,cnt=a=>a.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{}),U=a=>new Set(a).size;
const F={offKey:0,notes:0,rootClash:0,cluster:0,bassBeat1:0,bassOff:0,bassN:0,topInts:0,topGt5:0,topGtOct:0,motNotes:0,motOffKey:0,motLeapGt5:0,motEndNotCT:0,motPhr:0,
  overlap:0,maxJazzVoices:0,comboRepeat3:0,famRepeat1:0,rhRepeat1:0,pairs:0,sameAll1:0,flat16:0,n16:0,logLeftJA:0,chip:0,up:0};
const JA=/[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
segs.forEach((g,k)=>{F.up+=g.upDuringJazz;F.chip+=g.chip;
  for(const [ja,en] of g.logs)if(JA.test(en)){F.logLeftJA++;console.log('LEFTJA',ja,'=>',en);}
  // consonance of every comp hit
  let prevTop=null,prevQ=-99;
  for(const h of g.hits){const sc=SC[h.mode],rootPc=h.semi;F.notes+=h.ns.length;
    for(const m of h.ns){if(!sc.includes(pc(m-h.key)))F.offKey++;const iv=pc(m-h.key-rootPc);if(iv===1||iv===11)F.rootClash++;}
    const s=h.ns.slice().sort((a,b)=>a-b);for(let j=1;j<s.length;j++)if(s[j]-s[j-1]===1)F.cluster++;
    const top=s[s.length-1];if(prevTop!=null&&h.q-prevQ<=16){F.topInts++;const d=Math.abs(top-prevTop);if(d>7)F.topGt5++;if(d>12)F.topGtOct++;}prevTop=top;prevQ=h.q;}
  // bass
  for(const x of g.bass){F.bassN++;if(!SC[x.mode].includes(pc(x.m-x.key)))F.bassOff++;if(x.q%16===0){const ok=[x.tn[0],x.tn[2]].map(pc);if(!ok.includes(pc(x.m-x.key)))F.bassBeat1++;}}
  // motif line
  let pm=null,pq=-99;for(const [j,x] of g.mot.entries()){F.motNotes++;if(!SC[x.mode].includes(pc(x.m-x.key)))F.motOffKey++;if(pm!=null&&x.q-pq<=16&&Math.abs(x.m-pm)>7)F.motLeapGt5++;
    const last=j===g.mot.length-1||g.mot[j+1].q-x.q>8;if(last){F.motPhr++;if(!x.pcs.includes(pc(x.m-x.key)))F.motEndNotCT++;}pm=x.m;pq=x.q;}
  // clutter: comp sounding intervals vs motif sounding intervals (in 16ths); max simultaneous jazz upper voices
  const iv=[...g.hits.map(h=>[h.q,h.q+h.d,'c']),...g.mot.map(x=>[x.q,x.q+x.d,'m'])];
  for(const a of g.mot)for(const h of g.hits)if(h.q<a.q+a.d&&a.q<h.q+h.d)F.overlap++;
  for(const a of iv){const n=new Set(iv.filter(x=>x[0]<=a[0]&&a[0]<x[1]).map(x=>x[2])).size;F.maxJazzVoices=Math.max(F.maxJazzVoices,n);}
  // 16-bar segments: the comp rhythm varies between 4-bar blocks
  if(g.len>=16&&g.end-g.start>=16&&g.rh!=='free'){F.n16++;const bl=[0,1,2,3].map(B=>g.hits.filter(h=>h.bar>=g.start+4*B&&h.bar<g.start+4*B+4).map(h=>(h.bar-g.start)%4+':'+(h.q%16)).join(' '));if(U(bl)<2)F.flat16++;}
  // anti-repetition within the same run
  const prev=segs.slice(Math.max(0,k-3),k).filter(x=>x.band===g.band&&x.seed===g.seed);
  if(prev.some(x=>x.fam===g.fam&&x.rh===g.rh&&x.tim===g.tim))F.comboRepeat3++;
  const p1=prev[prev.length-1];if(p1){F.pairs++;if(p1.fam===g.fam)F.famRepeat1++;if(p1.rh===g.rh)F.rhRepeat1++;if(p1.fam===g.fam&&p1.rh===g.rh&&p1.tim===g.tim&&p1.vs===g.vs)F.sameAll1++;}});
const D={segments:segs.length,perBand:cnt(segs.map(x=>x.band)),families:cnt(segs.map(x=>x.fam)),rhythms:cnt(segs.map(x=>x.rh)),timbres:cnt(segs.map(x=>x.tim)),voicings:cnt(segs.map(x=>x.vs)),
  motifs:cnt(segs.map(x=>x.motK||'-')),walk:cnt(segs.map(x=>x.walk||'-')),distinctCombos:U(segs.map(x=>[x.fam,x.rh,x.tim].join('/'))),distinctFull:U(segs.map(x=>[x.fam,x.cyc,x.rh,x.tim,x.vs].join('/'))),
  distinctProgCycles:U(segs.map(x=>x.cyc)),voicingShapes:U(segs.flatMap(g=>g.hits.map(h=>h.ns.map(m=>m-h.ns[0]).join(',')))),
  shapesPerSeg:+(segs.reduce((a,g)=>a+U(g.hits.map(h=>h.ns.map(m=>m-h.ns[0]).join(','))),0)/Math.max(1,segs.length)).toFixed(2),
  chordsPerSeg:+(segs.reduce((a,g)=>a+U(g.hits.map(h=>h.semi)),0)/Math.max(1,segs.length)).toFixed(2),hitsPerBar:+(segs.reduce((a,g)=>a+g.hits.length,0)/Math.max(1,segs.reduce((a,g)=>a+((g.end??(g.start+g.len))-g.start),0))).toFixed(2)};
console.log('DIVERSITY',JSON.stringify(D));console.log('CHECKS',JSON.stringify(F));
console.log('sample logs',JSON.stringify(segs.slice(0,4).map(g=>g.logs[0])));
// (B) voice levels: one 4-note Am9 chord, 3 hits of 0.6 s; RMS per timbre (dB re Rhodes)
await p.goto('file://'+html);
const LV=await p.evaluate(async()=>{const out={};
  for(const k of ['jzRhodes','jzBrass','jzOrgan']){const oc=new OfflineAudioContext(1,44100*3,44100),fake={ctx:oc,jzIn:oc.destination,free(){}};
    for(const t0 of [0.05,0.85,1.65])Engine.prototype[k].call(fake,t0,[60,64,67,71].map(m=>({m,ext:0})),0.6,0.85);
    const d=(await oc.startRendering()).getChannelData(0);let s=0,pk=0;for(const v of d){s+=v*v;pk=Math.max(pk,Math.abs(v));}out[k]={rms:10*Math.log10(s/d.length),pk:20*Math.log10(pk)};}
  for(const k of ['jzVibe','jzTpt']){const oc=new OfflineAudioContext(1,44100*2,44100),fake={ctx:oc,jzIn:oc.destination,free(){}};
    for(const [t0,m] of [[0.05,72],[0.4,74],[0.75,76],[1.1,72]])Engine.prototype[k].call(fake,t0,m,0.3,0.85);
    const d=(await oc.startRendering()).getChannelData(0);let s=0,pk=0;for(const v of d){s+=v*v;pk=Math.max(pk,Math.abs(v));}out[k]={rms:10*Math.log10(s/d.length),pk:20*Math.log10(pk)};}
  const r0=out.jzRhodes.rms;for(const k in out){out[k].rel=+(out[k].rms-r0).toFixed(1);out[k].rms=+out[k].rms.toFixed(1);out[k].pk=+out[k].pk.toFixed(1);}return out;});
console.log('LEVELS',JSON.stringify(LV));
// (C) renders: forced 16-bar segment per timbre (+ a motif)
const R={};
for(const [tim,rh,mot] of [['ep','swell','vibe'],['brass','off',null],['organ','swell',null],['ep','charl','tpt'],['brass','s332','vibe']])for(const band of ['b120','bchill']){await p.goto('file://'+html);
  R[band+'_'+tim+'_'+rh]=await p.evaluate(async ([band,tim,rh,mot])=>{let E;const r=await window.__renderOffline({band,bars:28,seed:4242,auto:true,setup:e=>{E=e;e.jazzForceBar=8;e.jazzForceLen=16;
      const pk=e.jazzPick.bind(e);e.jazzPick=d=>{const P=pk(d);P.tim=tim;P.rh=rh;return P;};
      const on=e.jazzOn.bind(e);e.jazzOn=(t,l)=>{on(t,l);e.jazz.mot=mot;e.jazz.motBars=mot?[7]:[];};}});
    return {peakDb:r.peakDb,nan:r.nan,segs:E.jazzSegs.map(x=>x.slice(0,2).concat(x.slice(6)))};},[band,tim,rh,mot]);
  console.log('render',band,tim,rh,mot,JSON.stringify(R[band+'_'+tim+'_'+rh]));}
// assertions
const fail=[];const chk=(c,m)=>{if(!c)fail.push(m);};
chk(D.segments>=60,'too few segments '+D.segments);chk(Object.keys(D.families).length>=6,'families');chk(Object.keys(D.rhythms).length>=6,'rhythms');
chk(Object.keys(D.timbres).length>=2&&!D.timbres.organ,'timbres (v31: Rhodes + brass, the muted organ is retired)');chk(Object.keys(D.voicings).length>=4,'voicing styles');chk(D.distinctCombos>=Math.min(40,0.6*D.segments),'combos '+D.distinctCombos);
chk(F.comboRepeat3===0,'combo repeated within 3 segments '+F.comboRepeat3);chk(F.sameAll1===0,'identical consecutive segment '+F.sameAll1);
chk(F.famRepeat1/Math.max(1,F.pairs)<=0.2,'family repeats '+F.famRepeat1+'/'+F.pairs);chk(F.flat16===0,'16-bar segments without block variation '+F.flat16+'/'+F.n16);
chk(F.offKey===0&&F.motOffKey===0&&F.bassOff===0,'out of key');chk(F.rootClash===0,'b9 / maj7 over the chord root '+F.rootClash);chk(F.cluster===0,'semitone cluster '+F.cluster);
chk(F.bassBeat1===0,'bass beat 1 not root / fifth '+F.bassBeat1);chk(F.topGtOct===0&&F.topGt5/Math.max(1,F.topInts)<=0.03,'comp top leaps '+F.topGt5+'/'+F.topInts);
chk(F.motLeapGt5===0,'motif leaps > 5th '+F.motLeapGt5);chk(F.motEndNotCT===0,'motif end not a chord tone '+F.motEndNotCT);
chk(F.overlap===0&&F.maxJazzVoices<=1,'comp / motif overlap '+F.overlap+' max '+F.maxJazzVoices);chk(F.up===0&&F.chip===0,'lead / chip under the jazz');chk(F.logLeftJA===0,'EN log left JA');
chk(Math.abs(LV.jzBrass.rel)<=3&&Math.abs(LV.jzOrgan.rel)<=3.5,'timbre levels');chk(LV.jzVibe.rel<=0&&LV.jzTpt.rel<=0,'motif louder than the comp');
for(const k in R)chk(R[k].nan===0&&R[k].peakDb<=-0.3&&R[k].segs.length===1,'render '+k);
chk(errs.length===0,'page errors');
console.log(fail.length?'FAIL '+JSON.stringify(fail):'PASS');console.log('errors',errs);await b.close();
