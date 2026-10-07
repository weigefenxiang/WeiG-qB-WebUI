import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from './browser-driver.mjs';
import {recoverPageSession} from './pages-live-session.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'weig-a62-route-browser-')),appRoot=path.join(temp,'app');
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),exactSha=/^[0-9a-f]{40}$/i.test(String(process.env.GITHUB_SHA||''))?process.env.GITHUB_SHA:'a'.repeat(40);
const build=spawnSync(process.execPath,[path.join(root,'simulator/build/build-pages.mjs'),'--branch=dev',`--webui-root=${path.join(root,'webui')}`,`--out=${appRoot}`,`--catalog=${path.join(root,'tests/fixtures/qb-release-catalog.lkg.json')}`,`--exact-sha=${exactSha}`,`--product-version=${version}`,`--simulator-sha=${exactSha}`],{cwd:root,encoding:'utf8'});
if(build.status!==0)throw new Error(`A62 route browser fixture build failed:\n${build.stdout}\n${build.stderr}`);

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const host='127.0.0.1',counts=new Map();
const server=http.createServer((req,res)=>{try{
  const url=new URL(req.url,`http://${host}`),pathname=decodeURIComponent(url.pathname);counts.set(pathname,(counts.get(pathname)||0)+1);
  if(!pathname.startsWith('/app/')){res.writeHead(404);res.end('not found');return;}
  const relative=pathname.slice('/app/'.length)||'index.html',file=path.resolve(appRoot,relative);
  if(!(file===appRoot||file.startsWith(appRoot+path.sep))){res.writeHead(403);res.end('forbidden');return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-cache'});
  res.end(fs.readFileSync(file));
}catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,host,resolve);});
const port=server.address().port,base=`http://${host}:${port}/app/`,timeoutMs=30000;

