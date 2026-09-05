import { hasKnownPreferenceDefault, knownPreferenceDefault } from './defaults.js';
import {
  PreferenceCoverage,
  PreferenceProvenance,
  PreferenceType,
  isPreferenceType,
  normalizePreferenceCoverage,
  preferenceTypeOf
} from './types.js';

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}

function hasOwn(object, key) {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
}

function descriptorMap(input) {
  const out = new Map();
  if (Array.isArray(input)) {
    for (const entry of input) {
      if (entry && entry.key != null) out.set(String(entry.key), { ...entry, key: String(entry.key) });
    }
  }
  else if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      out.set(String(key), value && typeof value === 'object'
        ? { ...value, key: String(key) }
        : { key: String(key) });
    }
  }
  return out;
}

export function preferenceValueMatchesType(value, type) {
  if (!isPreferenceType(type)) return true;
  switch (type) {
    case PreferenceType.BOOLEAN: return typeof value === 'boolean';
    case PreferenceType.NUMBER: return typeof value === 'number' && Number.isFinite(value);
    case PreferenceType.STRING: return typeof value === 'string';
    case PreferenceType.ARRAY: return Array.isArray(value);
    case PreferenceType.OBJECT: return !!value && typeof value === 'object' && !Array.isArray(value);
    default: return false;
  }
}

export function preferencePlaceholder(type) {
  switch (type) {
    case PreferenceType.BOOLEAN: return false;
    case PreferenceType.NUMBER: return 0;
    case PreferenceType.ARRAY: return [];
    case PreferenceType.OBJECT: return {};
    default: return '';
  }
}

function selectCandidate(candidates, declaredType) {
  const rejected = [];
  for (const candidate of candidates) {
    if (!candidate.present) continue;
    if (declaredType && !preferenceValueMatchesType(candidate.value, declaredType)) {
      rejected.push(candidate.provenance);
      continue;
    }
    return {value: cloneValue(candidate.value), provenance: candidate.provenance, rejected};
  }
  return {value: preferencePlaceholder(declaredType || PreferenceType.STRING), provenance: PreferenceProvenance.SAFE_PLACEHOLDER, rejected};
}

export function buildPreferenceDescriptors(base = {}, keys = null, options = {}) {
  const source = base && typeof base === 'object' ? base : {};
  const wanted = Array.isArray(keys) ? keys.map(String) : Object.keys(source);
  const explicit = descriptorMap(options.profileDescriptors);
  const profileDefaults = options.profileDefaults && typeof options.profileDefaults === 'object'
    ? options.profileDefaults
    : {};
  const inherited = options.inheritedPreferences && typeof options.inheritedPreferences === 'object'
    ? options.inheritedPreferences
    : {};
  const modeled = new Set(Array.isArray(options.modeledKeys) ? options.modeledKeys.map(String) : []);
  const out = [];

  for (const key of wanted) {
    const declared = explicit.get(key) || {};
    const declaredType = isPreferenceType(declared.type) ? declared.type : null;
    const known = hasKnownPreferenceDefault(key) ? knownPreferenceDefault(key) : undefined;
    const selected = selectCandidate([
      {present: hasOwn(source, key), value: source[key], provenance: PreferenceProvenance.WORLD},
      {present: hasOwn(declared, 'default'), value: declared.default, provenance: PreferenceProvenance.PROFILE},
      {present: hasOwn(profileDefaults, key), value: profileDefaults[key], provenance: PreferenceProvenance.PROFILE},
      {present: hasKnownPreferenceDefault(key), value: known, provenance: PreferenceProvenance.KNOWN_DEFAULT},
      {present: hasOwn(inherited, key), value: inherited[key], provenance: PreferenceProvenance.INHERITED}
    ], declaredType);
    const value = selected.value;
    const provenance = selected.provenance;
    const type = declaredType || preferenceTypeOf(value);
    const structured = type === PreferenceType.ARRAY || type === PreferenceType.OBJECT;
    let coverage;

    if (Object.values(PreferenceCoverage).includes(declared.coverage)) {
      coverage = normalizePreferenceCoverage(declared.coverage);
    }
    else if (modeled.has(key)) {
      coverage = PreferenceCoverage.MODELED;
    }
    else if (provenance === PreferenceProvenance.SAFE_PLACEHOLDER) {
      coverage = PreferenceCoverage.UNKNOWN;
    }
    else if (structured) {
      coverage = PreferenceCoverage.READ_ONLY;
    }
    else {
      coverage = PreferenceCoverage.STATEFUL;
    }

    let writable = typeof declared.writable === 'boolean'
      ? declared.writable
      : (coverage === PreferenceCoverage.MODELED || coverage === PreferenceCoverage.STATEFUL);

    if (structured || coverage === PreferenceCoverage.READ_ONLY || coverage === PreferenceCoverage.UNKNOWN) {
      writable = false;
    }

    out.push(Object.freeze({
      key,
      type,
      coverage,
      writable,
      provenance,
      exactValue: provenance !== PreferenceProvenance.SAFE_PLACEHOLDER,
      valueTypeVerified: preferenceValueMatchesType(value, type),
      rejectedValueSources: selected.rejected.slice(),
      schemaSource: declared.source || null,
      sourceConfidence: declared.sourceConfidence || null,
      setterPresent: typeof declared.setterPresent === 'boolean' ? declared.setterPresent : null,
      upstreamWritable: declared.setterPresent === true,
      value: cloneValue(value)
    }));
  }

  return out;
}

