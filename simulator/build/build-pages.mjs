import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../..');
function arg(name,fallback){const prefix=`--${name}=`;const hit=process.argv.find(x=>x.startsWith(prefix));return hit?hit.slice(prefix.length):fallback}
const branch=arg('branch','dev');
const exactSha=arg('exact-sha','unknown');
const productVersion=arg('product-version','unknown');
const simulatorSha=arg('simulator-sha','unknown');
const webuiRoot=path.resolve(projectRoot,arg('webui-root','webui'));
const out=path.resolve(projectRoot,arg('out',`dist/${branch}/app`));
const catalogPath=path.resolve(projectRoot,arg('catalog','simulator/versions/catalog.bootstrap.json'));
async function exists(file){try{await fs.access(file);return true}catch{return false}}
async function copyDir(from,to){await fs.mkdir(path.dirname(to),{recursive:true});await fs.cp(from,to,{recursive:true,force:true})}

await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const privateRoot=path.join(webuiRoot,'private'),publicRoot=path.join(webuiRoot,'public');
if(!(await exists(privateRoot))||!(await exists(publicRoot)))throw new Error(`Missing webui roots under ${webuiRoot}`);
await copyDir(privateRoot,path.join(out,'__source/private'));await copyDir(publicRoot,path.join(out,'__source/public'));
for(const dir of ['core','protocol','storage','versions'])await copyDir(path.join(projectRoot,'simulator',dir),path.join(out,'__simulator',dir));
await fs.copyFile(path.join(projectRoot,'simulator/service-worker/service-worker.js'),path.join(out,'service-worker.js'));
await fs.copyFile(catalogPath,path.join(out,'__simulator/versions/catalog.generated.json'));

const bootstrap=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>WeiG Virtual qB Lab</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#05070d;color:#e8edf7;font:15px/1.5 system-ui,sans-serif}main{max-width:560px;padding:24px;text-align:center}small{display:block;color:#8d99b4;margin-top:8px}</style></head><body><main><strong>Starting WeiG Virtual qB Lab…</strong><small>Branch: ${branch}. Installing the local Virtual qB Service Worker.</small></main><script>(async()=>{if(!('serviceWorker'in navigator)){document.body.textContent='Service Worker is required.';return}await navigator.serviceWorker.register('./service-worker.js',{scope:'./',type:'module'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));location.reload()})().catch(error=>{document.body.textContent='Virtual qB startup failed: '+error})</script></body></html>`;
await fs.writeFile(path.join(out,'index.html'),bootstrap,'utf8');
const meta={branch,exactSha,productVersion,simulatorSha,builtAt:new Date().toISOString(),catalog:path.relative(projectRoot,catalogPath).replaceAll('\\','/'),productSource:'webui/** copied verbatim into __source',webuiModified:false};
await fs.writeFile(path.join(out,'virtual-qb-build.json'),JSON.stringify(meta,null,2)+'\n','utf8');
console.log(`Built WeiG Virtual qB app: ${branch}@${exactSha} -> ${out}`);
