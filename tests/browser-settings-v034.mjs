import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../webui/private');
const host = '127.0.0.1';
const port = 8767;
const variants = {
  qb4: { qb: 'v4.1.9.1', api: '2.2.1' },
  qb5: { qb: 'v5.2.0', api: '2.15.1' },
};
const hostPath = '/root/qbittorrent3/config/weigg-qb-webui';
const qbPath = '/config/weigg-qb-webui';
const state = Object.fromEntries(Object.keys(variants).map(name => [name, {
  prefs: {
    alternative_webui_enabled: true,
    alternative_webui_path: qbPath,
    web_ui_port: 8080,
    web_ui_username: 'admin',
    web_ui_upnp: false,
  },
  writes: [],
}]));

function assert(condition, message) { if (!condition) throw new Error(message); }
function writeJson(res, value) {
  res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  res.end(JSON.stringify(value));
}
function writeText(res, value) {
  res.writeHead(200, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'});
  res.end(String(value));
}
async function readBody(req) {
  const chunks=[];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
async function handleApi(req, res, name, apiPath) {
  const variant=variants[name], local=state[name];
  if (apiPath === 'app/version') return writeText(res, variant.qb);
  if (apiPath === 'app/webapiVersion') return writeText(res, variant.api);
  if (apiPath === 'app/preferences' && req.method === 'GET') return writeJson(res, local.prefs);
  if (apiPath === 'app/setPreferences' && req.method === 'POST') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    const payload = JSON.parse(params.get('json') || '{}');
    local.writes.push(payload);
    Object.assign(local.prefs, payload);
    res.writeHead(200, {'cache-control':'no-store'}); return res.end('');
  }
  if (apiPath === 'transfer/info') return writeJson(res, {dl_info_speed:0,up_info_speed:0,connection_status:'connected',dht_nodes:0,total_peer_connections:0});
  if (apiPath === 'torrents/info') return writeJson(res, []);
  if (apiPath === 'torrents/categories') return writeJson(res, {});
  if (apiPath === 'torrents/tags') return writeJson(res, []);
  if (apiPath === 'rss/items') return writeJson(res, {});
  if (apiPath === 'search/plugins') return writeJson(res, []);
  if (apiPath === 'sync/maindata') return writeJson(res, {rid:1,full_update:true,torrents:{},server_state:{connection_status:'connected'}});
  return writeJson(res, {});
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${host}:${port}`);
    const match=url.pathname.match(/^\/(qb4|qb5)(?:\/(.*))?$/);
    if(!match){res.writeHead(404);return res.end('not found');}
    const name=match[1],relative=match[2]||'';
    if(relative.startsWith('api/v2/'))return await handleApi(req,res,name,relative.slice(7));
    if(relative==='weigg-install.json')return writeJson(res,{version:'0.3.4',container:'qbittorrent3',qbPath,hostPath,installedAt:'2026-08-31T08:00:00Z',installer:'linux'});
    const requested=relative||'index.html';
    const file=path.resolve(webRoot,requested);
    if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}
    const body=await fs.readFile(file);
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const browser=await chromium.launch({headless:true});
try{
  for(const name of Object.keys(variants)){
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    const errors=[];
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://${host}:${port}/${name}/#/settings`,{waitUntil:'networkidle'});
    await page.locator('[data-settings-tab="webui"]').click();
    await page.waitForSelector('#alternative-webui-v034');

    const initial=await page.evaluate(()=>({
      enabled:document.querySelector('#alternative-webui-v034 .alt-webui-v034__toggle')?.checked,
      path:document.querySelector('#alternative-webui-v034 .alt-webui-v034__path')?.value,
      text:document.querySelector('#alternative-webui-v034')?.textContent||'',
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth,
    }));
    assert(initial.enabled===true,`${name}: Alternative WebUI toggle not enabled`);
    assert(initial.path===qbPath,`${name}: expected qB path ${qbPath}, got ${initial.path}`);
    assert(initial.text.includes(hostPath),`${name}: host path metadata not shown`);
    assert(initial.text.includes('0.3.4'),`${name}: installed version not shown`);
    assert(initial.scrollWidth<=initial.innerWidth+1,`${name}: settings horizontal overflow`);

    await page.locator('[data-settings-tab="advanced"]').click();
    await page.waitForTimeout(80);
    const duplicateVisible=await page.evaluate(()=>[...document.querySelectorAll('#settings-content .settings-row')].some(row=>['alternative_webui_enabled','alternative_webui_path'].includes(row.dataset.key)&&!row.hidden));
    assert(!duplicateVisible,`${name}: Alternative WebUI preferences duplicated in Advanced`);
    await page.locator('[data-settings-tab="webui"]').click();
    await page.waitForSelector('#alternative-webui-v034');

    const writesBeforeMistake=state[name].writes.length;
    await page.locator('#alternative-webui-v034 .alt-webui-v034__path').fill(hostPath);
    await page.locator('#save-settings-btn').click();
    await page.waitForTimeout(120);
    assert(state[name].writes.length===writesBeforeMistake,`${name}: host path mistake was sent to qBittorrent`);

    const changedPath='/config/weigg-qb-webui-alt';
    await page.locator('#alternative-webui-v034 .alt-webui-v034__path').fill(changedPath);
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#save-settings-btn').click();
    await page.waitForFunction(expected=>document.querySelector('#alternative-webui-v034 .alt-webui-v034__path')?.value===expected,changedPath);
    assert(state[name].prefs.alternative_webui_path===changedPath,`${name}: valid qB path not saved`);
    assert(state[name].writes.some(x=>x.alternative_webui_path===changedPath),`${name}: path write payload missing`);

    await page.locator('#alternative-webui-v034 .alt-webui-v034__toggle').uncheck();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#save-settings-btn').click();
    await page.waitForFunction(()=>location.pathname==='/' || document.body.textContent.includes('not found'),null,{timeout:2500}).catch(()=>{});
    assert(state[name].prefs.alternative_webui_enabled===false,`${name}: disable preference not saved`);
    assert(state[name].writes.some(x=>x.alternative_webui_enabled===false),`${name}: disable write payload missing`);
    assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);
    await page.close();
  }
  console.log('v0.3.4 Alternative WebUI browser regression passed for qB 4.1.9.1 and 5.2.0 fixtures.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
