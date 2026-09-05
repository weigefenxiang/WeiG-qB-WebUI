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

export function annotateCatalogEvolution(input = []) {
  const catalog = Array.isArray(input) ? input : [];
  const firstSeen = new Map();
  const lastSchemaChange = new Map();

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
    const writableChanged = [];

    for (const key of currentKeys) {
      if (!firstSeen.has(key)) firstSeen.set(key, version);
      const now = currentDescriptors.get(key);
      const before = previousDescriptors.get(key);
      if (before && schemaValue(before, 'type') !== schemaValue(now, 'type')) {
        typeChanged.push({key, from: schemaValue(before, 'type'), to: schemaValue(now, 'type')});
        lastSchemaChange.set(key, version);
      }
      if (before && schemaValue(before, 'writable') !== schemaValue(now, 'writable')) {
        writableChanged.push({key, from: schemaValue(before, 'writable'), to: schemaValue(now, 'writable')});
        lastSchemaChange.set(key, version);
      }
      if (!lastSchemaChange.has(key)) lastSchemaChange.set(key, firstSeen.get(key));
    }

    current.releaseOrdinal = index;
    current.preferenceChanges = {
      added,
      removed,
      typeChanged,
      writableChanged
    };
    current.apiActionChanges = {
      added: previous ? difference(current.apiActions, previous.apiActions) : [...setOf(current.apiActions)].sort(),
      removed: previous ? difference(previous.apiActions, current.apiActions) : []
    };

    if (Array.isArray(current.preferenceDescriptors)) {
      current.preferenceDescriptors = current.preferenceDescriptors.map((descriptor) => ({
        ...descriptor,
        firstSeenInLabCatalog: firstSeen.get(String(descriptor.key)) || version,
        schemaLastChangedInLabCatalog: lastSchemaChange.get(String(descriptor.key)) || firstSeen.get(String(descriptor.key)) || version
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
