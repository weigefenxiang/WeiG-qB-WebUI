function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundedNumber(value) {
  return Math.round(finiteNumber(value, 0));
}

function nonNegativeInteger(value) {
  return Math.max(0, roundedNumber(value));
}

function nonNegativeNumber(value) {
  return Math.max(0, finiteNumber(value, 0));
}

function booleanValue(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return Boolean(value);
}

function stringValue(value) {
  return value == null ? '' : String(value);
}

function registerMany(registry, keys, handler, metadata = {}) {
  for (const key of keys) registry.register(key, handler, metadata);
}

export function registerDefaultPreferenceBindings(registry) {
  if (!registry || typeof registry.register !== 'function') {
    throw new TypeError('A preference binding registry is required');
  }

  registerMany(registry,[
    'max_active_downloads',
    'max_active_uploads',
    'max_active_torrents',
    'max_connec',
    'max_connec_per_torrent',
    'max_uploads',
    'max_uploads_per_torrent'
  ],roundedNumber,{modeled:true,effect:'scheduler-capacity'});

  // These values are normalized but do not yet own a simulator behavior side effect.
  registry.register('max_active_checking_torrents',roundedNumber,{modeled:false});

  registerMany(registry,['dl_limit','up_limit'],nonNegativeInteger,{modeled:true,effect:'global-rate-limit'});
  registerMany(registry,['alt_dl_limit','alt_up_limit'],nonNegativeInteger,{modeled:true,effect:'alternate-rate-budget'});

  registry.register('queueing_enabled',booleanValue,{modeled:true,effect:'scheduler-capacity'});
  registry.register('dht',booleanValue,{modeled:true,effect:'transfer-dht-state'});
  registry.register('max_ratio',nonNegativeNumber,{modeled:true,effect:'share-ratio-policy'});
  registry.register('max_ratio_enabled',booleanValue,{modeled:true,effect:'share-ratio-policy'});
  registry.register('max_seeding_time',nonNegativeNumber,{modeled:true,effect:'seeding-time-policy'});
  registry.register('max_seeding_time_enabled',booleanValue,{modeled:true,effect:'seeding-time-policy'});
  registry.register('save_path',stringValue,{modeled:true,effect:'managed-save-path'});
  registry.register('start_paused_enabled',booleanValue,{modeled:true,effect:'new-torrent-start-state'});
  registry.register('add_stopped_enabled',(value,context={})=>{
    const next=booleanValue(value);
    if(context.world?.preferences)context.world.preferences.start_paused_enabled=next;
    return next;
  },{modeled:true,effect:'new-torrent-start-state'});

  // qB exposes these state values, but the simulator does not yet claim their real side effects.
  registerMany(registry,['scheduler_enabled','pex','lsd'],booleanValue,{modeled:false});

  return registry;
}
