import { resolvePreferenceSchema } from "./resolver.js";

export function attachPreferenceSchemas(versionCatalog = [], profiles = {}) {
  return versionCatalog.map((entry) => {
    const profile = profiles[entry.qbVersion];

    if (!profile) {
      return {
        ...entry,
        preferenceSchema: []
      };
    }

    return {
      ...entry,
      preferenceSchema: profile.preferenceSchema || []
    };
  });
}

export function getPreferenceSchema(versionCatalog = [], qbVersion) {
  return resolvePreferenceSchema(versionCatalog, qbVersion);
}
