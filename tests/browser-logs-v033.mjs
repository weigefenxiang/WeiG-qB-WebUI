import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '../webui/private');
const host = '127.0.0.1';
const port = 8766;
const baseEpochSeconds = Math.floor(Date.parse('2026-08-31T04:06:22Z') / 1000);
const variants = {
  qb4: { qb: 'v4.1.9.1', api: '2.2.1', milliseconds: true, nextId: 100 },
  qb5: { qb: 'v5.2.0', api: '2.15.1', milliseconds: false, nextId: 100 },
};
const viewports = [
  [390, 844],
  [1366, 768],
  [1920, 1080],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function rawTimestamp(variant, seconds) {
  return variant.milliseconds ? seconds * 1000 : seconds;
}

function makeLog(variant, id, type, message) {
  return {
    id,
    timestamp: rawTimestamp(variant, baseEpochSeconds + id),
    type,
    message,
  };
}

function initialLogs(variant) {
  const types = [1, 2, 4, 8];
  const labels = {1: 'Normal', 2: 'Info', 4: 'Warning', 8: 'Critical'};
  return Array.from({length: 100}, (_, index) => {
    const id = index + 1;
    const type = types[index % types.length];
    return makeLog(variant, id, type, `${labels[type]} fixture log ${id}`);
  });
}

function json(res, value, status = 200) {
  const body = JSON.stringify(value);
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
  res.end(body);
}

function text(res, value, status = 200) {
  res.writeHead(status, {'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'});
  res.end(String(value));
}

function apiResponse(req, res, variantName, apiPath, url) {
  const variant = variants[variantName];
  if (req.method !== 'GET') {
    res.writeHead(200, {'content-type': 'text/plain; charset=utf-8'});
    res.end('');
    return;
  }
  if (apiPath === 'app/version') return text(res, variant.qb);
  if (apiPath === 'app/webapiVersion') return text(res, variant.api);
  if (apiPath === 'transfer/info') return json(res, {
    dl_info_speed: 12_345,
    up_info_speed: 6_789,
    dl_info_data: 123_456_789,
    up_info_data: 23_456_789,
    connection_status: 'connected',
    dht_nodes: 12,
  });
  if (apiPath === 'sync/maindata') return json(res, {
    rid: 1,
    full_update: true,
    torrents: {},
    categories: {},
    tags: [],
    server_state: {
      dl_info_speed: 12_345,
      up_info_speed: 6_789,
      dl_info_data: 123_456_789,
      up_info_data: 23_456_789,
      connection_status: 'connected',
      dht_nodes: 12,
      total_peer_connections: 4,
      free_space_on_disk: 987_654_321,
    },
  });
  if (apiPath === 'torrents/info') return json(res, []);
  if (apiPath === 'torrents/categories') return json(res, {});
  if (apiPath === 'torrents/tags') return json(res, []);
  if (apiPath === 'app/preferences') return json(res, {});
  if (apiPath === 'app/buildInfo') return json(res, {});
  if (apiPath === 'rss/items') return json(res, {});
  if (apiPath === 'search/plugins') return json(res, []);
  if (apiPath === 'log/peers') return json(res, []);
  if (apiPath === 'log/main') {
    const lastKnown = Number(url.searchParams.get('last_known_id') ?? -1);
    if (lastKnown < 0) {
      variant.nextId = 100;
      return json(res, initialLogs(variant));
    }
    if (lastKnown >= variant.nextId) variant.nextId = lastKnown;
    variant.nextId += 1;
    const id = variant.nextId;
    return json(res, [makeLog(variant, id, id % 4 === 0 ? 8 : 2, `incremental fixture log ${id}`)]);
  }
  return json(res, {});
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const match = url.pathname.match(/^\/(qb4|qb5)(?:\/(.*))?$/);
    if (!match) {
      res.writeHead(404);
      return res.end('not found');
    }
    const variantName = match[1];
    const relative = match[2] || '';
    if (relative.startsWith('api/v2/')) {
      return apiResponse(req, res, variantName, relative.slice('api/v2/'.length), url);
    }
    const requested = relative === '' ? 'index.html' : relative;
    const file = path.resolve(webRoot, requested);
    if (!(file === webRoot || file.startsWith(webRoot + path.sep))) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
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

const browser = await chromium.launch({headless: true});
try {
  for (const variantName of Object.keys(variants)) {
    for (const [width, height] of viewports) {
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', error => errors.push(String(error)));

      await page.goto(`http://${host}:${port}/${variantName}/#/logs`, {waitUntil: 'networkidle'});
      await page.waitForSelector('.logs-v032-row');
      await page.waitForFunction(() => document.querySelectorAll('.logs-v032-row').length > 0);

      const base = await page.evaluate(() => {
        const doc = document.documentElement;
        const view = document.querySelector('#logs-view');
        const tool = view?.querySelector(':scope > .tool-page');
        const panel = document.querySelector('.logs-v032-panel');
        const list = document.querySelector('.logs-v032-list');
        const firstTime = document.querySelector('.logs-v032-time');
        const nav = document.querySelector('[data-route="logs"]');
        const r = node => node ? node.getBoundingClientRect() : null;
        return {
          innerWidth: innerWidth,
          scrollWidth: doc.scrollWidth,
          navVisible: !!nav && getComputedStyle(nav).display !== 'none',
          view: r(view), tool: r(tool), panel: r(panel), list: r(list),
          firstDateTime: firstTime?.dateTime || '',
          firstText: firstTime?.textContent || '',
          status: document.querySelector('.logs-v032-status')?.textContent || '',
          rowCount: document.querySelectorAll('.logs-v032-row').length,
        };
      });

      assert(base.navVisible, `${variantName} ${width}x${height}: Logs navigation hidden`);
      assert(base.scrollWidth <= base.innerWidth + 1, `${variantName} ${width}x${height}: horizontal overflow ${base.scrollWidth} > ${base.innerWidth}`);
      assert(base.panel && base.panel.height >= 250, `${variantName} ${width}x${height}: Logs panel is too short`);
      assert(base.list && base.list.height >= 180, `${variantName} ${width}x${height}: Logs viewport is too short`);
      assert(base.status.includes('/ 100'), `${variantName} ${width}x${height}: initial 100-row status missing: ${base.status}`);
      assert(/^2026-08-31T04:06:23\.000Z$/.test(base.firstDateTime), `${variantName} ${width}x${height}: normalized timestamp incorrect: ${base.firstDateTime} (${base.firstText})`);

      const autoHeight = base.tool.height;
      await page.locator('#logs-size-mode').selectOption('compact');
      await page.waitForTimeout(220);
      const compact = await page.evaluate(() => ({
        mode: document.querySelector('#logs-view')?.classList.contains('logs-size-compact'),
        height: document.querySelector('#logs-view > .tool-page')?.getBoundingClientRect().height || 0,
      }));
      assert(compact.mode, `${variantName} ${width}x${height}: Compact class not applied`);
      assert(compact.height < autoHeight - 20 || width <= 820, `${variantName} ${width}x${height}: Compact did not reduce panel (${compact.height} vs ${autoHeight})`);

      await page.locator('#logs-size-mode').selectOption('max');
      await page.waitForTimeout(220);
      const max = await page.evaluate(() => ({
        mode: document.querySelector('#logs-view')?.classList.contains('logs-size-max'),
        headerDisplay: getComputedStyle(document.querySelector('#logs-view > .workspace__header')).display,
        height: document.querySelector('#logs-view > .tool-page')?.getBoundingClientRect().height || 0,
      }));
      assert(max.mode, `${variantName} ${width}x${height}: Max class not applied`);
      assert(max.headerDisplay === 'none', `${variantName} ${width}x${height}: Max did not hide page header`);
      assert(max.height > compact.height + 20, `${variantName} ${width}x${height}: Max did not expand panel (${max.height} vs ${compact.height})`);

      await page.locator('#logs-size-mode').selectOption('auto');
      await page.waitForTimeout(150);

      await page.locator('#logs-local-search').fill('Critical fixture log 100');
      await page.waitForTimeout(120);
      const searched = await page.locator('.logs-v032-status').textContent();
      assert(searched.includes('1 / 100'), `${variantName} ${width}x${height}: log search did not narrow to one row: ${searched}`);
      await page.locator('#logs-local-search').fill('');

      await page.locator('[data-log-type="1"]').click();
      await page.locator('[data-log-type="2"]').click();
      await page.locator('[data-log-type="4"]').click();
      await page.waitForTimeout(100);
      const severity = await page.locator('.logs-v032-status').textContent();
      assert(severity.includes('25 / 100'), `${variantName} ${width}x${height}: severity filter expected 25 Critical rows: ${severity}`);
      await page.locator('[data-log-type="1"]').click();
      await page.locator('[data-log-type="2"]').click();
      await page.locator('[data-log-type="4"]').click();

      if (width === 1366) {
        await page.waitForFunction(() => {
          const text = document.querySelector('.logs-v032-status')?.textContent || '';
          const match = text.match(/\/\s*(\d+)/);
          return match && Number(match[1]) > 100;
        }, null, {timeout: 7000});
        const incrementalStatus = await page.locator('.logs-v032-status').textContent();
        assert(/\/\s*10[1-9]/.test(incrementalStatus), `${variantName}: incremental log polling did not advance: ${incrementalStatus}`);

        const list = page.locator('.logs-v032-list');
        await page.locator('.logs-follow-control input').uncheck();
        await list.evaluate(node => { node.scrollTop = 240; });
        await page.waitForTimeout(80);
        const before = await list.evaluate(node => node.scrollTop);
        await page.waitForTimeout(3200);
        const after = await list.evaluate(node => node.scrollTop);
        assert(Math.abs(after - before) <= 4, `${variantName}: Follow latest OFF moved viewport ${before} -> ${after}`);
      }

      assert(errors.length === 0, `${variantName} ${width}x${height}: browser console errors: ${errors.join(' | ')}`);
      await page.close();
    }
  }
  console.log(`v0.3.3 Logs browser regression passed for ${Object.keys(variants).length} qB variants × ${viewports.length} viewports.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
