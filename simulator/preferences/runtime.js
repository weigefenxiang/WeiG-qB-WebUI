import { createPreferenceService } from './api.js';
import { createPreferenceBindingRegistry } from './bindings.js';
import { registerDefaultPreferenceBindings } from './default-bindings.js';
import { buildPreferenceSurface } from './defaults.js';
import { setPreferences } from '../core/engine.js';

function preferenceKeysForWorld(world) {
  if (Array.isArray(world?.profile?.preferenceKeys)) {
    return world.profile.preferenceKeys.map(String);
  }
  return Object.keys(world?.preferences || {});
}

export function createPreferenceRuntime(world, options = {}) {
  const keys = Array.isArray(options.allowedKeys)
    ? options.allowedKeys.map(String)
    : preferenceKeysForWorld(world);
  const registry = createPreferenceBindingRegistry();
  registerDefaultPreferenceBindings(registry);
  const initial = buildPreferenceSurface(world?.preferences || {}, keys);
  const service = createPreferenceService(initial, {
    allowedKeys: keys,
    transform(key, value) {
      return registry.transform(key, value, { world });
    }
  });

  return {
    read() {
      return service.read();
    },

    write(patch = {}, now = Date.now()) {
      const accepted = service.write(patch);
      if (Object.keys(accepted).length) {
        setPreferences(world, accepted, now);
        service.replace(buildPreferenceSurface(world.preferences, keys));
      }
      return accepted;
    },

    keys() {
      return keys.slice();
    }
  };
}
