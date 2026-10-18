// 消化した予定 log: (1) scheduler-only run (no rendering) to check order / cap / cancels / sources,
// (2) live UI run: no 詳細設定 panel, log fills in the DOM, screenshot.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--autoplay-policy=no-user-gesture-required','--no-sandbox'] });
const p = await b.newPage({viewport:{width:1080,height:1080}}); const errs=[];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text()); });
p.on('pageerror', e => errs.push('pageerror: '+e.message));
await p.goto('file:///workspace/techno/live/index.html'); await p.waitForTimeout(300);
console.log('panel gone:', await p.locator('details,#adv,#mutes,#brktype,#key,#cutoff,#seedinfo,#autodrop').count()===0, '| key', await p.evaluate(()=>S.key));
// (1) fast scheduler-only run
const r1=await p.evaluate(()=>{const oc=new OfflineAudioContext(2,44100,44100),e=new Engine(oc,123),C=e.cond;let t=0.01;const snaps=[];
  const script={1:'一気にトライバルに',2:'少し暗く',20:'テープストップ',30:'少しテンポ上げて',34:'ピークを作って',36:'ハードに',38:'ずっとこのまま',44:'おまかせ',140:'ずっとこのまま'};
  for(let st=0;st<160*16;st++){const bar=st>>4;if(st%16===8&&script[bar])C.intent(script[bar]);
    if(bar===60&&st%16===0)S.dropManual=true;if(bar===62&&st%16===0)S.dropManual=false;
    if(st%16===4&&bar===41){const ls=[];C.curSrc='ボタン「スタッター」';C.planBreak(bar,null,ls,null,'stutter');C.curSrc=null;}
    e.scheduleStep(t);t+=e.s16;if(st%16===15&&(bar===39||bar===159))snaps.push(C.log.map(x=>({...x})));}
  const L=snaps[1],order=L.every((x,i)=>i===0||(x.t<=L[i-1].t+1e-9&&x.bar<=L[i-1].bar));
  return {cap:L.length,order,cancelsAtHold:snaps[0].filter(x=>x.status==='cancel').map(x=>x.text+' ← '+x.src),
    first20at39:snaps[0].slice().reverse().map(x=>`[${x.bar+1}|${Math.floor(x.t/60)}:${String(Math.floor(x.t%60)).padStart(2,'0')}] ${x.status==='cancel'?'取消 ':''}${x.text} ← ${x.src}`),
    last:L.slice(0,8).map(x=>`[${x.bar+1}] ${x.status==='cancel'?'取消 ':''}${x.text} ← ${x.src}`),
    srcKinds:[...new Set(L.concat(snaps[0]).map(x=>x.src.startsWith('「')?'intent':x.src))],totalLogged:C.logVer};});
console.log(JSON.stringify(r1,null,1));
// (2) live UI
await p.click('#play'); await p.waitForTimeout(500);
const say=async t=>{await p.fill('#say',t);await p.press('#say','Enter');await p.waitForTimeout(150);};
await say('一気にトライバルに'); await say('少し明るく'); await p.click('[data-brk="stutter"]');
await p.waitForTimeout(36000);
await say('ブレイクダウンして'); await say('少しテンポ上げて'); await p.waitForTimeout(800); await say('ずっとこのまま'); await p.waitForTimeout(1500);
const dom=await p.evaluate(()=>({n:document.querySelectorAll('#log li').length,cancel:document.querySelectorAll('#log li.cx').length,count:document.getElementById('logcount').textContent,
  rows:[...document.querySelectorAll('#log li')].map(li=>li.innerText.replace(/\n/g,' ｜ ')),logH:document.getElementById('log').getBoundingClientRect().height,minLead:eng.minLead}));
console.log(JSON.stringify(dom,null,1));
await p.screenshot({path:'/workspace/techno/live/test/screenshot.png', fullPage:true});
console.log('errors/warnings:', errs); await b.close();
