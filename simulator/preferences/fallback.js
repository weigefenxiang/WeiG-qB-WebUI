import { PreferenceType } from "./types.js";

export function resolveUnknownPreference(value) {
  if (typeof value === "boolean") {
    return {
      type: PreferenceType.BOOLEAN,
      writable: true,
      fallback: true
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      type: PreferenceType.NUMBER,
      writable: true,
      fallback: true
    };
  }

  if (Array.isArray(value)) {
    return {
      type: PreferenceType.ARRAY,
      writable: false,
      fallback: true
    };
  }

  if (value && typeof value === "object") {
    return {
      type: PreferenceType.OBJECT,
      writable: false,
      fallback: true
    };
  }

  return {
    type: PreferenceType.STRING,
    writable: true,
    fallback: true
  };
}
