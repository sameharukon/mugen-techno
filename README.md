# techno-generator-1

ブラウザ上でリアルタイムに生成する Web Audio のテクノです。数値をいじるのではなく、「盛り上げて」「トライバルに」のような意図を伝えると、フレーズ単位で DJ のように少しずつ変化します。

## ライブ（`live/index.html`）

`live/index.html` をブラウザで開きます。外部ライブラリは不要で、Web Audio だけで動きます。

- **Space**: スタート / 停止
- **K**: キック抜き（キックドロップ）。ボタン「キック抜き（K）」と同じ
- **意図ボタン**: 盛り上げて、もっとハードに、落ち着かせて、暗く、明るく、グルーヴを出して、トライバルに、ミニマルに戻して、ブレイク入れて、ピークを作って、ずっとこのまま、ブレイクビート風に
- **自由入力**: 入力欄に「少し暗くして一気に盛り上げて」「トライバルに」「ブレイク入れて」のように書いて Enter（または「送る」）
- **おまかせ**: 「おまかせ」ボタン、または「おまかせ」と入力。数フレーズごとにスタイルを自動で移す。やめるときはもう一度押すか「おまかせやめて」
- **詳細設定**: 画面下のパネル。パートミュート、スタイルの直接指定、キー、フィルター、ディレイ、バリエーション、キック抜きの演出、定期的な自動抜き

スタイルはミニマル、ハードテクノ、ハードグルーヴ、トライバル、ブレイクビート風です。

![ライブ画面](live/test/screenshot.png)

## テスト（`live/test/`）

Playwright で `live/index.html` を開く Node テストです。`smoke5.mjs` は操作の通し、`shot.mjs` はスクリーンショット、`dj_offline.mjs` は意図をスクリプトしたオフラインレンダー、`drop_analysis.mjs` はキック抜きの解析です。

```bash
cd live/test
npm install
npx playwright install chromium
node smoke5.mjs
node shot.mjs
node dj_offline.mjs          # 短縮は node dj_offline.mjs quick
node drop_analysis.mjs /path/to/live/index.html
```

各スクリプトはページを `file:///workspace/techno/live/index.html` として開き、Chrome を `/usr/bin/google-chrome` から起動します。`smoke5.mjs` と `shot.mjs` はスクリーンショットを `live/test/screenshot.png` に上書きします。
