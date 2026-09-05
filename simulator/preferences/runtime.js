import { createPreferenceService } from './api.js';
import { applyPreferenceBinding } from './bindings.js';

export function createPreferenceRuntime(world, options = {}) {
  const service = createPreferenceService(world, options);

  return {
    read() {
      return service.read();
    },

    write(patch = {}) {
      const result = service.write(patch);

      for (const [key, value] of Object.entries(result || {})) {
        applyPreferenceBinding(world, key, value);
      }

      return result;
    }
  };
}
