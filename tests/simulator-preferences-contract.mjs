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
    'schedule_from_hour',
    'schedule_from_min',
    'schedule_to_hour',
    'schedule_to_min',
    'scheduler_days',
    'dht',
    'pex',
    'max_active_downloads',
    'max_active_uploads',
    'max_active_torrents',
    'max_active_checking_torrents',
    'dont_count_slow_torrents',
    'slow_torrent_dl_rate_threshold',
    'slow_torrent_ul_rate_threshold',
    'slow_torrent_inactive_timer',
    'max_inactive_seeding_time',
    'max_inactive_seeding_time_enabled',
    'max_ratio_act',
    'encryption',
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
  assert.equal(descriptors.get('max_active_checking_torrents').coverage,'MODELED','checking concurrency is enforced by the virtual recheck action');
  assert.equal(descriptors.get('dont_count_slow_torrents').coverage,'MODELED','slow torrent exclusion must have a real scheduler effect');
  assert.equal(descriptors.get('max_inactive_seeding_time').coverage,'MODELED','inactive seeding time must feed the canonical share-limit policy');
  assert.equal(descriptors.get('max_ratio_act').coverage,'MODELED','global share-limit action must drive the canonical share-limit action owner');
  assert.equal(descriptors.get('encryption').coverage,'MODELED','encryption mode changes the compatible virtual peer population');
  assert.equal(descriptors.get('scheduler_enabled').coverage,'MODELED','scheduler_enabled must drive the alternate-rate time-window policy');
  for(const key of ['schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min','scheduler_days'])assert.equal(descriptors.get(key).coverage,'MODELED',`${key} must participate in the alternate-rate schedule`);
  assert.equal(descriptors.get('pex').coverage,'MODELED','PeX must not be called behavior-modeled when no simulator side effect consumes it');

  const coverage = runtime.coverage();
  assert.equal(coverage.unknown, 1, 'only truly unresolved preference values should be UNKNOWN');
  assert.deepEqual(coverage.unknownKeys, ['opaque_future']);
  assert.ok(coverage.bindings.modeled.includes('queueing_enabled'));
  assert.ok(coverage.bindings.effects.queueing_enabled,'modeled bindings must identify the simulator side effect they own');
  assert.ok(coverage.bindings.modeled.includes('scheduler_enabled'));
  assert.ok(coverage.bindings.modeled.includes('pex'));
  assert.equal(coverage.bindings.effects.max_active_checking_torrents,'checking-concurrency');
  assert.equal(coverage.bindings.effects.encryption,'peer-encryption-compatibility');

  const accepted = runtime.write({
    max_active_downloads: '2',
    scheduler_enabled:true,
    schedule_from_hour:25,
    schedule_from_min:61,
    schedule_to_hour:-3,
    schedule_to_min:-4,
    scheduler_days:12,
    max_active_uploads: 3,
    max_active_torrents: 4,
    max_active_checking_torrents: 2,
    dont_count_slow_torrents:true,
    slow_torrent_dl_rate_threshold:3,
    slow_torrent_ul_rate_threshold:4,
    slow_torrent_inactive_timer:30,
    max_inactive_seeding_time:12,
    max_inactive_seeding_time_enabled:true,
    max_ratio_act:9,
    encryption: 9,
    dl_limit: 140 * MiB,
    max_ratio:'2.5',
    future_scalar: 'visible',
    opaque_future: 'must-not-stick',
    scan_dirs: { '/watch': 1 },
    not_in_upstream_surface: true
  }, 1700000001000);

  assert.equal(accepted.max_active_downloads, 2, 'modeled numeric bindings must normalize values');
  assert.equal(accepted.schedule_from_hour,23);assert.equal(accepted.schedule_from_min,59);assert.equal(accepted.schedule_to_hour,0);assert.equal(accepted.schedule_to_min,0);assert.equal(accepted.scheduler_days,9);
  assert.equal(world.preferences.max_active_downloads, 2, 'runtime writes must reach the canonical world preferences');
  assert.equal(world.preferences.max_active_checking_torrents,2,'checking concurrency writes must reach canonical world preferences');
  assert.equal(world.preferences.dont_count_slow_torrents,true,'slow torrent queue exclusion must persist');
  assert.equal(world.preferences.slow_torrent_inactive_timer,30,'slow torrent timer must persist');
  assert.equal(world.preferences.max_inactive_seeding_time,12,'inactive seeding limit must persist');
  assert.equal(accepted.max_ratio_act,3,'global share-limit action must clamp to the qB WebAPI 0..3 enum');
  assert.equal(accepted.encryption,2,'encryption writes must clamp to qB modes 0..2');
  assert.equal(world.preferences.encryption,2,'clamped encryption mode must persist in the canonical world');
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
