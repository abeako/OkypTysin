// Собирает приложение в один HTML-файл (без service worker) — для показа ссылкой.
// Запуск: VITE_NO_SW=1 npx vite build --outDir dist-page && node scripts/build-page.mjs dist-page out.html
import fs from "node:fs";
import path from "node:path";
const [dir, out] = process.argv.slice(2);
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const js = [...html.matchAll(/src="\/(assets\/[^"]+\.js)"/g)].map((m) => fs.readFileSync(path.join(dir, m[1]), "utf8"));
const css = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((m) => fs.readFileSync(path.join(dir, m[1]), "utf8"));
const page = `<title>Дәлел</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0b6e4f">
<style>${css.join("\n")}</style>
<div id="root"></div>
<script type="module">${js.join("\n").replace(/<\/script/gi, "<\\/script")}</script>
`;
fs.writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(0) + " KB");
