import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../webui/private');
const host = '127.0.0.1';
const port = 8766;
const baseSeconds = Math.floor(Date.parse('2026-08-31T04:06:22Z') / 1000);
const variants = {
  qb4: { qb: 'v4.1.9.1', api: '2.2.1', milliseconds: true, nextId: 100 },
  qb5: { qb: 'v5.2.0', api: '2.15.1', milliseconds: false, nextId: 100 },
};
const viewports = [[390, 844], [1366, 768], [1920, 1080]];

function assert(condition, message) { if (!condition) throw new Error(message); }
function timestamp(variant, seconds) { return variant.milliseconds ? seconds * 1000 : seconds; }
function logRow(variant, id, type, message) { return {id, timestamp: timestamp(variant, baseSeconds + id), type, message}; }
function initialLogs(variant) {
  const types = [1, 2, 4, 8];
  const labels = {1: 'Normal', 2: 'Info', 4: 'Warning', 8: 'Critical'};
  return Array.from({length: 100}, (_, i) => {
    const id = i + 1, type = types[i % types.length];
    return logRow(variant, id, type, `${labels[type]} fixture log ${id}`);
  });
}
function writeJson(res, value) { res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); res.end(JSON.stringify(value)); }
function writeText(res, value) { res.writeHead(200, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'}); res.end(String(value)); }
function handleApi(req, res, name, apiPath, url) {
  const v = variants[name];
  if (req.method !== 'GET') return writeText(res, '');
  if (apiPath === 'app/version') return writeText(res, v.qb);
  if (apiPath === 'app/webapiVersion') return writeText(res, v.api);
  if (apiPath === 'transfer/info') return writeJson(res, {dl_info_speed:12345,up_info_speed:6789,dl_info_data:123456789,up_info_data:23456789,connection_status:'connected',dht_nodes:12});
  if (apiPath === 'transfer/speedLimitsMode') return writeText(res, '0');
  if (apiPath === 'sync/maindata') return writeJson(res, {rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{dl_info_speed:12345,up_info_speed:6789,dl_info_data:123456789,up_info_data:23456789,connection_status:'connected',dht_nodes:12,total_peer_connections:4,free_space_on_disk:987654321}});
  if (apiPath === 'torrents/info') return writeJson(res, []);
  if (apiPath === 'torrents/categories') return writeJson(res, {});
  if (apiPath === 'torrents/tags') return writeJson(res, []);
  if (apiPath === 'app/preferences') return writeJson(res, {});
  if (apiPath === 'app/buildInfo') return writeJson(res, {});
  if (apiPath === 'rss/items') return writeJson(res, {});
  if (apiPath === 'search/plugins') return writeJson(res, []);
  if (apiPath === 'log/peers') return writeJson(res, []);
  if (apiPath === 'log/main') {
    const last = Number(url.searchParams.get('last_known_id') ?? -1);
    if (last < 0) { v.nextId = 100; return writeJson(res, initialLogs(v)); }
    v.nextId = Math.max(v.nextId, last) + 1;
    const id = v.nextId;
    return writeJson(res, [logRow(v, id, id % 4 === 0 ? 8 : 2, `incremental fixture log ${id}`)]);
  }
  return writeJson(res, {});
}

const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const match = url.pathname.match(/^\/(qb4|qb5)(?:\/(.*))?$/);
    if (!match) { res.writeHead(404); return res.end('not found'); }
    const name = match[1], relative = match[2] || '';
    if (relative.startsWith('api/v2/')) return handleApi(req, res, name, relative.slice(7), url);
    const requested = relative || 'index.html', file = path.resolve(webRoot, requested);
    if (!(file === webRoot || file.startsWith(webRoot + path.sep))) { res.writeHead(403); return res.end('forbidden'); }
    const body = await fs.readFile(file);
    res.writeHead(200, {'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store'}); res.end(body);
  } catch (error) { res.writeHead(error?.code === 'ENOENT' ? 404 : 500, {'content-type':'text/plain; charset=utf-8'}); res.end(String(error)); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });

function parseStatus(text) { const match=String(text||'').match(/(\d+)\s*\/\s*(\d+)/); return match?{shown:Number(match[1]),total:Number(match[2])}:{shown:-1,total:-1}; }
async function choose(page,id,value){
  const root=page.locator(`#${id}`);await root.locator('.ui-select__trigger').click();await page.locator(`#weigg-floating-layer .ui-select__option[data-value="${value}"]`).click();
}

