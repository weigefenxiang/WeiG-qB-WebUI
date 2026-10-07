import { createPreferenceSchema } from "../preferences/schema.js";

export const qb43PreferenceSchema = createPreferenceSchema([
  { key: "max_active_downloads", section: "BitTorrent", type: "number", writable: true },
  { key: "max_active_uploads", section: "BitTorrent", type: "number", writable: true },
  { key: "max_active_torrents", section: "BitTorrent", type: "number", writable: true },
  { key: "dl_limit", section: "Speed", type: "number", writable: true },
  { key: "up_limit", section: "Speed", type: "number", writable: true },
  { key: "enable_embedded_tracker", section: "Advanced", type: "boolean", writable: true },
  { key: "enable_super_seeding", section: "BitTorrent", type: "boolean", writable: true }
]);
