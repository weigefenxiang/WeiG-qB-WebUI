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
    'scheduler_enabled',
    'dht',
    'pex',
    'max_active_downloads',
    'max_active_uploads',
    'max_active_torrents',
    'dl_limit',
    'max_ratio',
    'max_ratio_enabled',
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
    'future_scalar',
    'opaque_future'
  ];
  const world = createWorld({
    profile: {
      qbVersion: '5.2.3',
      webApiVersion: '2.15.1',
      preferenceKeys,
      preferenceDescriptors: [
        { key: 'future_scalar', type: 'string', coverage: 'STATEFUL', writable: true, default: '' }
      ]
    },
    count: 80,
    seed: 'preference-runtime-contract',
    now: 1700000000000
  });
  authenticate(world, 'demo', 'demo', 1700000000000);
  const runtime = createPreferenceRuntime(world);
  const initial = runtime.read();

  assert.deepEqual(Object.keys(initial), preferenceKeys, 'runtime surface must follow the exact upstream preference key list');
  assert.equal(initial.disk_cache, -1, 'missing known numeric preferences must receive a known simulated default');
  assert.equal(initial.disk_cache_ttl, 60);
  assert.equal(initial.disk_io_read_mode, 1);
  assert.equal(initial.enable_coalesce_read_write, false, 'missing known boolean preferences must keep boolean type');
  assert.deepEqual(initial.scan_dirs, {}, 'structured upstream preferences must retain a structured read-only fallback');
  assert.equal(initial.future_scalar, '', 'typed future scalar preferences may use a profile-proven fallback');
  assert.equal(initial.opaque_future, '', 'truly unknown preferences stay visible with a transport placeholder');

  const descriptors = new Map(runtime.descriptors().map((item) => [item.key, item]));
  assert.equal(descriptors.get('queueing_enabled').coverage,'MODELED','queueing controls the real virtual scheduler and may claim MODELED coverage');
  assert.equal(descriptors.get('dht').coverage,'MODELED','DHT changes the transfer/server-state projection');
  assert.equal(descriptors.get('max_ratio').coverage,'MODELED','share-ratio thresholds participate in scheduler policy');
  assert.equal(descriptors.get('scheduler_enabled').coverage,'STATEFUL','scheduler_enabled is normalized state only until time-window behavior is implemented');
  assert.equal(descriptors.get('pex').coverage,'STATEFUL','PeX must not be called behavior-modeled when no simulator side effect consumes it');

  const coverage = runtime.coverage();
  assert.equal(coverage.unknown, 1, 'only truly unresolved preference values should be UNKNOWN');
  assert.deepEqual(coverage.unknownKeys, ['opaque_future']);
  assert.ok(coverage.bindings.modeled.includes('queueing_enabled'));
  assert.ok(coverage.bindings.effects.queueing_enabled,'modeled bindings must identify the simulator side effect they own');
  assert.ok(coverage.bindings.normalizationOnly.includes('scheduler_enabled'));
  assert.ok(coverage.bindings.normalizationOnly.includes('pex'));

  const accepted = runtime.write({
    max_active_downloads: '2',
    max_active_uploads: 3,
    max_active_torrents: 4,
    dl_limit: 140 * MiB,
    max_ratio:'2.5',
    future_scalar: 'visible',
    opaque_future: 'must-not-stick',
    scan_dirs: { '/watch': 1 },
    not_in_upstream_surface: true
  }, 1700000001000);

  assert.equal(accepted.max_active_downloads, 2, 'modeled numeric bindings must normalize values');
  assert.equal(world.preferences.max_active_downloads, 2, 'runtime writes must reach the canonical world preferences');
  assert.equal(world.globalDownloadLimit, 140 * MiB, 'dl_limit must keep the existing scheduler side effect');
  assert.equal(accepted.max_ratio,2.5,'modeled ratio policy values must retain non-negative numeric semantics');
  assert.equal(world.preferences.future_scalar, 'visible', 'typed STATEFUL future preferences may persist safely');
  assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'opaque_future'), 'UNKNOWN preferences must fail closed on write');
  assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'scan_dirs'), 'structured preferences must fail closed on write');
  assert.ok(!Object.prototype.hasOwnProperty.call(world.preferences, 'not_in_upstream_surface'), 'keys absent from the selected qB version must be ignored');

  const reread = createPreferenceRuntime(world).read();
  assert.equal(reread.future_scalar, 'visible', 'stateful values must survive runtime reconstruction');
  assert.equal(reread.opaque_future, '', 'UNKNOWN placeholder must remain non-stateful and deterministic');
  assert.deepEqual(reread.scan_dirs, {}, 'read-only structured fallback must remain stable');
}

console.log('Virtual qB preference runtime contract passed: exact upstream surface, source-safe writes, behavior-only MODELED bindings, explicit normalization-only state, UNKNOWN fail-closed behavior and canonical scheduler side effects.');
