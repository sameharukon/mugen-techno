import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--autoplay-policy=no-user-gesture-required','--no-sandbox'] });
const p = await b.newPage({viewport:{width:1080,height:1000}}); const errs=[];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///workspace/techno/live/index.html');
// チル帯 set: pick the band, start (opening → kick-in → warm-up), then press ストップ to show the クロージング phase
await p.click('#bandbchill'); await p.click('#play'); await p.waitForTimeout(500);
let st; for(let i=0;i<170;i++){await p.waitForTimeout(500); st=await p.evaluate(()=>({bar:eng.bar,band:eng.cond.band,bpm:+eng.bpm.toFixed(2),style:eng.low.style,opening:!!eng.cond.opening,mix:eng.cond.mix&&eng.cond.mix.state,min:+eng.minLead.toFixed(4)})); if(st.bar>=22)break;}
await p.click('#play'); await p.waitForTimeout(2500);
st=await p.evaluate(()=>({bar:eng.bar,band:eng.cond.band,bpm:+eng.bpm.toFixed(2),style:eng.low.style,closingE:eng.cond.closing&&eng.cond.closing.E,min:+eng.minLead.toFixed(4)}));
console.log(JSON.stringify(st), await p.textContent('#nowStyle'), '|', await p.textContent('#upinfo'), '|', await p.textContent('#play'));
await p.screenshot({path:'/workspace/techno/live/test/screenshot.png'});
console.log('errors',errs); await b.close();
