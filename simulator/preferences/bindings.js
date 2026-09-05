export function createPreferenceBindingRegistry() {
  const bindings = new Map();

  return {
    register(key, handler) {
      if (typeof handler !== 'function') {
        throw new TypeError(`Preference binding for ${key} must be a function`);
      }
      bindings.set(String(key), handler);
      return this;
    },

    transform(key, value, context = {}) {
      const handler = bindings.get(String(key));
      return handler ? handler(value, context) : value;
    },

    has(key) {
      return bindings.has(String(key));
    },

    keys() {
      return [...bindings.keys()];
    }
  };
}
