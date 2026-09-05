import {preferenceValueMatchesType} from './descriptors.js';
import {isPreferenceType} from './types.js';

function descriptorMap(profile) {
  const descriptors = Array.isArray(profile?.preferenceDescriptors) ? profile.preferenceDescriptors : [];
  return new Map(descriptors
    .filter((item) => item && item.key != null && isPreferenceType(item.type))
    .map((item) => [String(item.key), item]));
}

export function sanitizeWorldPreferenceValues(world, profile = world?.profile) {
  if (!world || typeof world !== 'object') return {changed:false, sanitizedKeys:[]};
  const preferences = world.preferences && typeof world.preferences === 'object' ? world.preferences : null;
  if (!preferences) return {changed:false, sanitizedKeys:[]};
  const descriptors = descriptorMap(profile);
  if (!descriptors.size) return {changed:false, sanitizedKeys:[]};
  const surface = new Set(Array.isArray(profile?.preferenceKeys) ? profile.preferenceKeys.map(String) : descriptors.keys());
  const sanitizedKeys = [];

  for (const [key, descriptor] of descriptors) {
    if (!surface.has(key) || !Object.prototype.hasOwnProperty.call(preferences, key)) continue;
    if (preferenceValueMatchesType(preferences[key], descriptor.type)) continue;
    delete preferences[key];
    sanitizedKeys.push(key);
    if (key === 'dl_limit') world.globalDownloadLimit = 0;
    if (key === 'up_limit') world.globalUploadLimit = 0;
  }

  sanitizedKeys.sort();
  return {changed:sanitizedKeys.length>0, sanitizedKeys};
}
