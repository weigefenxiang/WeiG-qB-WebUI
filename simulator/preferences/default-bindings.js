import { registerPreferenceBinding } from './bindings.js';

export function registerDefaultPreferenceBindings() {
  registerPreferenceBinding('max_active_downloads', ({ world, value }) => {
    world.preferences.max_active_downloads = Number(value);
    world.preferenceRuntimeDirty = true;
  });

  registerPreferenceBinding('max_active_uploads', ({ world, value }) => {
    world.preferences.max_active_uploads = Number(value);
    world.preferenceRuntimeDirty = true;
  });

  registerPreferenceBinding('max_active_torrents', ({ world, value }) => {
    world.preferences.max_active_torrents = Number(value);
    world.preferenceRuntimeDirty = true;
  });

  registerPreferenceBinding('dl_limit', ({ world, value }) => {
    world.globalDownloadLimit = Math.max(0, Number(value) || 0);
  });

  registerPreferenceBinding('up_limit', ({ world, value }) => {
    world.globalUploadLimit = Math.max(0, Number(value) || 0);
  });
}
