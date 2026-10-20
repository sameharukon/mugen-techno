// free-text -> break type mapping check (no audio needed)
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = join(HERE, '..', 'index.html');
const fileUrl = (p, q = '') => pathToFileURL(p).href + q;
const chromeLaunch = (args) => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args });

const b = await chromeLaunch(['--no-sandbox']);
const p=await b.newPage();await p.goto(fileUrl(HTML));
const out=await p.evaluate(()=>{const oc=new OfflineAudioContext(2,44100,44100);const rows=[];
  for(const t of ['ブレイク入れて','短いブレイク','長めのブレイク','テープストップ','フィルターでこもらせて','ブレイクダウン','スタッター','エコーアウト','ダブアウトして','ハーフタイム','サイレンス','ハイパスビルド','ベースだけ','パーカッションだけ','キック抜いて','ピークを作って','少しブレイク','がっつりブレイク']){
    const e=new Engine(oc,7);e.cond.p.energy=0.6;const r=e.cond.intent(t);rows.push([t,e.cond.events.filter(x=>x.btype).map(x=>x.btype+'x'+x.len).join(','),r.labels.join(' / ')]);}
  return rows;});
for(const r of out)console.log(r.join('  |  '));await b.close();
