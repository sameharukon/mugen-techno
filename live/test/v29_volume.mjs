// v29: the volume slider (音量 / Volume). Real-time playback in Chrome; an AnalyserNode taps the engine output just before the user
// gain (eng.out) and one just after it (eng.userVol), so level = rms(after) / rms(before) is exactly what the slider did to the sound,
// independent of the music's own dynamics, ducking, fades and the limiter.
//  1) a value set before play is used when playback starts
//  2) during playback: several values incl. 0 and 1 -> measured level == the slider's gain (squared curve), 0 = silence
//  3) smooth: a 1 -> 0 move ramps over tens of ms (no step), no sample jump in the output beyond the music's own
//  4) nothing else automates it: the level holds through 10 s of autopilot and the closing fade; stop -> play keeps the value
//  5) the label is translated, and a mobile (touch) context changes it with a tap / drag
// usage: node v29_volume.mjs
import { chromium } from 'playwright-core';
const URL='file:///workspace/techno/live/index.html?noopening';
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--autoplay-policy=no-user-gesture-required','--no-sandbox']});
const fails=[],res={};const ok=(c,m)=>{if(!c)fails.push(m);};
const ctxD=await b.newContext({viewport:{width:1280,height:1000},locale:'ja-JP'});const p=await ctxD.newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(URL);await p.waitForTimeout(300);
const tap=()=>p.evaluate(()=>{const c=eng.ctx,A=c.createAnalyser(),B=c.createAnalyser();A.fftSize=B.fftSize=2048;eng.out.connect(A);eng.userVol.connect(B);window.__tap={A,B};});
// mean-square ratio over `ms` (both analysers read in the same callback -> same window)
const level=(ms=600)=>p.evaluate(ms=>new Promise(res=>{const {A,B}=window.__tap,a=new Float32Array(2048),bb=new Float32Array(2048);let sa=0,sb=0,jb=0,ja=0;
  const iv=setInterval(()=>{A.getFloatTimeDomainData(a);B.getFloatTimeDomainData(bb);for(let i=0;i<2048;i++){sa+=a[i]*a[i];sb+=bb[i]*bb[i];if(i){ja=Math.max(ja,Math.abs(a[i]-a[i-1]));jb=Math.max(jb,Math.abs(bb[i]-bb[i-1]));}}},40);
  setTimeout(()=>{clearInterval(iv);res({pre:Math.sqrt(sa),post:Math.sqrt(sb),ratio:sa>1e-9?Math.sqrt(sb/sa):null,jumpPre:ja,jumpPost:jb});},ms);}),ms);
const setVol=v=>p.locator('#vol').fill(String(v));   // real input / change events on the range
const gainOf=v=>v<0.005?0:v*v;
// 1) before play
await setVol(0.5);res.beforePlay={S:await p.evaluate(()=>S.vol)};ok(Math.abs(res.beforePlay.S-0.5)<1e-9,'S.vol not set before play');
await p.click('#play');await p.waitForTimeout(1500);await tap();await p.waitForTimeout(300);
{const L=await level();res.beforePlay.level=L;res.beforePlay.gain=await p.evaluate(()=>eng.userVol.gain.value);
  ok(L.pre>0.5,'no sound reached the tap (pre '+L.pre+')');ok(L.ratio!=null&&Math.abs(L.ratio-0.25)<0.02,'pre-play 0.5 not applied at start: ratio '+L.ratio);}
// 2) values during playback
res.during=[];
for(const v of [1,0.8,0.3,0,0.65,1]){await setVol(v);await p.waitForTimeout(250);const L=await level();const g=gainOf(v);res.during.push({v,ratio:L.ratio,post:+L.post.toFixed(5),want:g});
  if(v===0)ok(L.post<1e-4,'volume 0 is not silent: post rms '+L.post);else ok(L.ratio!=null&&Math.abs(L.ratio-g)<Math.max(0.02,0.04*g),`volume ${v}: ratio ${L.ratio} (want ${g})`);}
// 3) smooth: 1 -> 0, sample the param every ~4 ms
await setVol(1);await p.waitForTimeout(300);
res.ramp=await p.evaluate(()=>new Promise(res=>{const el=document.getElementById('vol');el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  const g=eng.userVol.gain,t0=eng.ctx.currentTime,pts=[];const iv=setInterval(()=>{pts.push([+((eng.ctx.currentTime-t0)*1000).toFixed(1),+g.value.toFixed(4)]);},4);
  setTimeout(()=>{clearInterval(iv);res(pts);},260);}));
{const mid=res.ramp.filter(x=>x[1]>0.05&&x[1]<0.95).length,mono=res.ramp.every((x,i)=>!i||x[1]<=res.ramp[i-1][1]+1e-6),end=res.ramp[res.ramp.length-1][1];
  ok(mono,'ramp not monotonic');ok(end<0.01,'ramp did not reach 0: '+end);
  const t50=(res.ramp.find(x=>x[1]<0.5)||[999])[0];res.rampT50ms=t50;ok(t50>=5&&t50<=80,'1->0 half-way time '+t50+' ms (want a short ramp, not a step)');}
