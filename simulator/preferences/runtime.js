import { createPreferenceService } from './api.js';
import { createPreferenceBindingRegistry } from './bindings.js';
import { registerDefaultPreferenceBindings } from './default-bindings.js';
import {
  buildPreferenceDescriptors,
  materializePreferenceSurface,
  summarizePreferenceCoverage
} from './descriptors.js';
import { setPreferences } from '../core/engine.js';

function preferenceKeysForWorld(world) {
  if (Array.isArray(world?.profile?.preferenceKeys)) {
    return world.profile.preferenceKeys.map(String);
  }
  return Object.keys(world?.preferences || {});
}

function descriptorOptions(world, options, registry) {
  return {
    modeledKeys: registry.keys(),
    profileDescriptors: options.profileDescriptors ?? world?.profile?.preferenceDescriptors ?? null,
    profileDefaults: options.profileDefaults ?? world?.profile?.preferenceDefaults ?? null,
    inheritedPreferences: options.inheritedPreferences ?? world?.profile?.preferenceInheritedDefaults ?? null
  };
}

export function createPreferenceRuntime(world, options = {}) {
  const keys = Array.isArray(options.allowedKeys)
    ? options.allowedKeys.map(String)
    : preferenceKeysForWorld(world);
  const registry = createPreferenceBindingRegistry();
  registerDefaultPreferenceBindings(registry);
  const descriptorConfig = descriptorOptions(world, options, registry);
  let descriptors = buildPreferenceDescriptors(world?.preferences || {}, keys, descriptorConfig);
  const service = createPreferenceService(materializePreferenceSurface(descriptors), {
    allowedKeys: keys,
    descriptors,
    transform(key, value) {
      return registry.transform(key, value, { world });
    }
  });

  function rebuild() {
    descriptors = buildPreferenceDescriptors(world?.preferences || {}, keys, descriptorConfig);
    service.replace(materializePreferenceSurface(descriptors));
    service.setDescriptors(descriptors);
  }

  return {
    read() {
      return service.read();
    },

    write(patch = {}, now = Date.now()) {
      const accepted = service.write(patch);
      if (Object.keys(accepted).length) {
        setPreferences(world, accepted, now);
        rebuild();
      }
      return accepted;
    },

    keys() {
      return keys.slice();
    },

    descriptors() {
      return descriptors.map((descriptor) => ({
        ...descriptor,
        value: Array.isArray(descriptor.value)
          ? descriptor.value.slice()
          : (descriptor.value && typeof descriptor.value === 'object' ? { ...descriptor.value } : descriptor.value)
      }));
    },

    coverage() {
      return summarizePreferenceCoverage(descriptors);
    }
  };
}
