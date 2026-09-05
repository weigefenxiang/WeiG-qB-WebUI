export const PreferenceType = Object.freeze({
  BOOLEAN: "boolean",
  NUMBER: "number",
  STRING: "string",
  ARRAY: "array",
  OBJECT: "object"
});

export function normalizePreferenceType(type) {
  return Object.values(PreferenceType).includes(type)
    ? type
    : PreferenceType.STRING;
}
