import { createPreferenceStore } from './store.js';
import { descriptorLookup } from './descriptors.js';
import { resolvePreferenceFallback } from './schema.js';
import { PreferenceType } from './types.js';

function normalizeBoolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return { ok: true, value: true };
  if (value === false || value === 0 || value === '0' || value === 'false') return { ok: true, value: false };
  return { ok: false };
}

function normalizeForDescriptor(value, descriptor) {
  if (!descriptor) return { ok: true, value };
  switch (descriptor.type) {
    case PreferenceType.BOOLEAN:
      return normalizeBoolean(value);
    case PreferenceType.NUMBER: {
      const number = Number(value);
      return Number.isFinite(number) ? { ok: true, value: number } : { ok: false };
    }
    case PreferenceType.STRING:
      return (value === null || value === undefined)
        ? { ok: false }
        : { ok: true, value: String(value) };
    case PreferenceType.ARRAY:
    case PreferenceType.OBJECT:
      return { ok: false };
    default:
      return { ok: true, value };
  }
}

export function createPreferenceService(initial = {}, options = {}) {
  const store = createPreferenceStore(initial);
  const allowed = Array.isArray(options.allowedKeys) ? new Set(options.allowedKeys.map(String)) : null;
  const transform = typeof options.transform === 'function'
    ? options.transform
    : (_key, value) => value;
  let descriptors = descriptorLookup(options.descriptors);

  function read() {
    return store.all();
  }

  function write(patch = {}) {
    const accepted = {};
    const input = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};

    for (const [key, value] of Object.entries(input)) {
      if (allowed && !allowed.has(key)) continue;
      const current = store.get(key);
      const declared = descriptors.get(key);
      const fallback = resolvePreferenceFallback(current === undefined ? value : current);
      if ((declared && declared.writable === false) || (!declared && fallback.writable === false)) continue;

      const normalized = normalizeForDescriptor(value, declared);
      if (!normalized.ok) continue;
      accepted[key] = transform(key, normalized.value, { current, store, descriptor: declared || fallback });
    }

    store.patch(accepted);
    return accepted;
  }

  return {
    read,
    write,
    replace(next = {}) {
      return store.replace(next);
    },
    setDescriptors(next = []) {
      descriptors = descriptorLookup(next);
      return descriptors.size;
    },
    store
  };
}
