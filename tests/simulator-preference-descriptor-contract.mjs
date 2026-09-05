import assert from 'node:assert/strict';
import { createWorld } from '../simulator/core/engine.js';
import { normalizeProfile } from '../simulator/core/profiles.js';
import { createPreferenceRuntime } from '../simulator/preferences/runtime.js';
import { PreferenceCoverage, PreferenceProvenance } from '../simulator/preferences/types.js';

const profile = normalizeProfile({
  qbVersion: '5.2.3',
  webApiVersion: '2.15.1',
  preferenceKeys: [
    'dl_limit',
    'disk_cache',
    'profile_number',
    'inherited_number',
    'typed_future',
    'structured_future',
    'opaque_future'
  ],
  preferenceDescriptors: [
    { key: 'profile_number', type: 'number', coverage: 'STATEFUL', writable: true, default: 7 },
    { key: 'typed_future', type: 'boolean', coverage: 'STATEFUL', writable: true, default: true },
    { key: 'structured_future', type: 'object', coverage: 'READ_ONLY', writable: true, default: { mode: 'safe' } }
  ],
  preferenceInheritedDefaults: {
    inherited_number: 42
  }
});

assert.equal(profile.preferenceDescriptors.length, 3, 'profile normalization must retain descriptor metadata');
assert.equal(profile.preferenceInheritedDefaults.inherited_number, 42, 'profile normalization must retain inherited defaults');

const world = createWorld({
  profile,
  count: 10,
  seed: 'preference-descriptor-contract',
  now: 1700000000000
});
const runtime = createPreferenceRuntime(world);
const byKey = new Map(runtime.descriptors().map((item) => [item.key, item]));

assert.equal(byKey.get('dl_limit').coverage, PreferenceCoverage.MODELED, 'registered behavior bindings must be MODELED');
assert.equal(byKey.get('dl_limit').provenance, PreferenceProvenance.WORLD, 'canonical world values must win descriptor precedence');
assert.equal(byKey.get('dl_limit').writeSchemaSource, 'MODELED_BINDING', 'legacy profiles without upstream schema must keep modeled binding write ownership');
assert.equal(byKey.get('disk_cache').provenance, PreferenceProvenance.KNOWN_DEFAULT, 'known defaults must carry explicit provenance');
assert.equal(byKey.get('profile_number').provenance, PreferenceProvenance.PROFILE, 'profile-provided defaults must outrank inheritance');
assert.equal(byKey.get('inherited_number').provenance, PreferenceProvenance.INHERITED, 'compatible prior defaults must be inherited with provenance');
assert.equal(byKey.get('inherited_number').writeSchemaSource, 'LEGACY_STATEFUL', 'descriptor-less inherited scalars must retain legacy stateful write semantics');
assert.equal(byKey.get('inherited_number').writeNormalizationType, 'number', 'legacy stateful writes must normalize to the trusted current scalar type');
assert.equal(byKey.get('typed_future').coverage, PreferenceCoverage.STATEFUL);
assert.equal(byKey.get('structured_future').coverage, PreferenceCoverage.READ_ONLY, 'structured values must remain read-only even when a profile accidentally marks writable');
assert.equal(byKey.get('structured_future').writable, false);
assert.equal(byKey.get('opaque_future').coverage, PreferenceCoverage.UNKNOWN);
assert.equal(byKey.get('opaque_future').provenance, PreferenceProvenance.SAFE_PLACEHOLDER);
assert.equal(byKey.get('opaque_future').writable, false, 'unknown semantics must fail closed instead of guessing writes');

const initial = runtime.read();
assert.equal(initial.profile_number, 7);
assert.equal(initial.inherited_number, 42);
assert.equal(initial.typed_future, true);
assert.deepEqual(initial.structured_future, { mode: 'safe' });

const accepted = runtime.write({
  profile_number: '9',
  inherited_number: '43',
  typed_future: 'false',
  structured_future: { mode: 'unsafe' },
  opaque_future: 123
}, 1700000001000);

assert.equal(accepted.profile_number, 9, 'descriptor number writes must preserve numeric type');
assert.equal(accepted.inherited_number, 43, 'inherited scalar values remain safely stateful and type-normalized');
assert.equal(accepted.typed_future, false, 'descriptor boolean writes must preserve boolean type');
assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'structured_future'));
assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'opaque_future'));

const report = runtime.coverage();
assert.equal(report.total, profile.preferenceKeys.length);
assert.equal(report.unknown, 1);
assert.equal(report.provisionalValueCount, 1);
assert.deepEqual(report.unknownKeys, ['opaque_future']);
assert.ok(report.modeled >= 1, 'coverage report must expose behavior-modeled keys');
assert.ok(report.stateful >= 3, 'coverage report must expose safe stateful keys');
assert.ok(report.readOnly >= 1, 'coverage report must expose read-only keys');

for (const qbVersion of ['4.1.0', '4.6.7', '5.0.0', '5.2.3']) {
  const generation = Number(qbVersion.split('.')[0]) >= 5 ? 'qb5' : 'qb4';
  const normalized = normalizeProfile({
    qbVersion,
    webApiVersion: '2.15.1',
    protocolGeneration: generation,
    preferenceKeys: ['dl_limit', 'opaque_future']
  });
  const generationWorld = createWorld({
    profile: normalized,
    count: 1,
    seed: `descriptor-${qbVersion}`,
    now: 1700000000000
  });
  const generationRuntime = createPreferenceRuntime(generationWorld);
  assert.deepEqual(generationRuntime.keys(), ['dl_limit', 'opaque_future'], `${qbVersion}: exact preference surface must survive descriptor construction`);
  assert.equal(generationRuntime.coverage().unknown, 1, `${qbVersion}: unresolved keys must fail closed consistently across qB4/qB5`);
}

console.log('Virtual qB preference descriptor contract passed: upstream schema v2, modeled bindings, legacy inherited scalars, coverage modes, provenance, type-stable writes, structured fail-closed behavior and qB4/qB5 surface preservation.');
