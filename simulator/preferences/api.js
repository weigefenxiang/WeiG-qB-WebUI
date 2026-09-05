import { createPreferenceStore } from './store.js';
import { resolvePreferenceFallback } from './schema.js';

export function createPreferenceService(initial = {}) {
  const store = createPreferenceStore(initial);

  function read() {
    return store.all();
  }

  function write(patch = {}) {
    const accepted = {};

    for (const [key, value] of Object.entries(patch)) {
      const current = store.get(key);
      const schema = resolvePreferenceFallback(
        current === undefined ? value : current
      );

      if (schema.writable) {
        accepted[key] = value;
      }
    }

    store.set(accepted);
    return accepted;
  }

  return {
    read,
    write,
    store
  };
}
