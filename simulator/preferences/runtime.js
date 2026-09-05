import { createPreferenceService } from './api.js';
import { applyPreferenceBinding } from './bindings.js';
import { schedule } from '../core/engine.js';

export function createPreferenceRuntime(world, options = {}) {
  const service = createPreferenceService(world, options);

  return {
    read() {
      return service.read();
    },

    write(patch = {}) {
      const result = service.write(patch);
      let requiresReschedule = false;

      for (const [key, value] of Object.entries(result || {})) {
        applyPreferenceBinding(world, key, value);
        if ([
          'queueing_enabled',
          'max_active_downloads',
          'max_active_uploads',
          'max_active_torrents'
        ].includes(key)) {
          requiresReschedule = true;
        }
      }

      if (requiresReschedule) {
        schedule(world, Date.now(), 0);
      }

      return result;
    }
  };
}
