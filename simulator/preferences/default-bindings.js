function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.round(finiteNumber(value, 0)));
}

function booleanValue(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return Boolean(value);
}

export function registerDefaultPreferenceBindings(registry) {
  if (!registry || typeof registry.register !== 'function') {
    throw new TypeError('A preference binding registry is required');
  }

  for (const key of [
    'max_active_downloads',
    'max_active_uploads',
    'max_active_torrents',
    'max_active_checking_torrents',
    'max_connec',
    'max_connec_per_torrent',
    'max_uploads',
    'max_uploads_per_torrent'
  ]) {
    registry.register(key, (value) => Math.round(finiteNumber(value, 0)));
  }

  for (const key of ['dl_limit', 'up_limit']) {
    registry.register(key, nonNegativeInteger);
  }

  for (const key of [
    'queueing_enabled',
    'scheduler_enabled',
    'dht',
    'pex',
    'lsd',
    'max_ratio_enabled',
    'max_seeding_time_enabled'
  ]) {
    registry.register(key, booleanValue);
  }

  return registry;
}
