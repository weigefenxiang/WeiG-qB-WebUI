export function createPreferenceBindingRegistry() {
  const bindings = new Map();

  return {
    register(key, handler) {
      bindings.set(key, handler);
    },

    apply(key, value, context) {
      const handler = bindings.get(key);
      if (!handler) {
        return false;
      }

      handler(value, context);
      return true;
    },

    has(key) {
      return bindings.has(key);
    }
  };
}
