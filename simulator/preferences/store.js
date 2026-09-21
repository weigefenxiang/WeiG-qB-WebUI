export function createPreferenceStore(initial = {}) {
  const state = { ...initial };

  return {
    get(key) {
      return state[key];
    },

    has(key) {
      return Object.prototype.hasOwnProperty.call(state, key);
    },

    set(key, value) {
      state[key] = value;
      return value;
    },

    patch(values = {}) {
      Object.assign(state, values && typeof values === 'object' ? values : {});
      return { ...state };
    },

    all() {
      return { ...state };
    },

    keys() {
      return Object.keys(state);
    },

    replace(next = {}) {
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, next && typeof next === 'object' ? next : {});
      return { ...state };
    }
  };
}
