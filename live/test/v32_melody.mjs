// v32: melody / phrase-ending audit (scheduler-only おまかせ sims, drum and voice endpoints stubbed; the motif lead is read from e.melLog)
//  line stats per deck lead: repeated-note rate (consecutive notes <= 1 bar apart at the same pitch), 4-bar contour range (semitones),
//  distinct pitches per 4 bars, leaps > a 5th
//  phrase endings: for every 16-bar line and every segment change (upper section, motif, accent segment start, break / drop, mix swap) the
//  deck's last lead note in the 2 bars before it: on the tonic / a stable degree (tonic, 5th, chord root / 5th), on a strong 16th (s%4==0),
//  sustained (>= 2 sixteenths), truncated (an upper duck starts before it ends), chord of the last bar (i?)
//  CHECK=1: targets repeated 10..28 %, line-end tonic >= 60 %, line-end stable >= 85 %, truncated <= 5 %, last-bar chord i >= 85 %
// usage: [CHECK=1] HTML=... node v32_melody.mjs [seeds=4] [bars=320] [out.json]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';import path from 'path';import fs from 'fs';
const here=path.dirname(fileURLToPath(import.meta.url)),html=process.env.HTML?path.resolve(process.env.HTML):path.resolve(here,'../index.html');
const NS=+(process.argv[2]||4),BARS=+(process.argv[3]||320),OUT=process.argv[4];
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
const RES={},fails=[];const pc=(a,n)=>n?+(100*a/n).toFixed(1):0;
for(const band of ['bchill','b120','b140']){const T={notes:0,pairs:0,rep:0,leap:0,win:0,range:0,distinct:0,line:{n:0,tonic:0,stable:0,strong:0,sus:0,trunc:0,chordI:0,empty:0},seg:{n:0,tonic:0,stable:0,strong:0,sus:0,trunc:0,chordI:0,empty:0}};
  for(let i=0;i<NS;i++){await p.goto('file://'+html+'?noopening');
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),5300+i*41,{opening:true});e.cond.auto=true;e.debug=true;
      for(const k of ['kick','hat','metalHat','ride','clap','clapK','snare','tom','pz','spSnare','spTom','jzDrumHit','bass','synth','bleep','vox','marimba','flute','acid','pulse','fmHit','stab','organVoiced','chipNote','chipArp','chipNoise','oddPluck','bellFM','jzEP','jzRhodes','jzBrass','jzOrgan','jzVibe','jzTpt','jzRide','noiseWash'])if(typeof e[k]==='function')e[k]=()=>{};
      const ducks=[];for(const k of ['oddDuck','showDuck'])if(e[k]){const o=e[k].bind(e);e[k]=(t,on,...a)=>{const v=o(t,on,...a);if(on){const O=k==='oddDuck'?e.odd:e.show;ducks.push(O&&O.duckT!=null?O.duckT:t);}return v;};}
      const info={},tb={};let t=0.01,closeAt=BARS-40;
      for(let st=0;st<BARS*16;st++){if(st%16===8&&e.bar===closeAt&&!e.cond.closing){e.cond.curSrc="ストップ";e.cond.startClosing([]);e.cond.curSrc=null;}
        if(st%16===0)tb[st/16]=t;
        e.scheduleStep(t);t+=e.s16;
        if(st%16===0){const cd=e.cond,dk={};for(const d of e.decks){const A=d.arr||{};dk[d.id]={sec:A.section,mot:A.motif?A.motif.id:0,on:!!(d.upOn&&e.melOK(d)),semi:e.chordOf(d).semi,root:57+offOf(d.key!=null?d.key:S.key)};}
          info[e.bar]={dk,acc:!!(e.show.on||e.odd.on||e.jazz.on||e.chip.on),drop:!!e.drop.active,closing:!!cd.closing,opening:!!cd.opening,nd:e.decks.length};}}
      return {mel:e.melLog||[],info,tb,ducks,s16:e.s16};},[band,i,BARS]);
    const byD={};for(const x of r.mel)(byD[x[4]]||(byD[x[4]]=[])).push(x);
    for(const id in byD){const N=byD[id];T.notes+=N.length;
      for(let k=1;k<N.length;k++){const a=N[k-1],c=N[k];if((c[0]*16+c[1])-(a[0]*16+a[1])>16)continue;T.pairs++;if(a[2]===c[2])T.rep++;if(Math.abs(a[2]-c[2])>7)T.leap++;}
      const W={};for(const x of N)(W[x[0]>>2]||(W[x[0]>>2]=[])).push(x[2]);for(const w in W)if(W[w].length>=3){T.win++;T.range+=Math.max(...W[w])-Math.min(...W[w]);T.distinct+=new Set(W[w]).size;}}
    const bars=Object.keys(r.info).map(Number).sort((a,b)=>a-b);
    for(const bb of bars){const I=r.info[bb],P=r.info[bb-1];if(!P||P.closing||I.closing||P.opening)continue;
      for(const id in P.dk){const pd=P.dk[id],nd=I.dk[id];if(!pd.on||pd.sec==='off')continue;
        const line=bb%16===0,seg=!nd||nd.sec!==pd.sec||nd.mot!==pd.mot||!nd.on||(I.acc&&!P.acc)||(I.drop&&!P.drop)||I.nd!==P.nd;
        if(!line&&!seg)continue;const G=line?T.line:T.seg;G.n++;
        const N=(byD[id]||[]).filter(x=>x[0]===bb-1||x[0]===bb-2);if(pd.semi===0)G.chordI++;if(!N.length){G.empty++;continue;}
        const f=N[N.length-1],root=f[7],rel=(((f[2]-root)%12)+12)%12,cs=((pd.semi%12)+12)%12,crel=(((rel-cs)%12)+12)%12;
        if(rel===0)G.tonic++;if(rel===0||rel===7||crel===0||crel===7)G.stable++;if(f[1]%4===0&&f[0]===bb-1)G.strong++;if(f[3]>=2*r.s16*0.95)G.sus++;
        const t0=f[6],t1=t0+f[3];if(r.ducks.some(d=>d<t1&&d>t0-16*r.s16))G.trunc++;}}}
  const sum=G=>({n:G.n,tonicPct:pc(G.tonic,G.n-G.empty),stablePct:pc(G.stable,G.n-G.empty),strongPct:pc(G.strong,G.n-G.empty),sustainPct:pc(G.sus,G.n-G.empty),truncPct:pc(G.trunc,G.n-G.empty),chordIPct:pc(G.chordI,G.n),emptyPct:pc(G.empty,G.n)});
  const R=RES[band]={notes:T.notes,repeatPct:pc(T.rep,T.pairs),leapPct:pc(T.leap,T.pairs),range4:+(T.range/Math.max(1,T.win)).toFixed(1),distinct4:+(T.distinct/Math.max(1,T.win)).toFixed(1),lineEnd:sum(T.line),segEnd:sum(T.seg)};
  if(process.env.CHECK&&(R.repeatPct<10||R.repeatPct>28||R.lineEnd.tonicPct<60||R.lineEnd.stablePct<85||R.lineEnd.truncPct>5||R.segEnd.truncPct>5||R.lineEnd.chordIPct<85||R.leapPct>2))fails.push(band);
  console.log(band,JSON.stringify(R));}
if(OUT)fs.writeFileSync(OUT,JSON.stringify(RES));
console.log(process.env.CHECK?(fails.length?'FAIL '+JSON.stringify(fails):'PASS'):'(no CHECK)');
console.log('errors',errs.length,errs.slice(0,3));await b.close();process.exit((process.env.CHECK&&fails.length)||errs.length?1:0);
