export const LARGE_WORLD_THRESHOLD=5000;
export const DEFAULT_SNAPSHOT_INTERVAL_MS=1000;
export const LARGE_SNAPSHOT_INTERVAL_MS=2000;
export const DEFAULT_READ_PERSIST_MS=30000;
export const LARGE_READ_PERSIST_MS=60000;

export function worldTorrentCount(world){
  return Array.isArray(world?.torrents)?world.torrents.length:0;
}

export function isLargeWorld(world,threshold=LARGE_WORLD_THRESHOLD){
  return worldTorrentCount(world)>=Math.max(1,Number(threshold)||LARGE_WORLD_THRESHOLD);
}

export function snapshotIntervalForWorld(world){
  return isLargeWorld(world)?LARGE_SNAPSHOT_INTERVAL_MS:DEFAULT_SNAPSHOT_INTERVAL_MS;
}
