import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let html=await fs.readFile(new URL('portal.html',root),'utf8');
const css=await fs.readFile(new URL('style.css',root),'utf8');
const exporter=await fs.readFile(new URL('export-xlsx.js',root),'utf8');
const js=await fs.readFile(new URL('app.js',root),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
  .replace('<body>','<body data-page="<?= page ?>" style="visibility:hidden">')
  .replace('<script src="config.js"></script><script src="app.js"></script>',`<script>window.SCHOOL_CONFIG={appsScript:true};</script><script>${exporter}</script><script>${js}</script>`);
const gate=`<script>
const nonce=crypto.randomUUID();
window.addEventListener('message',e=>{if(e.origin==='https://coolmanx88.github.io'&&e.source===window.top&&e.data?.type==='school-embed-ok'&&e.data.nonce===nonce)document.body.style.visibility='visible';});
window.top.postMessage({type:'school-embed-ready',nonce},'https://coolmanx88.github.io');
</script>`;
html=html.replace('</body>',gate+'</body>');
await fs.writeFile(new URL('apps-script/Portal.html',root),html);
console.log('Apps Script Portal built.');
