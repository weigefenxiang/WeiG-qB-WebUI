function setOf(values) {
  return new Set(Array.isArray(values) ? values.map(String) : []);
}

function difference(left, right) {
  const rhs = setOf(right);
  return [...setOf(left)].filter((value) => !rhs.has(value)).sort();
}

function descriptorMap(profile) {
  return new Map((Array.isArray(profile?.preferenceDescriptors) ? profile.preferenceDescriptors : [])
    .filter((item) => item && item.key != null)
    .map((item) => [String(item.key), item]));
}

function schemaValue(item, key) {
  if (!item || !Object.prototype.hasOwnProperty.call(item, key)) return null;
  return item[key] ?? null;
}

function changed(before, now, key) {
  return schemaValue(before, key) !== schemaValue(now, key);
}

function pushChange(target, key, before, now, field) {
  if (!changed(before, now, field)) return false;
  target.push({key, from:schemaValue(before, field), to:schemaValue(now, field)});
  return true;
}

export function annotateCatalogEvolution(input = []) {
  const catalog = Array.isArray(input) ? input : [];
  const firstSeen = new Map();
  const firstWritable = new Map();
  const firstReadTyped = new Map();
  const firstWriteTyped = new Map();
  const lastSchemaChange = new Map();
  const lastReadTypeChange = new Map();
  const lastWriteTypeChange = new Map();

  for (let index = 0; index < catalog.length; index++) {
    const current = catalog[index];
    const previous = index > 0 ? catalog[index - 1] : null;
    const version = String(current?.qbVersion || '');
    const currentKeys = Array.isArray(current?.preferenceKeys) ? current.preferenceKeys.map(String) : [];
    const previousKeys = Array.isArray(previous?.preferenceKeys) ? previous.preferenceKeys.map(String) : [];
    const currentDescriptors = descriptorMap(current);
    const previousDescriptors = descriptorMap(previous);

    const added = previous ? difference(currentKeys, previousKeys) : [...currentKeys].sort();
    const removed = previous ? difference(previousKeys, currentKeys) : [];
    const typeChanged = [];
    const readTypeChanged = [];
    const writeTypeChanged = [];
    const writableChanged = [];
    const agreementChanged = [];
    const fallbackChanged = [];
    const getterKindChanged = [];
    const setterKindChanged = [];
    const semanticGetterChanged = [];

    for (const key of currentKeys) {
      if (!firstSeen.has(key)) firstSeen.set(key, version);
      const now = currentDescriptors.get(key);
      const before = previousDescriptors.get(key);
      if (now?.writable === true && !firstWritable.has(key)) firstWritable.set(key, version);
      if (now?.readType && !firstReadTyped.has(key)) firstReadTyped.set(key, version);
      if (now?.writeType && !firstWriteTyped.has(key)) firstWriteTyped.set(key, version);
      let schemaChanged = false;
      if (before) {
        if (pushChange(typeChanged,key,before,now,'type')) schemaChanged = true;
        if (pushChange(readTypeChanged,key,before,now,'readType')) {
          schemaChanged = true;
          lastReadTypeChange.set(key,version);
        }
        if (pushChange(writeTypeChanged,key,before,now,'writeType')) {
          schemaChanged = true;
          lastWriteTypeChange.set(key,version);
        }
        if (pushChange(writableChanged,key,before,now,'writable')) schemaChanged = true;
        if (pushChange(agreementChanged,key,before,now,'typeAgreement')) schemaChanged = true;
        if (pushChange(fallbackChanged,key,before,now,'upstreamFallbackValue')) schemaChanged = true;
        if (pushChange(getterKindChanged,key,before,now,'getterKind')) schemaChanged = true;
        if (pushChange(setterKindChanged,key,before,now,'setterKind')) schemaChanged = true;
        if (pushChange(semanticGetterChanged,key,before,now,'semanticGetterEnriched')) schemaChanged = true;
      }
      if (schemaChanged) lastSchemaChange.set(key, version);
      if (!lastSchemaChange.has(key)) lastSchemaChange.set(key, firstSeen.get(key));
      if (!lastReadTypeChange.has(key)) lastReadTypeChange.set(key, firstSeen.get(key));
      if (!lastWriteTypeChange.has(key)) lastWriteTypeChange.set(key, firstSeen.get(key));
    }

    current.releaseOrdinal = index;
    current.preferenceChanges = {
      added,
      removed,
      typeChanged,
      readTypeChanged,
      writeTypeChanged,
      writableChanged,
      agreementChanged,
      fallbackChanged,
      getterKindChanged,
      setterKindChanged,
      semanticGetterChanged
    };
    current.apiActionChanges = {
      added: previous ? difference(current.apiActions, previous.apiActions) : [...setOf(current.apiActions)].sort(),
      removed: previous ? difference(previous.apiActions, current.apiActions) : []
    };

    if (Array.isArray(current.preferenceDescriptors)) {
      current.preferenceDescriptors = current.preferenceDescriptors.map((descriptor) => ({
        ...descriptor,
        firstSeenInLabCatalog: firstSeen.get(String(descriptor.key)) || version,
        firstWritableInLabCatalog: firstWritable.get(String(descriptor.key)) || null,
        firstReadTypedInLabCatalog: firstReadTyped.get(String(descriptor.key)) || null,
        firstWriteTypedInLabCatalog: firstWriteTyped.get(String(descriptor.key)) || null,
        schemaLastChangedInLabCatalog: lastSchemaChange.get(String(descriptor.key)) || firstSeen.get(String(descriptor.key)) || version,
        readTypeLastChangedInLabCatalog: lastReadTypeChange.get(String(descriptor.key)) || firstSeen.get(String(descriptor.key)) || version,
        writeTypeLastChangedInLabCatalog: lastWriteTypeChange.get(String(descriptor.key)) || firstSeen.get(String(descriptor.key)) || version
      }));
    }
  }
  return catalog;
}