const browser = await chromium.launch({headless: true});
try {
  for (const name of Object.keys(variants)) {
    for (const [width, height] of viewports) {
      const context = await browser.newContext({viewport:{width,height},timezoneId:'UTC'});
      const page = await context.newPage(), errors=[];
      page.on('console', msg => { if (msg.type() === 'error' && !/favicon|Wei\.G\.ico/i.test(msg.text())) errors.push(msg.text()); });
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(`http://${host}:${port}/${name}/#/logs`, {waitUntil:'networkidle'});
      await page.waitForSelector('.logs-v032-row[data-log-id="100"]');
      await page.waitForFunction(()=>document.documentElement.dataset.v036==='1' && !!globalThis.WeiG?.V037?.ui);
      await page.waitForTimeout(80);

      const base=await page.evaluate(()=>{
        const rect=node=>node?node.getBoundingClientRect():null, first=document.querySelector('.logs-v032-row'), fixed=document.querySelector('.logs-v032-row[data-log-id="100"]'), fixedTime=fixed?.querySelector('.logs-v032-time');
        return {innerWidth,scrollWidth:document.documentElement.scrollWidth,visibleLogsNav:[...document.querySelectorAll('[data-route="logs"]')].some(node=>getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0),tool:rect(document.querySelector('#logs-view > .tool-page')),panel:rect(document.querySelector('.logs-v032-panel')),list:rect(document.querySelector('.logs-v032-list')),firstId:Number(first?.dataset.logId),fixedDateTime:fixedTime?.dateTime||'',fixedText:fixedTime?.textContent||'',status:document.querySelector('.logs-v032-status')?.textContent||'',nativeLogsSelects:document.querySelectorAll('.logs-v032-toolbar select:not(.ui-native-select)').length,customSelects:document.querySelectorAll('.logs-v032-toolbar .ui-select').length,toolbarTimezone:document.querySelectorAll('.logs-v032-toolbar .timezone-select').length,statusTimezone:document.querySelectorAll('[data-status-timezone]').length,timeModel:!!globalThis.WeiG?.Time,utcLabel:globalThis.WeiG?.Time?.offsetLabel?.('UTC')||''};
      });
      const initialStatus=parseStatus(base.status), renderedMs=Date.parse(base.fixedDateTime), minMs=(baseSeconds+100)*1000,maxMs=(baseSeconds+100)*1000+999;
      assert(width<=820||base.visibleLogsNav,`${name} ${width}x${height}: desktop Logs navigation hidden`);
      assert(base.scrollWidth<=base.innerWidth+1,`${name} ${width}x${height}: horizontal overflow ${base.scrollWidth} > ${base.innerWidth}`);
      assert(base.panel?.height>=250,`${name} ${width}x${height}: Logs panel is too short`);
      assert(base.list?.height>=180,`${name} ${width}x${height}: Logs viewport is too short`);
      assert(initialStatus.total>=100,`${name} ${width}x${height}: expected at least 100 rows, got ${base.status}`);
      assert(base.firstId>=100,`${name} ${width}x${height}: newest-first order regressed, got id ${base.firstId}`);
      assert(Number.isFinite(renderedMs)&&renderedMs>=minMs&&renderedMs<=maxMs,`${name} ${width}x${height}: normalized id=100 timestamp outside fixture range`);
      assert(base.nativeLogsSelects===0,`${name} ${width}x${height}: raw Logs select is visible`);
      assert(base.customSelects>=1,`${name} ${width}x${height}: canonical Logs size Select missing`);
      assert(base.toolbarTimezone===0,`${name} ${width}x${height}: Logs toolbar must not own timezone selector`);
      assert(base.statusTimezone===0,`${name} ${width}x${height}: statusbar must not duplicate the Settings timezone control`);
      assert(base.timeModel&&base.utcLabel==='UTC+00:00',`${name} ${width}x${height}: shared time model unavailable: ${base.utcLabel}`);

      const autoHeight=base.tool.height;
      await choose(page,'logs-size-mode','compact');await page.waitForTimeout(180);
      const compact=await page.evaluate(()=>({mode:document.querySelector('#logs-view')?.classList.contains('logs-size-compact'),height:document.querySelector('#logs-view > .tool-page')?.getBoundingClientRect().height||0}));
      assert(compact.mode,`${name} ${width}x${height}: Compact class missing`);assert(compact.height<autoHeight-20,`${name} ${width}x${height}: Compact did not shrink`);
      await choose(page,'logs-size-mode','max');await page.waitForTimeout(180);
      const max=await page.evaluate(()=>({mode:document.querySelector('#logs-view')?.classList.contains('logs-size-max'),headerDisplay:getComputedStyle(document.querySelector('#logs-view > .workspace__header')).display,height:document.querySelector('#logs-view > .tool-page')?.getBoundingClientRect().height||0}));
      assert(max.mode,`${name} ${width}x${height}: Max class missing`);assert(max.headerDisplay==='none',`${name} ${width}x${height}: Max did not hide header`);assert(max.height>compact.height+20,`${name} ${width}x${height}: Max did not expand`);
      await choose(page,'logs-size-mode','auto');

      const row100=page.locator('.logs-v032-row[data-log-id="100"] .logs-v032-time');await row100.waitFor();
      const beforeZone={text:await row100.textContent(),iso:await row100.getAttribute('datetime')};
      await page.evaluate(()=>WeiG.Time.setZone('Asia/Shanghai'));
      await page.waitForTimeout(80);
      const row100After=page.locator('.logs-v032-row[data-log-id="100"] .logs-v032-time');
      const zoneState={zone:await page.evaluate(()=>WeiG.Time.getZone()),text:await row100After.textContent(),iso:await row100After.getAttribute('datetime'),offset:await page.evaluate(()=>WeiG.Time.offsetLabel('Asia/Shanghai'))};
      assert(zoneState.zone==='Asia/Shanghai',`${name}: timezone preference was not stored`);
      assert(zoneState.offset==='UTC+08:00',`${name}: Shanghai offset mismatch: ${zoneState.offset}`);
      assert(zoneState.text!==beforeZone.text,`${name}: timezone switch did not change rendered time`);
      assert(zoneState.iso===beforeZone.iso,`${name}: timezone switch changed source timestamp`);
      const fractional=await page.evaluate(()=>({india:WeiG.Time.offsetLabel('Asia/Kolkata',new Date('2026-08-31T12:00:00Z')),nepal:WeiG.Time.offsetLabel('Asia/Kathmandu',new Date('2026-08-31T12:00:00Z'))}));
      assert(fractional.india==='UTC+05:30',`${name}: +05:30 offset unsupported: ${fractional.india}`);assert(fractional.nepal==='UTC+05:45',`${name}: +05:45 offset unsupported: ${fractional.nepal}`);

      await page.locator('#logs-local-search').fill('Critical fixture log 100');await page.waitForTimeout(80);
      const searched=parseStatus(await page.locator('.logs-v032-status').textContent());assert(searched.shown===1,`${name} ${width}x${height}: search expected one row`);await page.locator('#logs-local-search').fill('');
      for(const type of ['1','2','4'])await page.locator(`[data-log-type="${type}"]`).click();await page.waitForTimeout(80);
      const severity=parseStatus(await page.locator('.logs-v032-status').textContent()),levels=await page.locator('.logs-v032-level').allTextContents();
      assert(severity.shown>0&&severity.shown<severity.total,`${name} ${width}x${height}: severity filter did not narrow rows`);assert(levels.length>0&&levels.every(label=>/Critical|严重/.test(label)),`${name} ${width}x${height}: non-Critical rows visible`);
      for(const type of ['1','2','4'])await page.locator(`[data-log-type="${type}"]`).click();

      if(width===1366){
        const beforePoll=parseStatus(await page.locator('.logs-v032-status').textContent()).total;
        await page.waitForFunction(previous=>{const m=(document.querySelector('.logs-v032-status')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);return m&&Number(m[2])>previous;},beforePoll,{timeout:7000});
        const newestAfter=Number(await page.locator('.logs-v032-row').first().getAttribute('data-log-id'));assert(newestAfter>100,`${name}: incremental row did not appear at top`);
        const list=page.locator('.logs-v032-list');const follow=page.locator('[data-logs-follow]');const followInput=follow.locator('input');if(await followInput.isChecked())await follow.click();assert(!(await followInput.isChecked()),`${name}: Follow latest control did not toggle off via canonical label`);
        await list.evaluate(node=>{node.scrollTop=240;});await page.waitForTimeout(80);const scrollBefore=await list.evaluate(node=>node.scrollTop),totalBefore=parseStatus(await page.locator('.logs-v032-status').textContent()).total;
        await page.waitForFunction(previous=>{const m=(document.querySelector('.logs-v032-status')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);return m&&Number(m[2])>previous;},totalBefore,{timeout:7000});
        const scrollAfter=await list.evaluate(node=>node.scrollTop);assert(scrollAfter>=scrollBefore+45,`${name}: newest-first insertion did not preserve viewed historical rows (${scrollBefore} -> ${scrollAfter})`);
      }

      assert(errors.length===0,`${name} ${width}x${height}: browser console errors: ${errors.join(' | ')}`);await context.close();
    }
  }
  console.log(`v0.3.7 Logs/shared-time-model browser regression passed for ${Object.keys(variants).length} qB variants × ${viewports.length} viewports.`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