await setVol(1);await p.waitForTimeout(300);
{const L0=await level(800);await p.evaluate(()=>{const el=document.getElementById('vol');let v=1,k=0;const iv=setInterval(()=>{v=k%2?1:0.2;el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));if(++k>=8)clearInterval(iv);},90);});
  const L1=await level(800);res.click={jumpPostSteady:+L0.jumpPost.toFixed(4),jumpPostWhileMoving:+L1.jumpPost.toFixed(4),jumpPreWhileMoving:+L1.jumpPre.toFixed(4)};
  ok(L1.jumpPost<=L1.jumpPre*1.05+1e-4,'slider moves add sample jumps beyond the music (click): '+JSON.stringify(res.click));}
// 4) nothing else automates the user gain
await setVol(0.6);await p.waitForTimeout(300);
res.hold=[];for(let i=0;i<10;i++){const L=await level(900);res.hold.push(L.ratio==null?null:+L.ratio.toFixed(4));}
ok(res.hold.every(r=>r==null||Math.abs(r-0.36)<0.02),'level drifted during autopilot: '+res.hold.join(','));
await p.evaluate(()=>{eng.cond.curSrc="ストップ";eng.cond.startClosing([]);eng.cond.curSrc=null;});
res.closing=[];for(let i=0;i<4;i++){const L=await level(700);res.closing.push(L.ratio==null?null:+L.ratio.toFixed(4));}
ok(res.closing.every(r=>r==null||Math.abs(r-0.36)<0.02),'closing fade fought the slider: '+res.closing.join(','));
await p.evaluate(()=>{if(playing)stop();});await p.waitForTimeout(500);await setVol(0.4);
await p.click('#play');await p.waitForTimeout(1500);await tap();await p.waitForTimeout(300);
{const L=await level();res.restart={ratio:L.ratio,gain:await p.evaluate(()=>eng.userVol.gain.value)};ok(L.ratio!=null&&Math.abs(L.ratio-0.16)<0.02,'value set while stopped not used on restart: '+L.ratio);}
// 5) label i18n + bound once
await p.click('#lang-en');await p.waitForTimeout(200);res.labelEn=await p.textContent('.vol span');await p.click('#lang-ja');await p.waitForTimeout(200);res.labelJa=await p.textContent('.vol span');
ok(res.labelEn.trim()==='Volume'&&res.labelJa.trim()==='音量','label i18n '+res.labelEn+'/'+res.labelJa);
await setVol(0.9);await p.waitForTimeout(250);{const L=await level();ok(Math.abs(L.ratio-0.81)<0.03,'slider dead after a language switch: '+L.ratio);}
await p.evaluate(()=>{if(playing)stop();});
// mobile touch
const ctxM=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'ja-JP'});const m=await ctxM.newPage();
m.on('pageerror',e=>errs.push('mobile: '+e.message));await m.goto(URL);await m.waitForTimeout(300);
await m.tap('#play');await m.waitForTimeout(1200);
const box=await m.locator('#vol').boundingBox();
await m.touchscreen.tap(box.x+box.width*0.25,box.y+box.height/2);await m.waitForTimeout(300);
const v1=await m.evaluate(()=>[S.vol,eng.userVol.gain.value]);
// a drag: touchstart / touchmove / touchend through CDP
const cdp=await ctxM.newCDPSession(m),y=box.y+box.height/2;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*0.25,y}]});
for(let k=1;k<=8;k++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*(0.25+0.07*k),y}]});await m.waitForTimeout(30);}
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(300);
const v2=await m.evaluate(()=>[S.vol,eng.userVol.gain.value,getComputedStyle(document.getElementById('vol')).touchAction]);
res.mobile={tap:v1,drag:v2};
ok(v1[0]>0.1&&v1[0]<0.45&&Math.abs(v1[1]-gainOf(v1[0]))<0.02,'touch tap did not set the volume: '+v1);
ok(v2[0]>v1[0]+0.2&&Math.abs(v2[1]-gainOf(v2[0]))<0.02,'touch drag did not move the volume: '+v2);
await m.evaluate(()=>{if(playing)stop();});
console.log('RESULT',JSON.stringify(res));console.log('ERRORS',JSON.stringify(errs.slice(0,5)));
console.log(fails.length?'FAIL '+JSON.stringify(fails):'all ok');
await b.close();if(fails.length||errs.length)process.exit(1);
