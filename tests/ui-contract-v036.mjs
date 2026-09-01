import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const components = read('webui/private/scripts/components.js');
const runtime = read('webui/private/scripts/v036.js');
const logs = read('webui/private/scripts/logs-v032.js');
const logsCss = read('webui/private/css/logs-v032.css');
const uiCss = read('webui/private/css/v036.css');
const brandCss = read('webui/private/css/brand-v031.css');
const spatial = read('webui/private/scripts/spatial-v022.js');
const i18n = read('webui/private/scripts/i18n-v036.js');
const version = read('VERSION').trim();
const webVersion = read('webui/VERSION').trim();

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(version === '0.3.6' && webVersion === '0.3.6', 'v0.3.6 VERSION contract missing');
for (const token of ['selectControl','upgradeNativeSelect','upgradeNativeSelects','closeSelects','filterChip','checkControl','W.Time','supportedValuesOf','weigg:timezonechange']) {
  assert(components.includes(token), `Canonical component/time token missing: ${token}`);
}
for (const token of ['AmbientMark','8000','28000','prefers-reduced-motion','torrentListContext.v036','detail-context-back','weigg:timeformatrefresh','status-timezone','weigg-floating-layer']) {
  assert(runtime.includes(token), `v0.3.6 runtime token missing: ${token}`);
}
for (const token of ['.ui-select__trigger','.ui-select__menu','.ui-select__option','.ui-chip','.ui-check','.ambient-mark__orbit','.ambient-mark__spark','.detail-context-back']) {
  assert(uiCss.includes(token), `Canonical UI CSS token missing: ${token}`);
}
assert(brandCss.includes('overflow:visible!important'), 'Brand mark must allow ambient orbit outside the icon');
assert(spatial.includes("W.buildAssetUrl?W.buildAssetUrl('css/brand-v031.css')"), 'Brand stylesheet must use deployment Git SHA asset helper');
assert(!spatial.includes('?v=0.3.1-brand1'), 'Legacy semver brand cache key must be removed');
assert(logs.includes('return bi-ai'), 'Logs must sort newest ID first');
assert(logs.includes('state.items.slice(0,MAX_ITEMS)'), 'Newest-first Logs must retain the newest bounded rows');
assert(logs.includes('W.Time') && logs.includes('TIME-002'), 'Logs must consume the global display-timezone contract');
assert(!logs.includes('logs-time-zone'), 'Logs must not create a second route-local timezone control');
assert(!logs.includes('function zh()') && !logs.includes('function text(en,cn)'), 'Logs must not branch directly on locale');
assert(!logsCss.includes('.log-filter-chip{') && !logsCss.includes('.logs-follow-control{'), 'Logs CSS must not reimplement Chip/Follow primitives');
assert(i18n.includes("'v036.logs.showing'") && i18n.includes("'v036.settings.timeZone'") && i18n.includes("'v036.storage.free'"), 'v0.3.6 i18n overlay incomplete');

console.log('v0.3.6 canonical controls, AmbientMark, global timezone, newest-first Logs and context navigation contract passed.');
