import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('webui/private/scripts/qb-client.js', 'utf8');
const sandbox = {
  console,
  URLSearchParams,
  FormData: class { append() {} },
  Blob,
  fetch: async () => { throw new Error('Unexpected fetch'); },
  window: {
    WeiG: {
      util: { form: obj => new URLSearchParams(obj || {}).toString() },
      I18n: { getLocale: () => 'en' },
    },
  },
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'qb-client.js' });
const Client = sandbox.window.WeiG.QBClient;

async function detect(qb, api) {
  const c = new Client();
  c.request = async path => path === 'app/version' ? qb : path === 'app/webapiVersion' ? api : null;
  await c.detect();
  return c;
}

assert.equal((await detect('4.1.9.1', '2.2.1')).capabilities.logs, true);
assert.equal((await detect('4.6.7', '2.8.3')).capabilities.logs, true);
assert.equal((await detect('5.2.0', '2.15.1')).capabilities.logs, true);

{
  const c = new Client();
  c.request = async path => {
    assert.match(path, /^log\/main\?/);
    return [{ id: 1, timestamp: 1725000000123, type: 2, message: 'legacy milliseconds' }];
  };
  const rows = await c.logs(-1);
  assert.equal(rows[0].timestamp, 1725000000);
}

{
  const c = new Client();
  c.request = async () => [{ id: 2, timestamp: 1725000000, type: 1, message: 'modern seconds' }];
  const rows = await c.logs(1);
  assert.equal(rows[0].timestamp, 1725000000);
}

{
  const c = new Client();
  let requested = '';
  c.request = async path => { requested = path; return []; };
  await c.logs(42);
  assert.match(requested, /last_known_id=42/);
  assert.match(requested, /normal=true/);
  assert.match(requested, /critical=true/);
}

console.log('v0.3.2 log compatibility fixtures passed');
