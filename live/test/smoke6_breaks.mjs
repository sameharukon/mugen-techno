// Live (real-time) smoke test of the break library: every type via quick buttons / 詳細 picker / free text,
// some during a DJ mix; checks console errors, scheduler headroom, returns landing on bar downbeats.
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const b = await chromeLaunch(['--autoplay-policy=no-user-gesture-required','--no-sandbox']);
const p = await b.newPage({viewport:{width:1080,height:1300}}); const errs=[];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); });
p.on('pageerror', e => errs.push('pageerror: '+e.message));
await p.goto(fileUrl(HTML, '?noopening')); await p.waitForTimeout(300);
console.log('quick buttons:', (await p.locator('#breaks button').allTextContents()).join(','));
await p.click('[data-brk="tapestop"]'); console.log('pre-start chip ->', await p.textContent('#interp'));
await p.click('#play'); await p.waitForTimeout(600);
await p.evaluate(()=>{eng.debug=true;window.__bars=[];const f=eng.onStep;eng.onStep=(s,t,ev,bar)=>{if(s===0)__bars.push(t);f(s,t,ev,bar);};});
const st=async l=>console.log(l, JSON.stringify(await p.evaluate(()=>({bar:eng.bar,bpm:+eng.bpm.toFixed(2),low:eng.low.style,mix:eng.cond.mix?eng.cond.mix.state:null,
  drop:eng.drop.active?eng.drop.type:null,minLead:+eng.minLead.toFixed(3),plan:eng.cond.events.filter(e=>e.type==='break'||e.type==='drop').map(e=>e.btype+'@'+e.bar)}))));
const say=async t=>{await p.evaluate(x=>sendIntent(x),t);await p.waitForTimeout(120);console.log(JSON.stringify(t),'->',await p.textContent('#interp'));};
const chip=async k=>{await p.click(`[data-brk="${k}"]`);await p.waitForTimeout(80);console.log('chip',k,'->',await p.textContent('#interp'));};
const waitDone=async (n,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){const c=await p.evaluate(()=>eng.breakLog.length+(eng.drop.active?0:0));if(c>=n&&!(await p.evaluate(()=>eng.drop.active||eng.cond.events.some(e=>e.type==='break'))))return;await p.waitForTimeout(500);}};
// batch 1: quick buttons (they queue back-to-back without overlapping)
for (const k of ['stutter','silence','echo','kick','filter']) await chip(k);
await st('batch1 planned'); console.log('timeline:', (await p.locator('#timeline li').allTextContents()).join(' | '));
await p.waitForTimeout(5000); await p.screenshot({path:join(HERE, 'screenshot_break.png')}); await st('during');
await waitDone(6,120000); await st('batch1 done');
// batch 2: free text names
for (const t of ['ハーフタイムにして','ハイパスビルドで溜めて','ベースだけにして','パーカッションだけ','短いブレイク']) await say(t);
await waitDone(11,160000); await st('batch2 done');
// breakdown via quick button, then a mix with tape stop at the swap
await chip('breakdown');
await waitDone(12,60000); await st('breakdown done');
await say('一気にハードに'); await st('mix planned');
await chip('tapestop'); // during a mix: either scheduled after or deferred to the swap break
await say('テープストップ'); await say('ブレイクダウンして');
await waitDone(15,120000); await st('after mix');
await say('おまかせ'); await p.evaluate(()=>{eng.cond.autoWaitRange=[1,1];eng.cond.autoWait=1;});
await p.waitForTimeout(40000); await st('auto');
const res=await p.evaluate(()=>{const bt=__bars;const off=eng.returnTimes.map(r=>Math.min(...bt.map(x=>Math.abs(x-r))));
  return {breaks:eng.breakLog.map(x=>x.type+'@'+x.bar+'x'+x.len),types:[...new Set(eng.breakLog.map(x=>x.type))].length,
    returns:eng.returnTimes.length,maxReturnOffFromDownbeatUs:+(Math.max(...off)*1e6).toFixed(3),minLead:+eng.minLead.toFixed(4),
    consecutiveSameAuto:eng.breakLog.slice(1).filter((x,i)=>x.type===eng.breakLog[i].type).length,log:eng.cond.log.map(x=>x.bar+':'+(x.status==='cancel'?'取消 ':'')+x.text+' ← '+x.src)};});
console.log('RESULT', JSON.stringify(res));
await p.screenshot({path:join(HERE, 'screenshot.png'), fullPage:true});
console.log('errors/warnings:', errs); await b.close();
