import fs from 'node:fs';
const required=['webui/public/login.html','webui/private/index.html','webui/private/css/app.css','webui/private/scripts/core.js','webui/private/scripts/qb-client.js','webui/private/scripts/components.js','webui/private/scripts/app.js'];
for(const f of required){if(!fs.existsSync(f))throw new Error(`Missing ${f}`)}
const index=fs.readFileSync('webui/private/index.html','utf8');
for(const id of ['torrent-list','back-btn','fatal-home','prev-btn','next-btn']){if(!index.includes(`id="${id}"`))throw new Error(`Missing required recovery/performance UI: ${id}`)}
const qb=fs.readFileSync('webui/private/scripts/qb-client.js','utf8');
for(const token of ["'resume','start'","'pause','stop'",'limit','offset']){if(!qb.includes(token))throw new Error(`Compatibility token missing: ${token}`)}
const css=fs.readFileSync('webui/private/css/app.css','utf8');
if(!css.includes('prefers-reduced-motion'))throw new Error('Reduced motion support missing');
if(/https?:\/\//.test(index+css))throw new Error('Runtime UI must not depend on external assets');
console.log('WeiG qB WebUI smoke checks passed.');
