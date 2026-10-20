// v23: contrast (メリハリ). Long おまかせ sims (scheduler only, every voice replaced by a recorder), per bar after the opening:
//  drum ornaments (low deck): ghost hats, 32nd roll doubles, hat-fill hits, clap flams, pre-claps, extra claps, delay tails,
//    break-fill snares; perc hits + perc layers (distinct perc voices in the bar)
//  tonal: lead notes (upper patches), stab hits, chip notes, jazzy e-piano hits, pad / layer-2 (re)triggers
//  density = every non-kick, non-bass event; contrast = CV of per-bar density, CV of 8-bar window means, p90/p10 of the windows
//  stripped bar = no drum ornaments, <= 1 perc layer, no lead / chip / jazzy / stab (break bars excluded)
//  changes at each 16-bar boundary of the same low deck (hat pattern, hat timbre, ghost layout, perc layers, clap variations,
//    lead patch / section / motif, layer-2, chip, jazzy); mid-phrase changes (bars 4 / 8 / 12) for comparison
//  variety: distinct main-hat and perc bar patterns per set, previous-bar exact repeat rate
// usage: node v23_contrast.mjs [label] [html] [seeds=5] [bars=448]
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const label=process.argv[2]||'',html=process.argv[3]||HTML,NS=+(process.argv[4]||5),BARS=+(process.argv[5]||448);
const b=await chromeLaunch(['--no-sandbox']);
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const q=(a,x)=>{const s=a.slice().sort((p,q)=>p-q);return s.length?s[Math.floor(x*(s.length-1))]:null;},mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const cv=a=>{const m=mean(a);return m?Math.sqrt(mean(a.map(x=>(x-m)**2)))/m:0;},r3=x=>+x.toFixed(3);
const res={};
for(const band of ['b120','b140','bchill']){const ALL={orn:[],dens:[],strip:0,nb:0,cv:[],cvW:[],ratioW:[],chg:[],mid:[],hatD:[],hatEx:[],percD:[],percEx:[],parts:{}};
  for(let i=0;i<NS;i++){await p.goto(fileUrl(html));
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),7100+i*61,{opening:true});e.cond.auto=true;
      const B={};const bar=()=>B[e.bar]||(B[e.bar]={ghost:0,roll:0,fill:0,flam:0,pre:0,extra:0,tail:0,brk:0,perc:0,pk:new Set(),hat:0,hatMain:new Set(),percSteps:new Set(),clap:0,lead:0,stab:0,chip:0,jazz:0,pad:0,drop:false});
      let D=null,U=0;
      const od=e.drumsTop.bind(e);e.drumsTop=(d,t,s,...a)=>{if(d!==e.low)return;const K=d.kit,F=K&&K.fill,v=K?K.hat.v[s]:0;
        D={s,t,n:0,ch:d.band==='bchill',ghost:v>0&&v<0.7,fill:!!F&&((F==='roll'||F==='drop')&&s>=12||F==='stut'&&s>=8||F==='open'&&s>=14)};try{return od(d,t,s,...a);}finally{D=null;}};
      const hatRec=(vel,bus)=>{if(!D)return;const x=bar();if(bus===e.cur.perc){x.perc++;x.pk.add('shk');x.percSteps.add(D.s);return;}if(bus===e.cur.clap){x.clap++;return;}
        D.n++;if(D.fill)x.fill++;else if(D.n>1)x.roll++;else if(D.ch?vel<0.1:D.ghost)x.ghost++;else{x.hat++;x.hatMain.add(D.s);}};
      e.hat=(t,vel,dur,tau,pan,freq,bus=e.cur.hat)=>hatRec(vel,bus);if(e.metalHat)e.metalHat=(t,vel,tau,bus=e.cur.hat)=>hatRec(vel,bus);
      e.ride=(t,vel,bus)=>{if(!D)return;if(bus&&bus===e.cur.hat)return hatRec(0.5,bus);const x=bar();x.perc++;x.pk.add('ride');x.percSteps.add(D.s);};
      const clapRec=(t,vel,tail)=>{if(!D)return;const x=bar(),main=[4,8,12].includes(D.s);if(tail)x.tail++;
        if(t<D.t-0.005)x.flam++;else if(main&&vel>0.3)x.clap++;else if(vel<0.3)x.pre++;else x.extra++;};
      e.clap=(t,vel=1)=>clapRec(t,vel,false);if(e.clapK)e.clapK=(t,vel,tim,tail)=>clapRec(t,vel,tail);
      e.snare=()=>{if(D)return clapRec(D.t,0.5,false);bar().brk++;};
      e.tom=()=>{if(!D)return;const x=bar();x.perc++;x.pk.add('tom');x.percSteps.add(D.s);};if(e.pz)e.pz=(t,kind)=>{if(!D)return;const x=bar();x.perc++;x.pk.add(kind);x.percSteps.add(D.s);};
      const ou=e.upperStep.bind(e);e.upperStep=(...a)=>{U++;try{return ou(...a);}finally{U--;}};
      for(const k of ['synth','acid','fmHit','vox','marimba','flute','pulse','bleep'])if(e[k])e[k]=()=>{if(U)bar().lead++;};
      for(const k of ['stab','hardStab','organ'])if(e[k])e[k]=()=>{if(U)bar().stab++;};
      for(const k of ['chipNote','chipArp'])if(e[k])e[k]=()=>{bar().chip++;};if(e.chipNoise)e.chipNoise=()=>{};
      e.jzEP=()=>{bar().jazz++;};const cp=e.chillPad.bind(e);e.chillPad=(...a)=>{bar().pad++;return cp(...a);};
      const ol=e.upperLayer2.bind(e);e.upperLayer2=(...a)=>{bar().pad++;return ol(...a);};
      for(const k of ['kick','bass','drone','noiseWash','revCym','riserFx'])if(e[k])e[k]=()=>{};
      const snap=()=>{const d=e.low,K=d.kit,A=d.arr;return {id:d.id,hatPat:K?K.hat.pat:'',hatFam:K?K.hat.fam:'',ghosts:K?K.hat.v.map(x=>x>0&&x<0.7?1:0).join(''):'',
        perc:K?K.perc.filter(x=>x.on).map(x=>x.kind).sort().join(','):'',clap:K?[!!K.clap.flam,!!K.clap.pre].join(','):'',lead:[A.variant,A.section,A.motif?A.motif.id:0,A.chillPatch?A.chillPatch.n:''].join('|'),
        l2:A.layer2||'',chip:!!(e.chip&&e.chip.on),jazz:!!(e.jazz&&e.jazz.on)};};
      const chg=[],mid=[];let prev=null,t=0.01,openEnd=null,closeAt=BARS-48;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;}
        if(st%16===15)prev=snap();
        e.scheduleStep(t);t+=e.s16;bar().drop=bar().drop||!!e.drop.active;
        if(st%16===0&&prev&&openEnd!=null&&!e.cond.closing&&e.bar%4===0){const now=snap();if(now.id===prev.id){let n=0;for(const k in now)if(k!=='id'&&now[k]!==prev[k])n++;(e.bar%16===0?chg:mid).push(n);}}
        if(st%16===15&&openEnd==null&&!e.cond.opening)openEnd=e.bar;}
      const out=[];for(let k=openEnd;k<closeAt;k++){const x=B[k];if(!x)continue;out.push({...x,pk:x.pk.size,hatMain:[...x.hatMain].sort((a,b)=>a-b).join(','),percSteps:[...x.percSteps].sort((a,b)=>a-b).join(','),bar:k});}
      return {bars:out,chg,mid};},[band,i,BARS]);
    const bars=r.bars;const orn=x=>x.ghost+x.roll+x.fill+x.flam+x.pre+x.extra+x.tail+x.brk,dens=x=>orn(x)+x.perc+x.hat+x.clap+x.lead+x.stab+x.chip+x.jazz+x.pad;
    for(const x of bars){ALL.orn.push(orn(x));ALL.dens.push(dens(x));for(const k of ['ghost','roll','fill','flam','pre','extra','tail','brk','perc','pk','lead','stab','chip','jazz','pad'])(ALL.parts[k]||(ALL.parts[k]=[])).push(x[k]);
      if(!x.drop){ALL.nb++;if(x.ghost+x.roll+x.fill+x.flam+x.pre+x.extra+x.tail===0&&x.pk<=1&&x.lead+x.chip+x.jazz+x.stab===0)ALL.strip++;}}
    const dv=bars.map(dens);ALL.cv.push(cv(dv));const W=[];for(let k=0;k+8<=dv.length;k+=8)W.push(mean(dv.slice(k,k+8)));ALL.cvW.push(cv(W));ALL.ratioW.push(q(W,.9)/Math.max(0.5,q(W,.1)));
    ALL.chg.push(...r.chg);ALL.mid.push(...r.mid);
    const varM=key=>{const ks=bars.map(x=>x[key]);let ex=0;for(let k=1;k<ks.length;k++)if(ks[k]===ks[k-1])ex++;return [new Set(ks).size,ex/Math.max(1,ks.length-1)];};
    const [hd,he]=varM('hatMain'),[pd,pe]=varM('percSteps');ALL.hatD.push(hd);ALL.hatEx.push(he);ALL.percD.push(pd);ALL.percEx.push(pe);}
  const pm=k=>r3(mean(ALL.parts[k]));
  res[band]={drumOrnPerBar:{mean:r3(mean(ALL.orn)),p10:q(ALL.orn,.1),p50:q(ALL.orn,.5),p90:q(ALL.orn,.9)},densityPerBar:{mean:r3(mean(ALL.dens)),p10:q(ALL.dens,.1),p50:q(ALL.dens,.5),p90:q(ALL.dens,.9)},
    parts:{ghost:pm('ghost'),roll:pm('roll'),fillHits:pm('fill'),flam:pm('flam'),preClap:pm('pre'),extraClap:pm('extra'),tail:pm('tail'),breakFill:pm('brk'),percHits:pm('perc'),percLayers:pm('pk'),lead:pm('lead'),stab:pm('stab'),chip:pm('chip'),jazz:pm('jazz'),padTrig:pm('pad')},
    contrast:{cvBar:r3(mean(ALL.cv)),cv8:r3(mean(ALL.cvW)),p90p10_8:r3(mean(ALL.ratioW))},strippedShare:r3(ALL.strip/Math.max(1,ALL.nb)),
    phraseChanges:{mean:r3(mean(ALL.chg)),p90:q(ALL.chg,.9),share3plus:r3(ALL.chg.filter(x=>x>=3).length/Math.max(1,ALL.chg.length)),share0:r3(ALL.chg.filter(x=>x===0).length/Math.max(1,ALL.chg.length))},
    midPhraseChanges:{mean:r3(mean(ALL.mid)),shareAny:r3(ALL.mid.filter(x=>x>0).length/Math.max(1,ALL.mid.length))},
    variety:{hatDistinct:r3(mean(ALL.hatD)),hatExactPrev:r3(mean(ALL.hatEx)),percDistinct:r3(mean(ALL.percD)),percExactPrev:r3(mean(ALL.percEx))}};
  console.log('==',band,JSON.stringify(res[band]));}
console.log('RESULT',JSON.stringify({label,res}));console.log('errors',errs);await b.close();
