import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('webui/private/scripts/qb-client.js', 'utf8');
class TestFormData {
  constructor() { this.entries = []; }
  append(name, value, filename) { this.entries.push({ name, value, filename }); }
}
const sandbox = {
  console,
  URLSearchParams,
  FormData: TestFormData,
  Blob,
  fetch: async () => { throw new Error('Unexpected fetch'); },
  window: {
    WeiG: {
      util: {
        form(obj) {
          const p = new URLSearchParams();
          for (const [k, v] of Object.entries(obj || {})) {
            if (v !== undefined && v !== null) p.append(k, String(v));
          }
          return p.toString();
        },
      },
      I18n: { getLocale: () => 'en' },
    },
  },
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'qb-client.js' });
const Client = sandbox.window.WeiG.QBClient;

async function detectFixture(qbVersion, webApiVersion) {
  const client = new Client();
  client.request = async path => {
    if (path === 'app/version') return qbVersion;
    if (path === 'app/webapiVersion') return webApiVersion;
    throw new Error(`Unexpected detect endpoint: ${path}`);
  };
  await client.detect();
  return client;
}

// Release-blocking legacy floor.
{
  const c = await detectFixture('4.1.9.1', '2.2.1');
  assert.equal(c.major, 4);
  assert.equal(c.capabilities.globalSpeedLimits, true);
  assert.equal(c.capabilities.altSpeedLimits, true);
  assert.equal(c.capabilities.mainData, true);
  assert.equal(c.capabilities.tags, false);
  assert.equal(c.capabilities.stalledFilter, false);
  assert.equal(c.capabilities.privateFlag, false);
  assert.equal(c.capabilities.cookies, false);
  assert.equal(c.capabilities.torrentCreator, false);
  assert.equal(c.capabilities.trackerEditUrl, false);
  assert.equal(c.capabilities.structuredTorrentAdd, false);
}

// Mature 4.x tier: modern taxonomy/filter APIs, but no exact private flag.
{
  const c = await detectFixture('4.6.7', '2.8.3');
  assert.equal(c.major, 4);
  assert.equal(c.capabilities.tags, true);
  assert.equal(c.capabilities.tagFilter, true);
  assert.equal(c.capabilities.privateFlag, false);
  assert.equal(c.capabilities.cookies, false);
  assert.equal(c.capabilities.globalSpeedLimits, true);
  assert.equal(c.capabilities.trackerEditUrl, false);
  assert.equal(c.capabilities.structuredTorrentAdd, false);
}

// Release-blocking modern target.
{
  const c = await detectFixture('5.2.0', '2.14.1');
  assert.equal(c.major, 5);
  assert.equal(c.capabilities.modern5, true);
  assert.equal(c.capabilities.tags, true);
  assert.equal(c.capabilities.privateFlag, true);
  assert.equal(c.capabilities.cookies, true);
  assert.equal(c.capabilities.torrentCreator, true);
  assert.equal(c.capabilities.globalSpeedLimits, true);
  assert.equal(c.capabilities.trackerEditUrl, true);
  assert.equal(c.capabilities.structuredTorrentAdd, true);
}

async function capture(client, fn) {
  const calls = [];
  client.request = async (path, options = {}) => {
    calls.push({ path, options });
    if (path === 'transfer/speedLimitsMode') return '1';
    if (path === 'transfer/downloadLimit') return '1048576';
    if (path === 'transfer/uploadLimit') return '2097152';
    return null;
  };
  await fn();
  return calls;
}

// 4.x uses resume/pause, 5.x uses start/stop.
{
  const c = new Client();
  c.major = 4;
  let calls = await capture(c, async () => {
    await c.resume('abc');
    await c.pause('abc');
  });
  assert.equal(calls[0].path, 'torrents/resume');
  assert.equal(calls[1].path, 'torrents/pause');

  c.major = 5;
  calls = await capture(c, async () => {
    await c.resume('abc');
    await c.pause('abc');
  });
  assert.equal(calls[0].path, 'torrents/start');
  assert.equal(calls[1].path, 'torrents/stop');
}

// Cross-version transfer controls deliberately use the long-lived endpoints.
{
  const c = new Client();
  const calls = await capture(c, async () => {
    assert.equal(await c.getGlobalDownloadLimit(), 1048576);
    assert.equal(await c.getGlobalUploadLimit(), 2097152);
    assert.equal(await c.getAltSpeedMode(), true);
    await c.setGlobalDownloadLimit(3145728);
    await c.setGlobalUploadLimit(4194304);
    await c.toggleAltSpeedMode();
    await c.getMainData(0);
  });
  assert.deepEqual(calls.map(x => x.path), [
    'transfer/downloadLimit',
    'transfer/uploadLimit',
    'transfer/speedLimitsMode',
    'transfer/setDownloadLimit',
    'transfer/setUploadLimit',
    'transfer/toggleSpeedLimitsMode',
    'sync/maindata?rid=0',
  ]);
  assert.equal(calls[3].options.form.limit, 3145728);
  assert.equal(calls[4].options.form.limit, 4194304);
}