const browser=await launchBrowser();
try{
  const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage(),errors=[],httpErrors=[],requestErrors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  page.on('console',message=>{const text=message.text();if(message.type()==='error'&&!/Failed to load resource/i.test(text)&&!/favicon|Wei\.G\.ico/i.test(text))errors.push(text);});
  page.on('response',response=>{const status=response.status(),url=response.url();if(status>=400&&!/\/api\/v2\//.test(url))httpErrors.push(status+' '+url);});
  page.on('requestfailed',request=>{const url=request.url();if(!/\/api\/v2\//.test(url))requestErrors.push((request.failure()?.errorText||'request failed')+' '+url);});
  const url=new URL(base);url.search=new URLSearchParams({sim:'a62-route-modules',qb:'5.2.3',count:'24',scenario:'mixed',seed:'a62-route-modules',clean:'0'}).toString();
  await recoverPageSession(page,{label:'A62 local route-module browser',qbVersion:'5.2.3',timeoutMs,navigate:async attempt=>{const target=new URL(url);target.searchParams.set('__weig_session_attempt',String(attempt));await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});},onLogin:async()=>{await page.locator('#login-btn').click();}});
  await page.waitForSelector('#torrent-list',{timeout:timeoutMs});

  async function cacheUrls(){return page.evaluate(async sha=>{const name='weig-virtual-static-'+sha,cache=await caches.open(name);return(await cache.keys()).map(request=>request.url);},exactSha);}
  const sourcePath=name=>`/app/__source/private/scripts/${name}.js`,routeNames=['settings','rss','logs'];
  const initial=await cacheUrls();
  for(const name of routeNames){assert.equal(initial.some(url=>new URL(url).pathname===sourcePath(name)),false,`home startup must not cache/fetch route-only ${name}.js`);assert.equal(counts.get(sourcePath(name))||0,0,`home startup reached network for route-only ${name}.js`);}
  assert.equal(initial.some(url=>/\/private\/data\/qb-settings-native\.txt(?:\?|$)/.test(url)),false,'retired all-version qB copy registry must never be fetched');
  assert.equal(initial.some(url=>url.includes('/qb-copy-profiles/')),false,'retired sourceSha copy-profile pointer must never be fetched');
  const copyRoutes=initial.filter(url=>url.includes('/qb-copy-routes/')),copyBindings=initial.filter(url=>url.includes('/qb-copy-bindings/')),fallbackPacks=initial.filter(url=>url.includes('/qb-copy-fallback/'));
  assert.equal(copyRoutes.length,1,'startup must fetch exactly one semantic qB copy route');assert.match(new URL(copyRoutes[0]).pathname,/\/private\/data\/qb-copy-routes\/r[0-9a-f]{20}\.json\.gz$/);
  assert.equal(copyBindings.length,1,'startup must fetch exactly one deduplicated qB copy binding');assert.match(new URL(copyBindings[0]).pathname,/\/private\/data\/qb-copy-bindings\/b[0-9a-f]{20}\.txt$/);
  assert.equal(fallbackPacks.length,1,'qB 5.2.3 zh-CN must fetch at most one current-locale fallback pack');assert.match(new URL(fallbackPacks[0]).pathname,/\/private\/data\/qb-copy-fallback\/p[0-9a-f]{20}\.json\.gz$/);assert.equal(fallbackPacks.some(url=>url.includes('/qb-copy-fallback/4/')||url.includes('/qb-copy-fallback/5/')),false,'physical qB major fallback ownership must stay retired');
  const weigLocales=initial.filter(url=>url.includes('/data/weig-i18n/'));assert.equal(weigLocales.length,1);assert.ok(weigLocales[0].includes('/zh-CN.json'),'startup must fetch only current WeiG locale overlay');
  assert.equal(initial.some(url=>/\/translations\/webui_.+\.qm(?:\?|$)/i.test(url)),false,'browser must not download/parse qB QM assets');

  await page.locator('#app-nav [data-route="settings"]').click();
  await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{timeout:timeoutMs});
  let urls=await cacheUrls();assert.equal(urls.filter(url=>new URL(url).pathname===sourcePath('settings')).length,1);assert.equal(counts.get(sourcePath('settings')),1);for(const name of ['rss','logs'])assert.equal(counts.get(sourcePath(name))||0,0);
  await page.evaluate(()=>window.WeiG.Router.home());await page.waitForFunction(()=>document.getElementById('list-view')?.classList.contains('is-active'));

  await page.locator('#app-nav [data-route="rss"]').click();await page.waitForFunction(()=>window.WeiG?.RSSWorkspace&&document.getElementById('rss-view')?.classList.contains('is-active'),null,{timeout:timeoutMs});
  urls=await cacheUrls();assert.equal(urls.filter(url=>new URL(url).pathname===sourcePath('rss')).length,1);assert.equal(counts.get(sourcePath('rss')),1);
  await page.evaluate(()=>window.WeiG.Router.home());await page.waitForFunction(()=>document.getElementById('list-view')?.classList.contains('is-active'));

  await page.locator('#app-nav [data-route="logs"]').click();await page.waitForFunction(()=>window.WeiG?.Logs&&document.getElementById('logs-view')?.classList.contains('is-active'),null,{timeout:timeoutMs});await page.waitForSelector('#logs-content [data-weig-log-shell]',{timeout:timeoutMs});
  urls=await cacheUrls();assert.equal(urls.filter(url=>new URL(url).pathname===sourcePath('logs')).length,1);assert.equal(counts.get(sourcePath('logs')),1);

  await page.evaluate(()=>window.WeiG.Router.go('settings'));await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{timeout:timeoutMs});
  const scriptNodes=await page.evaluate(()=>Object.fromEntries(['settings','rss','logs'].map(name=>[name,document.querySelectorAll(`script[data-weig-runtime-module="scripts/${name}.js"]`).length])));
  assert.deepEqual(scriptNodes,{settings:1,rss:1,logs:1},'same-page route revisits must reuse one dynamic script owner per module');
  assert.deepEqual(Object.fromEntries(routeNames.map(name=>[name,counts.get(sourcePath(name))||0])),{settings:1,rss:1,logs:1},'same-page route revisits must not refetch module source');

  await page.reload({waitUntil:'domcontentloaded',timeout:timeoutMs});await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{timeout:timeoutMs});
  assert.deepEqual(Object.fromEntries(routeNames.map(name=>[name,counts.get(sourcePath(name))||0])),{settings:1,rss:1,logs:1},'warm reload must reuse exact-SHA CacheStorage instead of refetching route-module source');
  const warm=await cacheUrls();assert.deepEqual((await page.evaluate(async()=>await caches.keys())).filter(key=>key.startsWith('weig-virtual-static-')),[`weig-virtual-static-${exactSha}`]);assert.equal(warm.filter(url=>url.includes('/data/weig-i18n/')).length,1);const warmFallback=warm.filter(url=>url.includes('/qb-copy-fallback/'));assert.equal(warmFallback.length,1);assert.match(new URL(warmFallback[0]).pathname,/\/private\/data\/qb-copy-fallback\/p[0-9a-f]{20}\.json\.gz$/);
  assert.deepEqual(httpErrors,[],`A62 route-module browser received failing static responses:\n${httpErrors.join('\n')}`);assert.deepEqual(requestErrors,[],`A62 route-module browser had failed static requests:\n${requestErrors.join('\n')}`);assert.deepEqual(errors,[],`A62 route-module browser emitted JavaScript/console errors:\n${errors.join('\n')}`);
  console.log(`A62 route-module browser passed for ${exactSha}: home loads zero Settings/RSS/Logs modules, each route loads exactly once, and warm reload reuses exact-SHA cache with one qB/WeiG locale shard.`);
  await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
