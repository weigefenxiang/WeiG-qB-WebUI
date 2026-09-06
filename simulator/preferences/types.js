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
  PROFILE_SOURCE_DEFAULT: "PROFILE_SOURCE_DEFAULT",
  CURATED_DEFAULT: "KNOWN_DEFAULT",
  INHERITED: "INHERITED",
  UPSTREAM_FALLBACK: "UPSTREAM_FALLBACK",
  UNKNOWN: "UNKNOWN",
  // Compatibility aliases keep old callers readable without weakening the precise runtime categories.
  PROFILE: "PROFILE_SOURCE_DEFAULT",
  UPSTREAM_DEFAULT: "PROFILE_SOURCE_DEFAULT",
  KNOWN_DEFAULT: "KNOWN_DEFAULT",
  SAFE_PLACEHOLDER: "UNKNOWN"
});

export const PreferenceTypeAgreement = Object.freeze({
  EXACT: "EXACT",
  MISMATCH: "MISMATCH",
  READ_ONLY: "READ_ONLY",
  WRITE_UNRESOLVED: "WRITE_UNRESOLVED",
  READ_UNRESOLVED: "READ_UNRESOLVED",
  WRITE_ONLY: "WRITE_ONLY",
  UNRESOLVED: "UNRESOLVED"
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

export function normalizePreferenceTypeAgreement(value, fallback = PreferenceTypeAgreement.UNRESOLVED) {
  return Object.values(PreferenceTypeAgreement).includes(value) ? value : fallback;
}

export function preferenceTypeOf(value) {
  if (typeof value === "boolean") return PreferenceType.BOOLEAN;
  if (typeof value === "number" && Number.isFinite(value)) return PreferenceType.NUMBER;
  if (Array.isArray(value)) return PreferenceType.ARRAY;
  if (value && typeof value === "object") return PreferenceType.OBJECT;
  return PreferenceType.STRING;
}
