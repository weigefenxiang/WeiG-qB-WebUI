import { createPreferenceService } from './api.js';
import { createPreferenceBindingRegistry } from './bindings.js';
import { registerDefaultPreferenceBindings } from './default-bindings.js';
import {
  buildPreferenceDescriptors,
  materializePreferenceSurface,
  summarizePreferenceCoverage
} from './descriptors.js';
import { sanitizeWorldPreferenceValues } from './migration.js';
import { setPreferences } from '../core/engine.js';

const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

function preferenceKeysForWorld(world) {
  if (Array.isArray(world?.profile?.preferenceKeys)) {
    return world.profile.preferenceKeys.map(String);
  }
  return Object.keys(world?.preferences || {});
}

function descriptorOptions(world, options, registry) {
  return {
    modeledKeys: registry.modeledKeys ? registry.modeledKeys() : registry.keys(),
    profileDescriptors: options.profileDescriptors ?? world?.profile?.preferenceDescriptors ?? null,
    profileDefaults: options.profileDefaults ?? world?.profile?.preferenceDefaults ?? null,
    inheritedPreferences: options.inheritedPreferences ?? world?.profile?.preferenceInheritedDefaults ?? null
  };
}

function authenticationPolicy(world){
  world.authenticationPolicy=world.authenticationPolicy||{
    acceptAny:false,
    username:String(world?.preferences?.web_ui_username??'weigshare'),
    password:'weigshare'
  };
  world.authenticationPolicy.acceptAny=false;
  return world.authenticationPolicy;
}

export function createPreferenceRuntime(world, options = {}) {
  const sanitation = sanitizeWorldPreferenceValues(world, world?.profile);
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

  function bindingCoverage() {
    const entries = registry.entries ? registry.entries() : registry.keys().map((key) => ({key,modeled:true,effect:null}));
    return {
      modeled: entries.filter((entry) => entry.modeled).map((entry) => entry.key),
      normalizationOnly: entries.filter((entry) => !entry.modeled).map((entry) => entry.key),
      effects: Object.fromEntries(entries.filter((entry) => entry.effect).map((entry) => [entry.key, entry.effect]))
    };
  }

  return {
    read() {
      return service.read();
    },

    write(patch = {}, now = Date.now()) {
      const requested=patch&&typeof patch==='object'?{...patch}:{};
      const passwordRequested=hasOwn(requested,'web_ui_password');
      const nextPassword=passwordRequested?String(requested.web_ui_password??''):'';
      delete requested.web_ui_password;
      const accepted = service.write(requested);
      if (Object.keys(accepted).length) {
        setPreferences(world, accepted, now);
        if(hasOwn(accepted,'web_ui_username'))authenticationPolicy(world).username=String(accepted.web_ui_username??'');
        rebuild();
      }
      if(passwordRequested&&nextPassword.length>=6)authenticationPolicy(world).password=nextPassword;
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
      return {
        ...summarizePreferenceCoverage(descriptors),
        sanitizedWorldKeys:sanitation.sanitizedKeys.slice(),
        bindings:bindingCoverage()
      };
    }
  };
}
