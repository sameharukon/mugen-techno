import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const b = await chromeLaunch(['--autoplay-policy=no-user-gesture-required','--no-sandbox']);
const p = await b.newPage({viewport:{width:1080,height:1250}}); const errs=[];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); });
p.on('pageerror', e => errs.push('pageerror: '+e.message));
await p.goto(fileUrl(HTML, '?noopening')); await p.waitForTimeout(300);
console.log('removed panel present?', await p.locator('#adv').count(), await p.locator('#mutes').count(), await p.locator('#brktype').count());
// intent before start
await p.click('[data-intent="暗く"]'); console.log('pre-start:', await p.textContent('#interp'));
await p.click('#play'); await p.waitForTimeout(800);
const st=async l=>console.log(l, JSON.stringify(await p.evaluate(()=>({bar:eng.bar,bpm:+eng.bpm.toFixed(2),low:eng.low.style,decks:eng.decks.map(d=>d.style),mix:eng.cond.mix?{to:eng.cond.mix.to,state:eng.cond.mix.state,m:eng.cond.mix.m,swap:eng.cond.mix.swap}:null,
  p:Object.fromEntries(Object.entries(eng.cond.p).map(([k,v])=>[k,+v.toFixed(2)])),auto:eng.cond.auto,hold:eng.cond.hold,drop:eng.drop.active,minLead:+eng.minLead.toFixed(3),events:eng.cond.events.length}))));
console.log('after start interp:', await p.textContent('#interp'));
await st('start');
for (const t of ['盛り上げて','明るく']) { await p.click(`[data-intent="${t}"]`); console.log(t,'->',await p.textContent('#interp')); }
// free text with intensity
for (const t of ['かなり暗くして空間を広げて','一気にハードに','少しテンポ上げて','ねこ']) { await p.evaluate(x=>sendIntent(x),t); await p.waitForTimeout(150);
  console.log(JSON.stringify(t),'->',await p.textContent('#interp'), '| suggest:', (await p.locator('#suggest button').allTextContents()).join(',')); }
await p.click('#suggest button:first-child'); console.log('suggest click ->', await p.textContent('#interp'));
console.log('timeline:', (await p.locator('#timeline li').allTextContents()).join(' | '));
await p.waitForTimeout(12000); await st('mixing?');
// kick drop during the mix
await p.keyboard.press('KeyK'); await p.waitForTimeout(2500); await st('K during mix'); await p.keyboard.press('KeyK');
await p.waitForTimeout(16000); await st('after swap');
console.log('mixinfo:', await p.textContent('#mixinfo'), '| now/next:', await p.textContent('#nowStyle'), await p.textContent('#nextStyle'), '| bpm:', await p.textContent('#bpm'));
await p.screenshot({path:join(HERE, 'screenshot.png'), fullPage:true});
await p.click('[data-intent="トライバルに"]'); console.log('トライバルに ->', await p.textContent('#interp'));
await p.click('[data-intent="ずっとこのまま"]'); console.log('hold ->', await p.textContent('#interp')); await st('hold');
console.log('auto fixed ->', await p.evaluate(()=>eng.cond.auto));
await p.click('[data-intent="ピークを作って"]'); console.log('peak ->', await p.textContent('#interp'));
await p.click('[data-intent="ブレイク入れて"]'); console.log('break ->', await p.textContent('#interp'));
for (const t of ['グルーヴを出して','ミニマルに戻して','落ち着かせて','ブレイクビート風に']) { await p.click(`[data-intent="${t}"]`); console.log(t,'->',await p.textContent('#interp')); }
await p.waitForTimeout(6000); await st('end');
console.log('log:', (await p.locator('#log li').allTextContents()).slice(0,6).join(' | '));
await p.click('#play'); await p.waitForTimeout(300); await p.click('#play'); await p.waitForTimeout(300); await p.click('#play'); await p.waitForTimeout(1500); await st('restart');
console.log('errors/warnings:', errs); await b.close();