export function validateCatalogEvolution(catalog = []) {
  const profiles = Array.isArray(catalog) ? catalog : [];
  for (let index = 0; index < profiles.length; index++) {
    const profile = profiles[index];
    if (profile.releaseOrdinal !== index) throw new Error(`${profile.qbVersion}: invalid releaseOrdinal`);
    if (!profile.preferenceChanges || !profile.apiActionChanges) throw new Error(`${profile.qbVersion}: missing evolution metadata`);
    const keys = setOf(profile.preferenceKeys);
    const descriptors = Array.isArray(profile.preferenceDescriptors) ? profile.preferenceDescriptors : [];
    if (descriptors.length !== keys.size) throw new Error(`${profile.qbVersion}: descriptor/key evolution mismatch`);
    for (const descriptor of descriptors) {
      if (!keys.has(String(descriptor.key))) throw new Error(`${profile.qbVersion}: descriptor escaped preference surface: ${descriptor.key}`);
      if (!descriptor.firstSeenInLabCatalog) throw new Error(`${profile.qbVersion}: missing firstSeenInLabCatalog for ${descriptor.key}`);
      if (!descriptor.schemaLastChangedInLabCatalog) throw new Error(`${profile.qbVersion}: missing schemaLastChangedInLabCatalog for ${descriptor.key}`);
      if (!descriptor.readTypeLastChangedInLabCatalog) throw new Error(`${profile.qbVersion}: missing readTypeLastChangedInLabCatalog for ${descriptor.key}`);
      if (!descriptor.writeTypeLastChangedInLabCatalog) throw new Error(`${profile.qbVersion}: missing writeTypeLastChangedInLabCatalog for ${descriptor.key}`);
      if (descriptor.writable === true && !descriptor.firstWritableInLabCatalog) throw new Error(`${profile.qbVersion}: writable descriptor lacks firstWritableInLabCatalog for ${descriptor.key}`);
      if (descriptor.readType && !descriptor.firstReadTypedInLabCatalog) throw new Error(`${profile.qbVersion}: typed getter lacks firstReadTypedInLabCatalog for ${descriptor.key}`);
      if (descriptor.writeType && !descriptor.firstWriteTypedInLabCatalog) throw new Error(`${profile.qbVersion}: typed setter lacks firstWriteTypedInLabCatalog for ${descriptor.key}`);
    }
    for (const field of ['typeChanged','readTypeChanged','writeTypeChanged','writableChanged','agreementChanged','fallbackChanged','getterKindChanged','setterKindChanged','semanticGetterChanged']) {
      if (!Array.isArray(profile.preferenceChanges[field])) throw new Error(`${profile.qbVersion}: missing preferenceChanges.${field}`);
    }
    if (index > 0) {
      const previous = profiles[index - 1];
      const expectedAdded = difference(profile.preferenceKeys, previous.preferenceKeys);
      const expectedRemoved = difference(previous.preferenceKeys, profile.preferenceKeys);
      if (JSON.stringify(profile.preferenceChanges.added) !== JSON.stringify(expectedAdded)) throw new Error(`${profile.qbVersion}: invalid added preference diff`);
      if (JSON.stringify(profile.preferenceChanges.removed) !== JSON.stringify(expectedRemoved)) throw new Error(`${profile.qbVersion}: invalid removed preference diff`);
    }
  }
  return true;
}
