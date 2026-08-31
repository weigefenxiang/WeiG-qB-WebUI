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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function timestamp(variant, seconds) {
  return variant.milliseconds ? seconds * 1000 : seconds;
}
function logRow(variant, id, type, message) {
  return {id, timestamp: timestamp(variant, baseSeconds + id), type, message};
}
function initialLogs(variant) {
  const types = [1, 2, 4, 8];
  const labels = {1: 'Normal', 2: 'Info', 4: 'Warning', 8: 'Critical'};
  return Array.from({length: 100}, (_, i) => {
    const id = i + 1;
    const type = types[i % types.length];
    return logRow(variant, id, type, `${labels[type]} fixture log ${id}`);
  });
}
function writeJson(res, value) {
  res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  res.end(JSON.stringify(value));
}
function writeText(res, value) {
  res.writeHead(200, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'});
  res.end(String(value));
}
function handleApi(req, res, name, apiPath, url) {
  const v = variants[name];
  if (req.method !== 'GET') return writeText(res, '');
  if (apiPath === 'app/version') return writeText(res, v.qb);
  if (apiPath === 'app/webapiVersion') return writeText(res, v.api);
  if (apiPath === 'transfer/info') return writeJson(res, {
    dl_info_speed: 12345, up_info_speed: 6789,
    dl_info_data: 123456789, up_info_data: 23456789,
    connection_status: 'connected', dht_nodes: 12,
  });
  if (apiPath === 'sync/maindata') return writeJson(res, {
    rid: 1, full_update: true, torrents: {}, categories: {}, tags: [],
    server_state: {
      dl_info_speed: 12345, up_info_speed: 6789,
      dl_info_data: 123456789, up_info_data: 23456789,
      connection_status: 'connected', dht_nodes: 12,
      total_peer_connections: 4, free_space_on_disk: 987654321,
    },
  });
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
    if (last < 0) {
      v.nextId = 100;
      return writeJson(res, initialLogs(v));
    }
    v.nextId = Math.max(v.nextId, last) + 1;
    const id = v.nextId;
    return writeJson(res, [logRow(v, id, id % 4 === 0 ? 8 : 2, `incremental fixture log ${id}`)]);
  }
  return writeJson(res, {});
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const match = url.pathname.match(/^\/(qb4|qb5)(?:\/(.*))?$/);
    if (!match) { res.writeHead(404); return res.end('not found'); }
    const name = match[1];
    const relative = match[2] || '';
    if (relative.startsWith('api/v2/')) return handleApi(req, res, name, relative.slice(7), url);
    const requested = relative || 'index.html';
    const file = path.resolve(webRoot, requested);
    if (!(file === webRoot || file.startsWith(webRoot + path.sep))) {
      res.writeHead(403); return res.end('forbidden');
    }
    const body = await fs.readFile(file);
    res.writeHead(200, {'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store'});
    res.end(body);
  } catch (error) {
    res.writeHead(error?.code === 'ENOENT' ? 404 : 500, {'content-type': 'text/plain; charset=utf-8'});
    res.end(String(error));
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, resolve);
});

function parseStatus(text) {
  const match = String(text || '').match(/(\d+)\s*\/\s*(\d+)/);
  return match ? {shown: Number(match[1]), total: Number(match[2])} : {shown: -1, total: -1};
}

