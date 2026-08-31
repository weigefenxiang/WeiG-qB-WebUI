import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('webui/private/scripts/qb-client.js', 'utf8');
const sandbox = {
  console,
  URLSearchParams,
  FormData: class FormData {},
  Blob,
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

console.log('v0.3 compatibility fixtures passed: 4.1.9.1 / 4.6.x / 5.2.0');
