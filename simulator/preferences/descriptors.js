import { hasKnownPreferenceDefault, knownPreferenceDefault } from './defaults.js';
import {
  PreferenceCoverage,
  PreferenceProvenance,
  PreferenceType,
  PreferenceTypeAgreement,
  isPreferenceType,
  normalizePreferenceCoverage,
  normalizePreferenceTypeAgreement,
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
    return {
      value: cloneValue(candidate.value),
      provenance: candidate.provenance,
      exactValue: candidate.exactValue !== false,
      rejected
    };
  }
  return {
    value: preferencePlaceholder(declaredType || PreferenceType.STRING),
    provenance: PreferenceProvenance.SAFE_PLACEHOLDER,
    exactValue: false,
    rejected
  };
}

function declaredTypes(declared = {}) {
  const hasReadSchema = hasOwn(declared, 'readType');
  const hasWriteSchema = hasOwn(declared, 'writeType');
  const declaredReadType = isPreferenceType(declared.readType) ? declared.readType : null;
  const declaredWriteType = isPreferenceType(declared.writeType) ? declared.writeType : null;
  const legacyType = isPreferenceType(declared.type) ? declared.type : null;
  // Legacy/manual descriptors predate schema v2. Only those may use `type` as both sides.
  const readType = hasReadSchema ? declaredReadType : legacyType;
  const writeType = hasWriteSchema ? declaredWriteType : legacyType;
  const agreement = normalizePreferenceTypeAgreement(declared.typeAgreement,
    readType && writeType
      ? (readType === writeType ? PreferenceTypeAgreement.EXACT : PreferenceTypeAgreement.MISMATCH)
      : PreferenceTypeAgreement.UNRESOLVED);
  // Once a profile explicitly carries readType, only getter truth may validate GET/persisted values.
  // writeType remains a POST contract and must never silently become read truth.
  const valueType = hasReadSchema ? declaredReadType : legacyType;
  return { readType, writeType, legacyType, agreement, valueType, hasReadSchema, hasWriteSchema };
}

