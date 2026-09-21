import { createPreferenceSchema } from "./schema.js";

export function resolvePreferenceSchema(versionCatalog, qbVersion) {
  const version = versionCatalog.find(
    (item) => item.qbVersion === qbVersion
  );

  if (!version || !version.preferenceSchema) {
    return createPreferenceSchema([]);
  }

  return createPreferenceSchema(version.preferenceSchema);
}