export function materializePreferenceSurface(descriptors = []) {
  return Object.fromEntries((descriptors || []).map((descriptor) => [descriptor.key, cloneValue(descriptor.value)]));
}

export function descriptorLookup(descriptors = []) {
  return new Map((descriptors || []).map((descriptor) => [String(descriptor.key), descriptor]));
}

export function summarizePreferenceCoverage(descriptors = []) {
  const items = Array.isArray(descriptors) ? descriptors : [];
  const byCoverage = Object.fromEntries(Object.values(PreferenceCoverage).map((mode) => [mode, 0]));
  const byProvenance = Object.fromEntries(Object.values(PreferenceProvenance).map((source) => [source, 0]));
  const unknownKeys = [];
  const readOnlyKeys = [];
  const repairedKeys = [];
  let exactValueCount = 0;
  let upstreamSetterCount = 0;
  let highConfidenceSchemaCount = 0;

  for (const item of items) {
    byCoverage[item.coverage] = (byCoverage[item.coverage] || 0) + 1;
    byProvenance[item.provenance] = (byProvenance[item.provenance] || 0) + 1;
    if (item.coverage === PreferenceCoverage.UNKNOWN) unknownKeys.push(item.key);
    if (item.writable === false) readOnlyKeys.push(item.key);
    if (item.exactValue) exactValueCount++;
    if (item.setterPresent === true) upstreamSetterCount++;
    if (item.sourceConfidence === 'HIGH') highConfidenceSchemaCount++;
    if (Array.isArray(item.rejectedValueSources) && item.rejectedValueSources.length) repairedKeys.push(item.key);
  }

  return {
    total: items.length,
    modeled: byCoverage[PreferenceCoverage.MODELED] || 0,
    stateful: byCoverage[PreferenceCoverage.STATEFUL] || 0,
    readOnly: byCoverage[PreferenceCoverage.READ_ONLY] || 0,
    unknown: byCoverage[PreferenceCoverage.UNKNOWN] || 0,
    exactValueCount,
    provisionalValueCount: items.length - exactValueCount,
    upstreamSetterCount,
    highConfidenceSchemaCount,
    repairedValueCount: repairedKeys.length,
    repairedKeys,
    byCoverage,
    byProvenance,
    unknownKeys,
    readOnlyKeys
  };
}
