export function createPreferenceStore(initial = {}) {
  const state = { ...initial };

  return {
    get(key) {
      return state[key];
    },

    set(key, value) {
      state[key] = value;
      return value;
    },

    all() {
      return { ...state };
    },

    replace(next = {}) {
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, next);
      return { ...state };
    }
  };
}
