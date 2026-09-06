export function createPreferenceBindingRegistry() {
  const bindings = new Map();

  return {
    register(key, handler, metadata = {}) {
      if (typeof handler !== 'function') {
        throw new TypeError(`Preference binding for ${key} must be a function`);
      }
      bindings.set(String(key), {
        handler,
        modeled: metadata?.modeled === true,
        effect: metadata?.effect ? String(metadata.effect) : null
      });
      return this;
    },

    transform(key, value, context = {}) {
      const binding = bindings.get(String(key));
      return binding ? binding.handler(value, context) : value;
    },

    has(key) {
      return bindings.has(String(key));
    },

    keys() {
      return [...bindings.keys()];
    },

    modeledKeys() {
      return [...bindings.entries()].filter(([, binding]) => binding.modeled).map(([key]) => key);
    },

    metadata(key) {
      const binding = bindings.get(String(key));
      return binding ? { modeled: binding.modeled, effect: binding.effect } : null;
    },

    entries() {
      return [...bindings.entries()].map(([key, binding]) => ({ key, modeled: binding.modeled, effect: binding.effect }));
    }
  };
}
