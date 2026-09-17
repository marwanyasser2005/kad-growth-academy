import {readFile,writeFile,mkdir,copyFile,stat} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const modules=[
 "src/data/curriculum.mjs","src/data/questions.mjs","src/data/practice.mjs",
 "src/core/engine.mjs","src/core/state.mjs","src/core/idb.mjs","src/core/dom.mjs","src/ui/icons.mjs","src/app.mjs"
];
const logo=(await readFile(resolve(root,"public/assets/kad-logo.png"))).toString("base64");
const dataUrl=`data:image/png;base64,${logo}`;
let bundle="";
for(const path of modules){
 let source=await readFile(resolve(root,path),"utf8");
 source=source.replace(/^import .+;\r?\n/gm,"").replace(/^export /gm,"");
 bundle+=`\n// ---------- ${path} ----------\n${source}\n`;
}
bundle=bundle.replaceAll('src="./assets/kad-logo.png"',`src="${dataUrl}"`);
const css=await readFile(resolve(root,"src/styles.css"),"utf8");
const html=`<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="KAD Growth Academy: Arabic and English Leadership Foundation. Learn, practice, and reflect.">
<meta name="theme-color" content="#111112" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d0d0f" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>KAD Growth Academy | Leadership Foundation</title>
<link rel="icon" type="image/png" href="${dataUrl}">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Cairo:wght@300;400;500;600;700&display=swap">
<style>${css}</style>
</head><body><div id="app"></div>
<noscript>This application requires JavaScript. See the source register in the project documentation.</noscript>
<script type="module">${bundle.replace(/<\/script/gi,"<\\/script")}</script>
<script>if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register("./sw.js").catch(function(){});}</script>
</body></html>`;
await mkdir(resolve(root,"dist"),{recursive:true});
await writeFile(resolve(root,"dist/index.html"),html);
await copyFile(resolve(root,"public/robots.txt"),resolve(root,"dist/robots.txt"));
await copyFile(resolve(root,"public/_headers"),resolve(root,"dist/_headers"));
await copyFile(resolve(root,"public/manifest.webmanifest"),resolve(root,"dist/manifest.webmanifest"));
await copyFile(resolve(root,"public/sw.js"),resolve(root,"dist/sw.js"));
const bytes=(await stat(resolve(root,"dist/index.html"))).size;
console.log(`Built dist/index.html: ${(bytes/1024).toFixed(1)} KiB, self-contained UI with embedded original logo.`);
console.log("Videos require an internet connection. No fonts or third-party video files are bundled.");
