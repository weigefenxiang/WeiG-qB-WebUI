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
  qb46: { qb: 'v4.6.7', api: '2.8.3' },
  qb5: { qb: 'v5.2.0', api: '2.15.1' },
};
const viewports = [
  {width:390,height:844,label:'mobile'},
  {width:1366,height:768,label:'desktop'},
  {width:1920,height:1080,label:'wide'},
];
const hostPath = '/srv/qb-fixture/config/weigg-qb-webui';
const qbPath = '/config/weigg-qb-webui';
const gitSha = '1234567890abcdef1234567890abcdef12345678';
function initialState(){return {
  prefs: {
    alternative_webui_enabled: true,
    alternative_webui_path: qbPath,
    web_ui_port: 8080,
    web_ui_username: 'admin',
    web_ui_upnp: false,
    web_ui_csrf_protection_enabled:true,
    web_ui_clickjacking_protection_enabled:true,
    web_ui_host_header_validation_enabled:true,
  },
  writes: [],
};}
const state = Object.fromEntries(Object.keys(variants).map(name => [name, initialState()]));

function reset(name){state[name]=initialState();}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function openSettingsTab(page,viewport,tab){
  if(viewport.width<=820){
    await page.waitForFunction(()=>!!(window.WeiG&&WeiG.V037));
    await page.locator('#menu-btn').click();
    const item=page.locator(`.v037-mobile-settings-nav [data-mobile-settings-tab="${tab}"]`);
    await item.waitFor({state:'visible'});
    await item.click();
    return;
  }
  await page.locator(`#settings-tabs [data-settings-tab="${tab}"]`).click();
}
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
  if (apiPath === 'transfer/speedLimitsMode') return writeText(res, '0');
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
    if(url.pathname==='/'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      return res.end('<!doctype html><title>qBittorrent WebUI</title><p>Built-in qBittorrent WebUI</p>');
    }
    const match=url.pathname.match(/^\/(qb4|qb46|qb5)(?:\/(.*))?$/);
    if(!match){res.writeHead(404);return res.end('not found');}
    const name=match[1],relative=match[2]||'';
    if(relative.startsWith('api/v2/'))return await handleApi(req,res,name,relative.slice(7));
    if(relative==='weigg-install.json')return writeJson(res,{version:'0.3.6',gitSha,container:'fixture-qb',qbPath,hostPath,installedAt:'2026-08-31T09:00:00Z',installer:'fixture'});
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
    for(const viewport of viewports){
      const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
      const errors=[];
      page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
      page.on('pageerror',error=>errors.push(String(error)));
      await page.goto(`http://${host}:${port}/${name}/#/settings`,{waitUntil:'networkidle'});
      await openSettingsTab(page,viewport,'webui');
      await page.waitForSelector('#settings-content [data-v035-alt="1"][data-setting-key="alternative_webui_enabled"]');
      await page.waitForFunction(()=>[...document.querySelectorAll('#settings-content [data-v035-alt="1"]')].every(x=>x.classList.contains('settings-row--canonical')));
      const layout=await page.evaluate(()=>{
        const group=document.querySelector('#settings-content .settings-group');
        const cards=[...document.querySelectorAll('#settings-content [data-v035-alt="1"]')];
        const enabled=document.querySelector('#settings-content [data-setting-key="alternative_webui_enabled"]');
        const path=document.querySelector('#settings-content [data-setting-key="alternative_webui_path"]');
        const host=document.querySelector('#settings-content [data-setting-key="weigg_host_path"]');
        const version=document.querySelector('#settings-content [data-setting-key="weigg_version"]');
        const sha=document.querySelector('#settings-content [data-setting-key="weigg_git_sha"]');
        const groupRect=group?.getBoundingClientRect();
        const enabledRect=enabled?.getBoundingClientRect();
        const pathRect=path?.getBoundingClientRect();
        const metrics=cards.map(card=>{
          const style=getComputedStyle(card),copy=card.querySelector('.settings-row__copy'),control=card.querySelector('.field-input,.switch-control,.ui-select');
          const copyStyle=copy?getComputedStyle(copy):null,controlStyle=control?getComputedStyle(control):null;
          return {key:card.dataset.settingKey||'',height:card.getBoundingClientRect().height,display:style.display,columns:style.gridTemplateColumns,padding:`${style.paddingTop}/${style.paddingBottom}`,gap:style.gap,copyHeight:copy?.getBoundingClientRect().height||0,copyDisplay:copyStyle?.display||'',controlHeight:control?.getBoundingClientRect().height||0,controlWidth:control?.getBoundingClientRect().width||0,controlDisplay:controlStyle?.display||''};
        });
        const heights=metrics.map(x=>x.height);
        return {
          cardCount:cards.length,
          semanticCanonical:cards.every(card=>card.classList.contains('setting-card')&&card.classList.contains('settings-row')),
          rowCanonical:cards.every(card=>card.classList.contains('settings-row--canonical')),
          sectionCanonical:group?.classList.contains('settings-section--rows'),
          legacyVisual:document.querySelectorAll('[class*="alt-webui-v034__"]').length,
          enabledChecked:enabled?.querySelector('.switch-input')?.checked,
          pathValue:path?.querySelector('.field-input')?.value,
          hostValue:host?.querySelector('.field-input')?.value,
          versionValue:version?.querySelector('.field-input')?.value,
          shaValue:sha?.querySelector('.field-input')?.value,
          readonlyCount:cards.filter(card=>card.dataset.settingReadonly==='true').length,
          ratio:groupRect&&enabledRect?enabledRect.width/groupRect.width:0,
          pathRatio:groupRect&&pathRect?pathRect.width/groupRect.width:0,
          enabledWidth:enabledRect?.width||0,
          pathWidth:pathRect?.width||0,
          enabledCenterDelta:groupRect&&enabledRect?Math.abs((enabledRect.left-groupRect.left)-(groupRect.right-enabledRect.right)):999,
          pathCenterDelta:groupRect&&pathRect?Math.abs((pathRect.left-groupRect.left)-(groupRect.right-pathRect.right)):999,
          maxHeight:heights.length?Math.max(...heights):999,
          minHeight:heights.length?Math.min(...heights):0,
          metrics,
          scrollWidth:document.documentElement.scrollWidth,
          innerWidth,
          settingsCss:[...document.styleSheets].some(s=>String(s.href||'').includes('settings-v034.css')),
        };
      });
      assert(layout.cardCount>=6,`${name}/${viewport.label}: expected Alternative WebUI + metadata canonical rows`);
      assert(layout.semanticCanonical,`${name}/${viewport.label}: Alternative WebUI lost canonical setting semantics`);
      assert(layout.rowCanonical,`${name}/${viewport.label}: Alternative WebUI rows are not normalized by Responsive UI System`);
      assert(layout.sectionCanonical,`${name}/${viewport.label}: Settings group is not one canonical row-based section`);
      assert(layout.legacyVisual===0,`${name}/${viewport.label}: legacy Alternative WebUI visual classes still exist`);
      assert(layout.enabledChecked===true,`${name}/${viewport.label}: Alternative WebUI toggle not enabled`);
      assert(layout.pathValue===qbPath,`${name}/${viewport.label}: expected qB path ${qbPath}, got ${layout.pathValue}`);
      assert(layout.hostValue===hostPath,`${name}/${viewport.label}: host path metadata not shown`);
      assert(layout.versionValue==='0.3.6',`${name}/${viewport.label}: installed version not shown`);
      assert(layout.shaValue===gitSha,`${name}/${viewport.label}: Git SHA not shown`);
      assert(layout.readonlyCount>=4,`${name}/${viewport.label}: installer metadata must use canonical readonly rows`);
      if(viewport.width<=820){
        assert(layout.ratio>0.94&&layout.pathRatio>0.94,`${name}/${viewport.label}: compact mobile Settings rows must span the coherent section (${layout.ratio}/${layout.pathRatio})`);
      }else{
        assert(layout.enabledWidth<=825&&layout.pathWidth<=825,`${name}/${viewport.label}: centered Settings Form Rail exceeded its compact width (${layout.enabledWidth}/${layout.pathWidth}px)`);
        assert(layout.enabledCenterDelta<4&&layout.pathCenterDelta<4,`${name}/${viewport.label}: Settings Form Rail is not centered (${layout.enabledCenterDelta}/${layout.pathCenterDelta}px)`);
      }
      assert(layout.maxHeight<90,`${name}/${viewport.label}: Settings row is oversized (${layout.maxHeight}px) · ${JSON.stringify(layout.metrics)}`);
      assert(layout.minHeight>=44,`${name}/${viewport.label}: Settings row is too compressed (${layout.minHeight}px) · ${JSON.stringify(layout.metrics)}`);
      assert(layout.scrollWidth<=layout.innerWidth+1,`${name}/${viewport.label}: settings horizontal overflow`);
      assert(!layout.settingsCss,`${name}/${viewport.label}: standalone settings-v034.css must not be loaded`);
      assert(errors.length===0,`${name}/${viewport.label}: browser errors: ${errors.join(' | ')}`);
      await page.close();
    }
  }

  for(const name of Object.keys(variants)){
    reset(name);
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    const errors=[];
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://${host}:${port}/${name}/#/settings`,{waitUntil:'networkidle'});
    await page.locator('#settings-tabs [data-settings-tab="webui"]').click();
    await page.waitForSelector('#settings-content [data-setting-key="alternative_webui_path"]');

    await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();
    await page.waitForFunction(()=>![...document.querySelectorAll('#settings-content .settings-row')].some(row=>['alternative_webui_enabled','alternative_webui_path'].includes(row.dataset.key||row.dataset.settingKey)&&!row.hidden),null,{timeout:1500});
    await page.locator('#settings-tabs [data-settings-tab="webui"]').click();
    await page.waitForSelector('#settings-content [data-setting-key="alternative_webui_path"]');

    const writesBeforeMistake=state[name].writes.length;
    await page.locator('#settings-content [data-setting-key="alternative_webui_path"] .field-input').fill(hostPath);
    await page.locator('#save-settings-btn').click();
    await page.waitForTimeout(120);
    assert(state[name].writes.length===writesBeforeMistake,`${name}: host path mistake was sent to qBittorrent`);

    const changedPath='/config/weigg-qb-webui-alt';
    await page.locator('#settings-content [data-setting-key="alternative_webui_path"] .field-input').fill(changedPath);
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#save-settings-btn').click();
    await page.waitForFunction(expected=>document.querySelector('#settings-content [data-setting-key="alternative_webui_path"] .field-input')?.value===expected,changedPath);
    assert(state[name].prefs.alternative_webui_path===changedPath,`${name}: valid qB path not saved`);
    assert(state[name].writes.some(x=>x.alternative_webui_path===changedPath),`${name}: path write payload missing`);

    await page.locator('#settings-content [data-setting-key="alternative_webui_enabled"] .switch-input').uncheck();
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#save-settings-btn').click();
    await page.waitForFunction(()=>location.pathname==='/',null,{timeout:2500});
    assert(state[name].prefs.alternative_webui_enabled===false,`${name}: disable preference not saved`);
    assert(state[name].writes.some(x=>x.alternative_webui_enabled===false),`${name}: disable write payload missing`);
    assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);
    await page.close();
  }
  console.log('v0.3.7 row-based Alternative WebUI regression passed for qB 4.1.9.1, 4.6.7 and 5.2.0 across 3 viewports.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}