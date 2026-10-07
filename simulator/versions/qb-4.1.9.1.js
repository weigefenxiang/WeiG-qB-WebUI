import { createPreferenceSchema } from "../preferences/schema.js";

export const qb4191PreferenceSchema = createPreferenceSchema([
  { key: "max_active_downloads", section: "BitTorrent", type: "number", writable: true },
  { key: "max_active_uploads", section: "BitTorrent", type: "number", writable: true },
  { key: "max_active_torrents", section: "BitTorrent", type: "number", writable: true },
  { key: "dl_limit", section: "Speed", type: "number", writable: true },
  { key: "up_limit", section: "Speed", type: "number", writable: true },
  { key: "dht", section: "BitTorrent", type: "boolean", writable: true },
  { key: "pex", section: "BitTorrent", type: "boolean", writable: true },
  { key: "lsd", section: "BitTorrent", type: "boolean", writable: true }
]);