const browser = await chromium.launch({headless: true});
try {
  for (const name of Object.keys(variants)) {
    for (const [width, height] of viewports) {
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', error => errors.push(String(error)));

      await page.goto(`http://${host}:${port}/${name}/#/logs`, {waitUntil: 'networkidle'});
      await page.waitForSelector('.logs-v032-row');

      const base = await page.evaluate(() => {
        const rect = node => node ? node.getBoundingClientRect() : null;
        const visibleLogsNav = [...document.querySelectorAll('[data-route="logs"]')].some(node => getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0);
        const firstTime = document.querySelector('.logs-v032-time');
        return {
          innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          visibleLogsNav,
          tool: rect(document.querySelector('#logs-view > .tool-page')),
          panel: rect(document.querySelector('.logs-v032-panel')),
          list: rect(document.querySelector('.logs-v032-list')),
          firstDateTime: firstTime?.dateTime || '',
          firstText: firstTime?.textContent || '',
          status: document.querySelector('.logs-v032-status')?.textContent || '',
        };
      });
      const initialStatus = parseStatus(base.status);
      const renderedMs = Date.parse(base.firstDateTime);
      const minMs = (baseSeconds + 1) * 1000;
      const maxMs = (baseSeconds + 100) * 1000;

      assert(base.visibleLogsNav, `${name} ${width}x${height}: Logs navigation hidden`);
      assert(base.scrollWidth <= base.innerWidth + 1, `${name} ${width}x${height}: horizontal overflow ${base.scrollWidth} > ${base.innerWidth}`);
      assert(base.panel?.height >= 250, `${name} ${width}x${height}: Logs panel is too short`);
      assert(base.list?.height >= 180, `${name} ${width}x${height}: Logs viewport is too short`);
      assert(initialStatus.total === 100, `${name} ${width}x${height}: expected 100 initial rows, got ${base.status}`);
      assert(Number.isFinite(renderedMs) && renderedMs >= minMs && renderedMs <= maxMs,
        `${name} ${width}x${height}: normalized timestamp outside fixture range: ${base.firstDateTime} (${base.firstText})`);

      const autoHeight = base.tool.height;
      await page.locator('#logs-size-mode').selectOption('compact');
      await page.waitForTimeout(220);
      const compact = await page.evaluate(() => ({
        mode: document.querySelector('#logs-view')?.classList.contains('logs-size-compact'),
        height: document.querySelector('#logs-view > .tool-page')?.getBoundingClientRect().height || 0,
      }));
      assert(compact.mode, `${name} ${width}x${height}: Compact class missing`);
      assert(compact.height < autoHeight - 20, `${name} ${width}x${height}: Compact did not shrink (${compact.height} vs ${autoHeight})`);

      await page.locator('#logs-size-mode').selectOption('max');
      await page.waitForTimeout(220);
      const max = await page.evaluate(() => ({
        mode: document.querySelector('#logs-view')?.classList.contains('logs-size-max'),
        headerDisplay: getComputedStyle(document.querySelector('#logs-view > .workspace__header')).display,
        height: document.querySelector('#logs-view > .tool-page')?.getBoundingClientRect().height || 0,
      }));
      assert(max.mode, `${name} ${width}x${height}: Max class missing`);
      assert(max.headerDisplay === 'none', `${name} ${width}x${height}: Max did not hide page header`);
      assert(max.height > compact.height + 20, `${name} ${width}x${height}: Max did not expand (${max.height} vs ${compact.height})`);

      await page.locator('#logs-size-mode').selectOption('auto');
      await page.locator('#logs-local-search').fill('Critical fixture log 100');
      await page.waitForTimeout(100);
      const searched = parseStatus(await page.locator('.logs-v032-status').textContent());
      assert(searched.shown === 1, `${name} ${width}x${height}: search expected one row, got ${searched.shown}/${searched.total}`);
      await page.locator('#logs-local-search').fill('');

      for (const type of ['1', '2', '4']) await page.locator(`[data-log-type="${type}"]`).click();
      await page.waitForTimeout(100);
      const severity = parseStatus(await page.locator('.logs-v032-status').textContent());
      const levels = await page.locator('.logs-v032-level').allTextContents();
      assert(severity.shown > 0 && severity.shown < severity.total, `${name} ${width}x${height}: severity filter did not narrow rows`);
      assert(levels.length > 0 && levels.every(label => /Critical|严重/.test(label)), `${name} ${width}x${height}: non-Critical rows visible after filter: ${levels.join(',')}`);
      for (const type of ['1', '2', '4']) await page.locator(`[data-log-type="${type}"]`).click();

      if (width === 1366) {
        const beforePoll = parseStatus(await page.locator('.logs-v032-status').textContent()).total;
        await page.waitForFunction(previous => {
          const text = document.querySelector('.logs-v032-status')?.textContent || '';
          const match = text.match(/(\d+)\s*\/\s*(\d+)/);
          return match && Number(match[2]) > previous;
        }, beforePoll, {timeout: 7000});

        const list = page.locator('.logs-v032-list');
        await page.locator('.logs-follow-control input').uncheck();
        await list.evaluate(node => { node.scrollTop = 240; });
        await page.waitForTimeout(80);
        const scrollBefore = await list.evaluate(node => node.scrollTop);
        const totalBefore = parseStatus(await page.locator('.logs-v032-status').textContent()).total;
        await page.waitForFunction(previous => {
          const text = document.querySelector('.logs-v032-status')?.textContent || '';
          const match = text.match(/(\d+)\s*\/\s*(\d+)/);
          return match && Number(match[2]) > previous;
        }, totalBefore, {timeout: 7000});
        const scrollAfter = await list.evaluate(node => node.scrollTop);
        assert(Math.abs(scrollAfter - scrollBefore) <= 4, `${name}: Follow latest OFF moved viewport ${scrollBefore} -> ${scrollAfter}`);
      }

      assert(errors.length === 0, `${name} ${width}x${height}: browser console errors: ${errors.join(' | ')}`);
      await page.close();
    }
  }
  console.log(`v0.3.3 Logs browser regression passed for ${Object.keys(variants).length} qB variants × ${viewports.length} viewports.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
