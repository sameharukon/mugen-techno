// v16: groove balance in long おまかせ sets (scheduler only). Per bar (opening excluded), exclusive classes:
//   break (any break/drop active; halftime counted separately) > chill (chill episode: soft4 / half / beatless) > kick pattern:
//   four = all of steps 0/4/8/12 kicked (extra kicks allowed), broken = broken / half-time kick pattern, none = beatless
// + segments: runs of broken-style bars and chill episodes (lengths, gaps), share of bars whose low deck style is "broken"
// usage: node v16_balance.mjs [label] [html] [seeds=6] [bars=448]
import { chromium } from 'playwright-core';
const label=process.argv[2]||'',html=process.argv[3]||'/workspace/techno/live/index.html',NS=+(process.argv[4]||6),BARS=+(process.argv[5]||448);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const out={};
for(const band of ['b120','b140','b160','bchill']){const tot={four:0,broken:0,none:0,other:0,chill:0,brk:0,halftime:0,n:0,styleBroken:0},brokenRuns=[],chillRuns=[],chillGaps=[],brkTypes={};
  for(let i=0;i<NS;i++){await p.goto('file://'+html);
    const r=await p.evaluate(([band,i,BARS])=>{S.band=band;S.style=BANDS[band].first;const e=new Engine(new OfflineAudioContext(2,4410,44100),3100+i*57,{opening:true});e.cond.auto=true;
      for(const k of ['synth','stab','hardStab','acid','fmHit','organ','vox','marimba','flute','pulse','bleep','drone','bass','hat','clap','snare','perc','crash','chipNote','chipArp','chipNoise','noiseWash','revCym'])if(typeof e[k]==='function')e[k]=()=>{};
      let ks=new Set();e.kick=()=>{ks.add(e.step%16);};
      const bars=[];let t=0.01;
      for(let st=0;st<BARS*16;st++){e.scheduleStep(t);t+=e.s16;
        if(st%16===15){const D=e.drop;bars.push([e.cond.opening?1:0,D.active?D.type:"",e.chillMode||"",[...ks].sort((a,b)=>a-b).join(","),e.low.style]);ks=new Set();}}
      return bars;},[band,i,BARS]);
    let run=0,crun=0,lastChill=null;const flush=()=>{if(run)brokenRuns.push(run);run=0;};
    r.forEach(([op,brk,ch,k,st],bi)=>{if(op)return;tot.n++;if(st==="broken")tot.styleBroken++;
      const K=k?k.split(",").map(Number):[],four=[0,4,8,12].every(s=>K.includes(s));
      let c;if(brk){c=brk==="halftime"?"halftime":"brk";brkTypes[brk]=(brkTypes[brk]||0)+1;}else if(ch)c="chill";else c=four?"four":(K.length?"broken":"none");
      tot[c]++;
      if(c==="broken"||(c==="four"&&false))run++;else if(c!=="brk"&&c!=="halftime")flush();
      if(ch){if(!crun&&lastChill!=null)chillGaps.push((bi-lastChill)/16);crun++;}else if(crun){chillRuns.push(crun);lastChill=bi;crun=0;}});
    flush();if(crun)chillRuns.push(crun);}
  const pc=x=>+(100*x/tot.n).toFixed(1),q=(a,x)=>{const s=a.slice().sort((p,q)=>p-q);return s.length?s[Math.floor(x*(s.length-1))]:null;};
  out[band]={bars:tot.n,fourPct:pc(tot.four),brokenPct:pc(tot.broken),halftimePct:pc(tot.halftime),chillPct:pc(tot.chill),breakPct:pc(tot.brk),beatlessPct:pc(tot.none),
    brokenStyleBarsPct:pc(tot.styleBroken),brokenRuns:{n:brokenRuns.length,med:q(brokenRuns,.5),max:Math.max(0,...brokenRuns)},
    chill:{n:chillRuns.length,perPhrases:+((tot.n/16)/Math.max(1,chillRuns.length)).toFixed(1),lenMed:q(chillRuns,.5),lenMax:Math.max(0,...chillRuns),minGapPhrases:chillGaps.length?Math.min(...chillGaps):null},
    breakTypes:Object.fromEntries(Object.entries(brkTypes).map(([k,v])=>[k,pc(v)]))};
  console.log('===',band,label,JSON.stringify(out[band]));}
console.log('SUMMARY',JSON.stringify(out));console.log('errors',errs);await b.close();
