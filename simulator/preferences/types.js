export const PreferenceType = Object.freeze({
  BOOLEAN: "boolean",
  NUMBER: "number",
  STRING: "string",
  ARRAY: "array",
  OBJECT: "object"
});

export const PreferenceCoverage = Object.freeze({
  MODELED: "MODELED",
  STATEFUL: "STATEFUL",
  READ_ONLY: "READ_ONLY",
  UNKNOWN: "UNKNOWN"
});

export const PreferenceProvenance = Object.freeze({
  WORLD: "WORLD",
  PROFILE: "PROFILE",
  KNOWN_DEFAULT: "KNOWN_DEFAULT",
  INHERITED: "INHERITED",
  SAFE_PLACEHOLDER: "SAFE_PLACEHOLDER"
});

export function isPreferenceType(type) {
  return Object.values(PreferenceType).includes(type);
}

export function normalizePreferenceType(type) {
  return isPreferenceType(type) ? type : PreferenceType.STRING;
}

export function normalizePreferenceCoverage(value, fallback = PreferenceCoverage.UNKNOWN) {
  return Object.values(PreferenceCoverage).includes(value) ? value : fallback;
}

export function preferenceTypeOf(value) {
  if (typeof value === "boolean") return PreferenceType.BOOLEAN;
  if (typeof value === "number" && Number.isFinite(value)) return PreferenceType.NUMBER;
  if (Array.isArray(value)) return PreferenceType.ARRAY;
  if (value && typeof value === "object") return PreferenceType.OBJECT;
  return PreferenceType.STRING;
}
