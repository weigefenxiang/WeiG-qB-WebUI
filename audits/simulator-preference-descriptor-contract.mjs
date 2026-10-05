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
    'source_writable_unknown',
    'structured_future',
    'opaque_future'
  ],
  preferenceDescriptors: [
    { key: 'profile_number', type: 'number', coverage: 'STATEFUL', writable: true, default: 7 },
    { key: 'typed_future', type: 'boolean', coverage: 'STATEFUL', writable: true, default: true },
    {
      key: 'source_writable_unknown',
      readType: 'string',
      writeType: 'string',
      getterPresent: true,
      setterPresent: true,
      getterSource: 'UPSTREAM_GETTER',
      setterSource: 'UPSTREAM_SETTER',
      getterConfidence: 'HIGH',
      setterConfidence: 'HIGH',
      source: 'UPSTREAM_GETTER_SETTER',
      sourceConfidence: 'HIGH',
      typeAgreement: 'EXACT',
      writable: true
    },
    { key: 'structured_future', type: 'object', coverage: 'READ_ONLY', writable: true, default: { mode: 'safe' } }
  ],
  preferenceInheritedDefaults: {
    inherited_number: 42
  }
});

assert.equal(profile.preferenceDescriptors.length, 4, 'profile normalization must retain descriptor metadata');
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
assert.equal(byKey.get('source_writable_unknown').coverage, PreferenceCoverage.UNKNOWN, 'missing startup-value proof must remain UNKNOWN even with a verified upstream setter');
assert.equal(byKey.get('source_writable_unknown').provenance, PreferenceProvenance.SAFE_PLACEHOLDER);
assert.equal(byKey.get('source_writable_unknown').writable, true, 'a HIGH-confidence upstream setter and write type must remain writable even when the startup value is unknown');
assert.equal(byKey.get('source_writable_unknown').writeSchemaSource, 'UPSTREAM_SETTER');
assert.equal(byKey.get('structured_future').coverage, PreferenceCoverage.READ_ONLY, 'structured values must remain read-only even when a profile accidentally marks writable');
assert.equal(byKey.get('structured_future').writable, false);
assert.equal(byKey.get('opaque_future').coverage, PreferenceCoverage.UNKNOWN);
assert.equal(byKey.get('opaque_future').provenance, PreferenceProvenance.SAFE_PLACEHOLDER);
assert.equal(byKey.get('opaque_future').writable, false, 'unknown semantics without a verified upstream write contract must fail closed');

const initial = runtime.read();
assert.equal(initial.profile_number, 7);
assert.equal(initial.inherited_number, 42);
assert.equal(initial.typed_future, true);
assert.equal(initial.source_writable_unknown, '');
assert.deepEqual(initial.structured_future, { mode: 'safe' });

const accepted = runtime.write({
  profile_number: '9',
  inherited_number: '43',
  typed_future: 'false',
  source_writable_unknown: 'zh_CN',
  structured_future: { mode: 'unsafe' },
  opaque_future: 123
}, 1700000001000);

assert.equal(accepted.profile_number, 9, 'descriptor number writes must preserve numeric type');
assert.equal(accepted.inherited_number, 43, 'inherited scalar values remain safely stateful and type-normalized');
assert.equal(accepted.typed_future, false, 'descriptor boolean writes must preserve boolean type');
assert.equal(accepted.source_writable_unknown, 'zh_CN', 'verified upstream string setters must accept an explicit value even when the startup value was unknown');
assert.equal(runtime.read().source_writable_unknown, 'zh_CN', 'verified upstream writes must persist into the rebuilt preference surface');
assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'structured_future'));
assert.ok(!Object.prototype.hasOwnProperty.call(accepted, 'opaque_future'));

const report = runtime.coverage();
assert.equal(report.total, profile.preferenceKeys.length);
assert.equal(report.unknown, 1);
assert.equal(report.provisionalValueCount, 2, 'curated defaults and unresolved placeholders are provisional rather than exact upstream defaults');
assert.deepEqual(report.unknownKeys, ['opaque_future']);
assert.ok(report.modeled >= 1, 'coverage report must expose behavior-modeled keys');
assert.ok(report.stateful >= 4, 'coverage report must expose safe stateful keys after verified upstream writes persist');
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

console.log('Virtual qB preference descriptor contract passed: verified upstream write schemas survive unknown startup values, opaque semantics still fail closed, modeled bindings, legacy inherited scalars, coverage modes, provenance, type-stable writes, structured fail-closed behavior and qB4/qB5 surface preservation.');
