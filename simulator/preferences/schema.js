import { normalizePreferenceType, PreferenceType } from "./types.js";

export function createPreferenceSchema(entries = []) {
  return entries.map((entry) => ({
    key: entry.key,
    section: entry.section || "Unknown",
    type: normalizePreferenceType(entry.type),
    writable: entry.writable === true
  }));
}

export function resolvePreferenceFallback(value) {
  if (typeof value === "boolean") return { type: PreferenceType.BOOLEAN, writable: false };
  if (typeof value === "number" && Number.isFinite(value)) return { type: PreferenceType.NUMBER, writable: false };
  if (Array.isArray(value)) return { type: PreferenceType.ARRAY, writable: false };
  if (value && typeof value === "object") return { type: PreferenceType.OBJECT, writable: false };
  return { type: PreferenceType.STRING, writable: false };
}