// Filter vocabulary remains version-aware.
{
  const c4 = new Client();
  c4.major = 4;
  let path = '';
  c4.request = async p => { path = p; return []; };
  await c4.getTorrents({ filter: 'stopped', limit: 50, offset: 0 });
  assert.match(path, /filter=paused/);

  const c5 = new Client();
  c5.major = 5;
  c5.request = async p => { path = p; return []; };
  await c5.getTorrents({ filter: 'paused', limit: 50, offset: 0 });
  assert.match(path, /filter=stopped/);
}

// Legacy torrents/add still accepts the historical "Ok." contract.
{
  const c = new Client();
  c.webApiVersion = '2.12.1';
  c.request = async (path, options) => {
    assert.equal(path, 'torrents/add');
    assert.equal(options.method, 'POST');
    assert.equal(options.type, 'text');
    return 'Ok.';
  };
  assert.equal(await c.add('magnet:?xt=urn:btih:legacy', [], '', {}), 'Ok.');
}

// WebAPI 2.14 structured torrents/add: HTTP 200 JSON is normalized to the legacy UI contract.
{
  const c = new Client();
  c.webApiVersion = '2.14.1';
  sandbox.fetch = async (url, init) => {
    assert.equal(url, 'api/v2/torrents/add');
    assert.equal(init.method, 'POST');
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ added_torrent_ids: ['abc'], failure_count: 0, pending_count: 0, success_count: 1 }),
    };
  };
  assert.equal(await c.add('magnet:?xt=urn:btih:modern', [], '', {}), 'Ok.');
}

// WebAPI 2.14 pending torrents/add uses HTTP 202 and is still an accepted add operation.
{
  const c = new Client();
  c.webApiVersion = '2.14.1';
  sandbox.fetch = async () => ({
    status: 202,
    ok: true,
    text: async () => JSON.stringify({ added_torrent_ids: [], failure_count: 0, pending_count: 1, success_count: 0 }),
  });
  assert.equal(await c.add('https://example.invalid/pending.torrent', [], '', {}), 'Ok.');
}

// A WebAPI 2.14 all-failed add remains an error (HTTP 409).
{
  const c = new Client();
  sandbox.fetch = async () => ({
    status: 409,
    ok: false,
    text: async () => JSON.stringify({ added_torrent_ids: [], failure_count: 1, pending_count: 0, success_count: 0 }),
  });
  await assert.rejects(() => c.add('https://example.invalid/fail.torrent', [], '', {}), error => error && error.status === 409 && error.path === 'torrents/add');
}

// editTracker parameter name changed in WebAPI 2.13: old API uses origUrl, modern API uses url.
{
  const legacy = new Client();
  legacy.webApiVersion = '2.12.1';
  let calls = await capture(legacy, async () => legacy.editTracker('hash', 'https://old/announce', 'https://new/announce'));
  assert.equal(calls[0].path, 'torrents/editTracker');
  assert.equal(calls[0].options.form.origUrl, 'https://old/announce');
  assert.equal('url' in calls[0].options.form, false);

  const modern = new Client();
  modern.webApiVersion = '2.14.1';
  modern.capabilities.trackerEditUrl = true;
  calls = await capture(modern, async () => modern.editTracker('hash', 'https://old/announce', 'https://new/announce'));
  assert.equal(calls[0].options.form.url, 'https://old/announce');
  assert.equal('origUrl' in calls[0].options.form, false);
  assert.equal(calls[0].options.type, 'void');
}

// Login compatibility is kept in the public login page: 4.x/5.1 200 Ok., 5.2 204, and 5.2 bad credentials 401.
{
  const loginSource = fs.readFileSync('webui/public/login.html', 'utf8');
  const match = loginSource.match(/function classifyLogin\(x\)\{[\s\S]*?return'unexpected';\}/);
  assert.ok(match, 'login response classifier must remain testable');
  const classifyLogin = vm.runInNewContext(`(${match[0]})`);
  assert.equal(classifyLogin({ status: 200, ok: true, text: 'Ok.' }), 'ok');
  assert.equal(classifyLogin({ status: 204, ok: true, text: '' }), 'ok');
  assert.equal(classifyLogin({ status: 200, ok: true, text: 'Fails.' }), 'bad');
  assert.equal(classifyLogin({ status: 401, ok: false, text: 'Unauthorized' }), 'bad');
  assert.equal(classifyLogin({ status: 403, ok: false, text: 'Forbidden' }), 'banned');
}

console.log('v0.3 compatibility fixtures passed: 4.1.9.1 / 4.6.x / 5.2.0 including WebAPI 2.14 contracts');