function safeFallbackCandidate(declared, expectedType) {
  const present = hasOwn(declared, 'upstreamFallbackValue')
    && declared.upstreamFallbackValue !== null
    && declared.upstreamFallbackValue !== undefined;
  return {
    present,
    value: declared.upstreamFallbackValue,
    provenance: PreferenceProvenance.UPSTREAM_FALLBACK,
    exactValue: false,
    compatible: !present || !expectedType || preferenceValueMatchesType(declared.upstreamFallbackValue, expectedType)
  };
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
    const { readType, writeType, agreement, valueType } = declaredTypes(declared);
    const known = hasKnownPreferenceDefault(key) ? knownPreferenceDefault(key) : undefined;
    const fallback = safeFallbackCandidate(declared, valueType);
    const selected = selectCandidate([
      {present: hasOwn(source, key), value: source[key], provenance: PreferenceProvenance.WORLD},
      {present: hasOwn(declared, 'upstreamDefaultValue'), value: declared.upstreamDefaultValue, provenance: PreferenceProvenance.UPSTREAM_DEFAULT},
      {present: hasOwn(declared, 'default'), value: declared.default, provenance: PreferenceProvenance.PROFILE},
      {present: hasOwn(profileDefaults, key), value: profileDefaults[key], provenance: PreferenceProvenance.PROFILE},
      {present: hasKnownPreferenceDefault(key), value: known, provenance: PreferenceProvenance.KNOWN_DEFAULT},
      {present: hasOwn(inherited, key), value: inherited[key], provenance: PreferenceProvenance.INHERITED},
      {present: fallback.present && fallback.compatible, value: fallback.value, provenance: fallback.provenance, exactValue: false}
    ], valueType);
    const value = selected.value;
    const provenance = selected.provenance;
    const type = valueType || preferenceTypeOf(value);
    const structured = type === PreferenceType.ARRAY || type === PreferenceType.OBJECT;
    const getterOnly = declared.getterPresent === true && declared.setterPresent === false;
    const conflict = agreement === PreferenceTypeAgreement.MISMATCH;
    const hasExplicitWriteSchema = hasOwn(declared, 'writeType') || typeof declared.setterPresent === 'boolean';
    const bindingOwnsWrite = modeled.has(key) && !hasExplicitWriteSchema;
    let coverage;

    if (Object.values(PreferenceCoverage).includes(declared.coverage)) {
      coverage = normalizePreferenceCoverage(declared.coverage);
    }
    else if (modeled.has(key)) {
      coverage = PreferenceCoverage.MODELED;
    }
    else if (conflict || provenance === PreferenceProvenance.SAFE_PLACEHOLDER) {
      coverage = PreferenceCoverage.UNKNOWN;
    }
    else if (structured || getterOnly) {
      coverage = PreferenceCoverage.READ_ONLY;
    }
    else {
      coverage = PreferenceCoverage.STATEFUL;
    }

    let writable = typeof declared.writable === 'boolean'
      ? declared.writable
      : (coverage === PreferenceCoverage.MODELED || coverage === PreferenceCoverage.STATEFUL);

    if (declared.setterPresent === false || (!writeType && !bindingOwnsWrite) || structured || conflict
      || coverage === PreferenceCoverage.READ_ONLY || coverage === PreferenceCoverage.UNKNOWN) {
      writable = false;
    }

    out.push(Object.freeze({
      key,
      type,
      readType,
      writeType,
      typeAgreement: agreement,
      coverage,
      writable,
      provenance,
      exactValue: selected.exactValue,
      valueTypeVerified: preferenceValueMatchesType(value, readType || type),
      writeTypeCompatible: !writeType || preferenceValueMatchesType(value, writeType),
      writeSchemaSource: writeType ? (declared.setterSource || 'DECLARED_TYPE') : (bindingOwnsWrite ? 'MODELED_BINDING' : null),
      rejectedValueSources: selected.rejected.slice(),
      schemaSource: declared.source || null,
      sourceConfidence: declared.sourceConfidence || null,
      getterPresent: typeof declared.getterPresent === 'boolean' ? declared.getterPresent : null,
      setterPresent: typeof declared.setterPresent === 'boolean' ? declared.setterPresent : null,
      getterKind: declared.getterKind || null,
      setterKind: declared.setterKind || null,
      getterSource: declared.getterSource || null,
      setterSource: declared.setterSource || null,
      getterConfidence: declared.getterConfidence || null,
      setterConfidence: declared.setterConfidence || null,
      upstreamWritable: declared.setterPresent === true,
      upstreamFallbackExpression: declared.upstreamFallbackExpression || null,
      upstreamFallbackValue: hasOwn(declared, 'upstreamFallbackValue') ? cloneValue(declared.upstreamFallbackValue) : null,
      upstreamFallbackConfidence: declared.upstreamFallbackConfidence || null,
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
  const byAgreement = Object.fromEntries(Object.values(PreferenceTypeAgreement).map((mode) => [mode, 0]));
  const unknownKeys = [];
  const readOnlyKeys = [];
  const repairedKeys = [];
  const typeConflictKeys = [];
  let exactValueCount = 0;
  let upstreamGetterCount = 0;
  let upstreamSetterCount = 0;
  let highConfidenceReadCount = 0;
  let highConfidenceWriteCount = 0;
  let upstreamFallbackCount = 0;

  for (const item of items) {
    byCoverage[item.coverage] = (byCoverage[item.coverage] || 0) + 1;
    byProvenance[item.provenance] = (byProvenance[item.provenance] || 0) + 1;
    byAgreement[item.typeAgreement] = (byAgreement[item.typeAgreement] || 0) + 1;
    if (item.coverage === PreferenceCoverage.UNKNOWN) unknownKeys.push(item.key);
    if (item.writable === false) readOnlyKeys.push(item.key);
    if (item.exactValue) exactValueCount++;
    if (item.getterPresent === true) upstreamGetterCount++;
    if (item.setterPresent === true) upstreamSetterCount++;
    if (item.getterConfidence === 'HIGH' && item.readType) highConfidenceReadCount++;
    if (item.setterConfidence === 'HIGH' && item.writeType) highConfidenceWriteCount++;
    if (item.provenance === PreferenceProvenance.UPSTREAM_FALLBACK) upstreamFallbackCount++;
    if (item.typeAgreement === PreferenceTypeAgreement.MISMATCH) typeConflictKeys.push(item.key);
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
    upstreamGetterCount,
    upstreamSetterCount,
    highConfidenceReadCount,
    highConfidenceWriteCount,
    highConfidenceSchemaCount:highConfidenceWriteCount,
    exactTypeAgreementCount: byAgreement[PreferenceTypeAgreement.EXACT] || 0,
    typeConflictCount: typeConflictKeys.length,
    typeConflictKeys,
    upstreamFallbackCount,
    repairedValueCount: repairedKeys.length,
    repairedKeys,
    byCoverage,
    byProvenance,
    byAgreement,
    unknownKeys,
    readOnlyKeys
  };
}
