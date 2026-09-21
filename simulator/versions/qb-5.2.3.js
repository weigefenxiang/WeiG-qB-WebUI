import { createPreferenceSchema } from "../preferences/schema.js";

export const qb523PreferenceSchema = createPreferenceSchema([
  { key: "max_active_downloads", section: "BitTorrent", type: "number", writable: true },
  { key: "max_active_uploads", section: "BitTorrent", type: "number", writable: true },
  { key: "max_active_torrents", section: "BitTorrent", type: "number", writable: true },
  { key: "dl_limit", section: "Speed", type: "number", writable: true },
  { key: "up_limit", section: "Speed", type: "number", writable: true },
  { key: "alternative_speed_limits", section: "Speed", type: "boolean", writable: true },
  { key: "queueing_enabled", section: "BitTorrent", type: "boolean", writable: true },
  { key: "max_ratio", section: "Seeding", type: "number", writable: true },
  { key: "max_seeding_time", section: "Seeding", type: "number", writable: true }
]);
