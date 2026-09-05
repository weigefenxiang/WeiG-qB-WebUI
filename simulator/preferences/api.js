import { createPreferenceStore } from './store.js';
import { resolvePreferenceFallback } from './schema.js';

export function createPreferenceService(initial = {}, options = {}) {
  const store = createPreferenceStore(initial);
  const allowed = Array.isArray(options.allowedKeys) ? new Set(options.allowedKeys.map(String)) : null;
  const transform = typeof options.transform === 'function'
    ? options.transform
    : (_key, value) => value;

  function read() {
    return store.all();
  }

  function write(patch = {}) {
    const accepted = {};
    const input = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};

    for (const [key, value] of Object.entries(input)) {
      if (allowed && !allowed.has(key)) continue;
      const current = store.get(key);
      const descriptor = resolvePreferenceFallback(current === undefined ? value : current);
      if (descriptor.writable === false) continue;
      accepted[key] = transform(key, value, { current, store });
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
    store
  };
}
