import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {packCatalog} from '../../tools/qb-webui-catalog.mjs';
import {applyLocaleOverlay,applyLocaleOverlaySubset} from '../../tools/qb-locale-overlay.mjs';
import {writeSimulatorRuntimeShards} from './runtime-shards.mjs';
import {materializeCssBundles} from '../../tools/css-bundle-materializer.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../..');
function arg(name,fallback){const prefix=`--${name}=`;const hit=process.argv.find(x=>x.startsWith(prefix));return hit?hit.slice(prefix.length):fallback;}
const branch=arg('branch','dev'),exactSha=arg('exact-sha','unknown'),productVersion=arg('product-version','unknown'),simulatorSha=arg('simulator-sha','unknown'),webuiRoot=path.resolve(projectRoot,arg('webui-root','webui')),out=path.resolve(projectRoot,arg('out',`dist/${branch}/app`)),catalogPath=path.resolve(projectRoot,arg('catalog','simulator/versions/catalog.bootstrap.json')),translatorBehaviorPath=path.resolve(projectRoot,arg('translator-behavior','tools/data/qb-translator-behavior-lkg.json')),localeOverlayPath=path.resolve(projectRoot,arg('locale-overlay','tools/data/qb-locale-lkg.json'));
async function exists(file){try{await fs.access(file);return true;}catch{return false;}}
async function copyDir(from,to){await fs.mkdir(path.dirname(to),{recursive:true});await fs.cp(from,to,{recursive:true,force:true});}
const workerRefreshScript=`<script data-weig-virtual-sw-refresh>(function(){if(!('serviceWorker'in navigator))return;var reloading=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(reloading)return;reloading=true;location.reload();});navigator.serviceWorker.getRegistration().then(function(registration){if(registration)return registration.update();}).catch(function(){});})();</script>`;
async function prepareIndex(file){let html=await fs.readFile(file,'utf8');html=html.replaceAll('__WEIG_GIT_SHA__',exactSha);if(!html.includes('data-weig-virtual-sw-refresh')){if(!html.includes('</body>'))throw new Error(`Unable to install Virtual Pages worker refresh hook in ${file}`);html=html.replace('</body>',`${workerRefreshScript}</body>`);}await fs.writeFile(file,html,'utf8');}
async function bootstrapAssets(privateRoot,html,{allowLegacy=false}={}){
  const planPath=path.join(privateRoot,'bootstrap-plan.json');
  if(await exists(planPath)){
    const plan=JSON.parse(await fs.readFile(planPath,'utf8'));
    if(plan?.schemaVersion!==1||!Array.isArray(plan.styles)||!Array.isArray(plan.phases))throw new Error('Invalid canonical private bootstrap plan.');
    const out=['scripts/runtime-assets.js'];
    for(const item of plan.styles){const value=String(item||'').trim();if(value&&!out.includes(value))out.push(value);}
    for(const phase of plan.phases||[]){if(!phase||!Array.isArray(phase.scripts))throw new Error('Invalid bootstrap dependency phase.');for(const item of phase.scripts){const value=String(item||'').trim();if(value&&!out.includes(value))out.push(value);}}
    return out;
  }
  if(!allowLegacy)throw new Error('Canonical private bootstrap plan is required.');
  const out=[];
  for(const name of ['styles','scripts']){
    const match=String(html||'').match(new RegExp(`var ${name}=(\\[[^;]+\\])`));
    if(!match)continue;
    const items=JSON.parse(match[1]);
    if(Array.isArray(items))for(const item of items){const value=String(item||'').trim();if(value&&!out.includes(value))out.push(value);}
  }
  return out;
}
async function prepareQbtEmulator(){
  const sourcePath=path.join(here,'qbt-tr-emulator.mjs'),targetRoot=path.join(out,'__simulator'),sharedSource=path.join(projectRoot,'tools/qb-source-text.mjs');
  let source=await fs.readFile(sourcePath,'utf8');
  const sourceImport="../../tools/qb-source-text.mjs";
  if(!source.includes(sourceImport))throw new Error('Virtual Pages qBT emulator shared source-text import anchor changed');
  source=source.replace(sourceImport,'./qb-source-text.mjs');
  await fs.mkdir(targetRoot,{recursive:true});
  await fs.writeFile(path.join(targetRoot,'qbt-tr-emulator.mjs'),source,'utf8');
  await fs.copyFile(sharedSource,path.join(targetRoot,'qb-source-text.mjs'));
}
async function simulatorCatalogWithLocaleFacts(){
  if(!(await exists(localeOverlayPath)))throw new Error(`Missing locale overlay evidence: ${localeOverlayPath}`);
  const raw=(await fs.readFile(catalogPath,'utf8')).replace(/\r\n?/g,'\n');
  const catalog=JSON.parse(raw);
  const hasExactLocaleFacts=Array.isArray(catalog)&&catalog.length>0&&catalog.every(profile=>Array.isArray(profile?.webuiLocales)&&profile.webuiLocales.length>0);
  if(hasExactLocaleFacts)return catalog;
  const overlay=JSON.parse(await fs.readFile(localeOverlayPath,'utf8'));
  const isFull=Number(overlay.profileCount)===catalog.length
    &&String(overlay.supportFloor||'')===String(catalog[0]?.qbVersion||'')
    &&String(overlay.latestAdmittedStable||'')===String(catalog.at(-1)?.qbVersion||'');
  if(isFull){
    const catalogSha256=crypto.createHash('sha256').update(Buffer.from(raw,'utf8')).digest('hex');
    return applyLocaleOverlay(catalog,overlay,{catalogSha256});
  }
  return applyLocaleOverlaySubset(catalog,overlay);
}
async function writeVersionedServiceWorker(){
  const templatePath=path.join(projectRoot,'simulator/service-worker/service-worker.js');
  let source=await fs.readFile(templatePath,'utf8');
  if(!source.includes('__WEIG_GIT_SHA__'))throw new Error('Virtual Pages Service Worker exact-SHA placeholder is missing');
  source=source.replaceAll('__WEIG_GIT_SHA__',exactSha);
  await fs.writeFile(path.join(out,'service-worker.js'),source,'utf8');
}
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const privateRoot=path.join(webuiRoot,'private'),publicRoot=path.join(webuiRoot,'public');
if(!(await exists(privateRoot))||!(await exists(publicRoot)))throw new Error(`Missing webui roots under ${webuiRoot}`);
if(!(await exists(translatorBehaviorPath)))throw new Error(`Missing translator behavior evidence: ${translatorBehaviorPath}`);
await copyDir(privateRoot,path.join(out,'__source/private'));
await copyDir(publicRoot,path.join(out,'__source/public'));
if(branch==='main'){
  await fs.mkdir(path.join(out,'__source/private/data'),{recursive:true});
  packCatalog(catalogPath,path.join(out,'__source/private/data/qb-releases.json'));
}else{
  const dataRoot=path.join(webuiRoot,'private/data'),translations=path.join(webuiRoot,'translations');
  for(const name of ['qb-copy-routes','qb-copy-bindings','qb-copy-fallback'])if(!(await exists(path.join(dataRoot,name))))throw new Error('Dev WebUI source is missing sharded qB-owned copy runtime: '+name);
  if(await exists(path.join(dataRoot,'qb-settings-native.txt')))throw new Error('Dev WebUI source retained retired all-version qB copy registry.');
  if(!(await exists(translations)))throw new Error('Dev WebUI source is missing checked-in official qB WebUI QM assets.');
  if(await exists(path.join(webuiRoot,'private/scripts/release-profile.js')))throw new Error('Dev WebUI source retained retired release-profile.js.');
  if(await exists(path.join(dataRoot,'qb-releases.json'))||await exists(path.join(dataRoot,'qb-release-profiles')))throw new Error('Dev WebUI source retained retired release-profile runtime data.');
  await copyDir(translations,path.join(out,'__source/translations'));
}
await prepareIndex(path.join(out,'__source/private/index.html'));
if(branch==='dev')materializeCssBundles(path.join(out,'__source/private'));
await prepareIndex(path.join(out,'__source/public/index.html'));
for(const dir of ['core','data','preferences','protocol','storage','versions'])await copyDir(path.join(projectRoot,'simulator',dir),path.join(out,'__simulator',dir));
await prepareQbtEmulator();
await fs.copyFile(translatorBehaviorPath,path.join(out,'__simulator/versions/qb-translator-behavior-lkg.json'));
await fs.copyFile(catalogPath,path.join(out,'__simulator/versions/catalog.source.json'));
const simulatorCatalog=await simulatorCatalogWithLocaleFacts();
await fs.writeFile(path.join(out,'__simulator/versions/catalog.generated.json'),JSON.stringify(simulatorCatalog,null,2)+'\n','utf8');
const runtimeShardMeta=await writeSimulatorRuntimeShards({catalog:simulatorCatalog,out:path.join(out,'__simulator/runtime')});
const privateIndexText=await fs.readFile(path.join(out,'__source/private/index.html'),'utf8'),prewarmAssets=await bootstrapAssets(path.join(out,'__source/private'),privateIndexText,{allowLegacy:branch==='main'});
if(branch==='dev'&&!prewarmAssets.length)throw new Error('Unable to derive private bootstrap prewarm assets from the canonical WebUI bootstrap.');
await fs.writeFile(path.join(out,'__simulator/runtime/private-prewarm.json'),JSON.stringify({schemaVersion:1,assets:prewarmAssets})+'\n','utf8');
await writeVersionedServiceWorker();
const bootstrap=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>WeiG Virtual qB Lab</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#05070d;color:#e8edf7;font:15px/1.5 system-ui,sans-serif}main{max-width:560px;padding:24px;text-align:center}small{display:block;color:#8d99b4;margin-top:8px}</style></head><body><main><strong>Starting WeiG Virtual qB Lab…</strong><small>Branch: ${branch}. Installing the local Virtual qB Service Worker.</small></main><script>(async()=>{if(!('serviceWorker'in navigator)){document.body.textContent='Service Worker is required.';return}await navigator.serviceWorker.register('./service-worker.js',{scope:'./',type:'module'});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));location.reload()})().catch(error=>{document.body.textContent='Virtual qB startup failed: '+error})</script></body></html>`;
await fs.writeFile(path.join(out,'index.html'),bootstrap,'utf8');
const meta={branch,exactSha,productVersion,simulatorSha,builtAt:new Date().toISOString(),catalog:path.relative(projectRoot,catalogPath).replaceAll('\\','/'),localeOverlay:path.relative(projectRoot,localeOverlayPath).replaceAll('\\','/'),translatorBehavior:path.relative(projectRoot,translatorBehaviorPath).replaceAll('\\','/'),qbtEmulation:'validation-only/source-derived',settingsTranslationRouting:'semantic-route-binding-content-pack/native-QM/exact-fallback',runtimeShards:{schemaVersion:runtimeShardMeta.schemaVersion,profiles:runtimeShardMeta.profiles.length,prewarmAssets:prewarmAssets.length},productSource:branch==='dev'?'webui/** copied as the self-contained compact runtime; the full 65-release source catalog remains simulator-only evidence':'historical main preview materializes its legacy release-profile runtime from simulator-only source evidence',webuiModified:false,pagesAdapted:true};
await fs.writeFile(path.join(out,'virtual-qb-build.json'),JSON.stringify(meta,null,2)+'\n','utf8');
console.log(`Built WeiG Virtual qB app: ${branch}@${exactSha} -> ${out}`);
