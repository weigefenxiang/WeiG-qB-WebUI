const KNOWN_DEFAULTS = Object.freeze({
  scan_dirs: {},
  disk_cache: -1,
  disk_cache_ttl: 60,
  disk_queue_size: 1024 * 1024,
  disk_io_type: 0,
  disk_io_read_mode: 1,
  disk_io_write_mode: 1,
  enable_coalesce_read_write: false,
  enable_os_cache: true,
  checking_memory_use: 32,
  memory_working_set_limit: 512,
  file_pool_size: 100,
  async_io_threads: 10,
  hashing_threads: 1,
  bdecode_depth_limit: 100,
  bdecode_token_limit: 10000000,
  send_buffer_watermark: 512,
  send_buffer_low_watermark: 10,
  send_buffer_watermark_factor: 50,
  save_resume_data_interval: 60,
  save_statistics_interval: 15,
  refresh_interval: 1500,
  scheduler_days: 0,
  schedule_from_min: 0,
  schedule_to_min: 0,
  max_active_checking_torrents: 1,
  slow_torrent_dl_rate_threshold: 2,
  slow_torrent_ul_rate_threshold: 2,
  slow_torrent_inactive_timer: 60,
  max_inactive_seeding_time: -1,
  max_inactive_seeding_time_enabled: false,
  announce_port: 0,
  outgoing_ports_min: 0,
  outgoing_ports_max: 0,
  socket_backlog_size: 30,
  socket_receive_buffer_size: 0,
  socket_send_buffer_size: 0,
  hostname_cache_ttl: 3600,
  connection_speed: 20,
  upnp_lease_duration: 0,
  peer_turnover: 4,
  peer_turnover_cutoff: 90,
  peer_turnover_interval: 300,
  request_queue_size: 500,
  max_concurrent_http_announces: 50,
  stop_tracker_timeout: 5,
  upload_slots_behavior: 0,
  upload_choking_algorithm: 1,
  utp_tcp_mixed_mode: 0,
  auto_delete_mode: 0,
  torrent_file_size_limit: 100 * 1024 * 1024,
  file_log_max_size: 65,
  file_log_age: 1,
  file_log_age_type: 1
});

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  return value;
}

export function hasKnownPreferenceDefault(key) {
  return Object.prototype.hasOwnProperty.call(KNOWN_DEFAULTS, String(key || ''));
}

export function knownPreferenceDefault(key) {
  const name = String(key || '');
  return hasKnownPreferenceDefault(name) ? cloneValue(KNOWN_DEFAULTS[name]) : undefined;
}

// Compatibility entry point retained for callers, but unknown keys are deliberately not inferred from their names.
export function inferPreferenceDefault(key) {
  return knownPreferenceDefault(key);
}

export function buildPreferenceSurface(base = {}, keys = null) {
  const source = base && typeof base === 'object' ? base : {};
  const wanted = Array.isArray(keys) ? keys : Object.keys(source);
  const out = {};
  for (const rawKey of wanted) {
    const key = String(rawKey);
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = cloneValue(source[key]);
    else if (hasKnownPreferenceDefault(key)) out[key] = knownPreferenceDefault(key);
    else out[key] = undefined;
  }
  return out;
}
