import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--autoplay-policy=no-user-gesture-required','--no-sandbox'] });
const p = await b.newPage({viewport:{width:1080,height:1000}}); const errs=[];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///workspace/techno/live/index.html'); await p.click('#play'); await p.waitForTimeout(500);
await p.click('button[data-intent="チルに"]').catch(async()=>{await p.fill('#say','チルに'); await p.press('#say','Enter');});
// wait until the chill core is playing (☾ チル lit in the arc, chill status in the mix info)
let st; for(let i=0;i<90;i++){await p.waitForTimeout(500); st=await p.evaluate(()=>({bar:eng.bar,chill:eng.chillMode,amt:+eng.chillAmt.toFixed(2),min:eng.minLead})); if(st.chill&&st.amt>0.9&&st.bar>=12)break;}
await p.waitForTimeout(1200);
console.log(JSON.stringify(st), await p.textContent('#interp'));
await p.screenshot({path:'/workspace/techno/live/test/screenshot.png'});
console.log('errors',errs); await b.close();
