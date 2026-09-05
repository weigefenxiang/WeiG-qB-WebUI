import assert from 'node:assert/strict';
import { createWorld, authenticate } from '../simulator/core/engine.js';
import { createPreferenceRuntime } from '../simulator/preferences/runtime.js';
import { createPreferenceStore } from '../simulator/preferences/store.js';

const MiB = 1024 * 1024;

{
  const store = createPreferenceStore({ a: 1 });
  store.patch({ b: 2, c: 3 });
  assert.deepEqual(store.all(), { a: 1, b: 2, c: 3 }, 'store.patch must merge preference patches');
  store.set('a', 4);
  assert.equal(store.get('a'), 4, 'store.set must keep key/value semantics');
}

{
  const preferenceKeys = [
    'queueing_enabled',
    'max_active_downloads',
    'max_active_uploads',
    'max_active_torrents',
    'dl_limit',
    'disk_cache',
    'disk_cache_ttl',
    'disk_io_type',
    'disk_io_read_mode',
    'disk_io_write_mode',
    'enable_coalesce_read_write',
    'checking_memory_use',
    'memory_working_set_limit',
    'file_pool_size',
    'scan_dirs',
    'future_scalar'
  ];
  const world = createWorld({
    profile: { qbVersion: '5.2.3', webApiVersion: '2.15.1', preferenceKeys },
    count: 80,
    seed: 'preference-runtime-contract',
    now: 1700000000000
  });
  authenticate(world, 'demo', 'demo', 1700000000000);
  const runtime = createPreferenceRuntime(world);
  const initial = runtime.read();

  assert.deepEqual(Object.keys(initial), preferenceKeys, 'runtime surface must follow the exact upstream preference key list');
  assert.equal(initial.disk_cache, -1, 'missing known numeric preferences must receive a safe simulated default');
  assert.equal(initial.disk_cache_ttl, 60);
  assert.equal(initial.disk_io_read_mode, 1);
  assert.equal(initial.enable_coalesce_read_write, false, 'missing known boolean preferences must keep boolean type');
  assert.deepEqual(initial.scan_dirs, {}, 'structured upstream preferences must retain a structured read-only fallback');
  assert.equal(initial.future_scalar, '', 'unknown scalar preferences must remain visible instead of being dropped');

  const accepted = runtime.write({
    max_active_downloads: '2',
    max_active_uploads: 3,
    max_active_torrents: 4,
    dl_limit: 140 * MiB,
    future_scalar: 'visible',
    scan_dirs: { '/watch': 1 },
    not_in_upstream_surface: true
  }, 1700000001000);

  assert.equal(accepted.max_active_downloads, 2, 'modeled numeric bindings must normalize values');
  assert.equal(world.preferences.max_active_downloads, 2, 'runtime writes must reach the canonical world preferences');
  assert.equal(world.globalDownloadLimit, 140 * MiB, 'dl_limit must keep the existing scheduler side effect');
  assert.equal(world.preferences.future_scalar, 'visible', 'unknown scalar preferences must be stateful');
  assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'scan_dirs'), 'unknown structured preferences must fail closed on write');
  assert.ok(!Object.prototype.hasOwnProperty.call(world.preferences, 'not_in_upstream_surface'), 'keys absent from the selected qB version must be ignored');

  const reread = createPreferenceRuntime(world).read();
  assert.equal(reread.future_scalar, 'visible', 'stateful fallback values must survive runtime reconstruction');
  assert.deepEqual(reread.scan_dirs, {}, 'read-only structured fallback must remain stable');
}

console.log('Virtual qB preference runtime contract passed: exact upstream surface, safe fallback values, stateful unknown scalars, read-only structured values and canonical scheduler side effects.');
