import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const schemaSource=read('webui/private/scripts/settings-schema.js');
const sandbox={window:{WeiG:{t:key=>key,util:{parseScalar:value=>{
  if(typeof value!=='string')return value;
  const s=value.trim();if(s==='true')return true;if(s==='false')return false;
  if(s!==''&&Number.isFinite(Number(s)))return Number(s);return value;
}},I18n:{getLocale:()=> 'en'}}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(schemaSource,sandbox,{filename:'settings-schema.js'});
const S=sandbox.window.WeiG.SettingsSchema;
assert(S&&typeof S.describeValue==='function'&&typeof S.group==='function','W.SettingsSchema is not the canonical semantic owner');

const expected={
  add_stopped_enabled:['downloads','adding'],
  save_path:['downloads','paths'],
  scan_dirs:['downloads','files'],
  proxy_hostname_lookup:['connection','proxy'],
  i2p_enabled:['connection','i2p'],
  ip_filter_enabled:['connection','ipfilter'],
  slow_torrent_dl_rate_threshold:['bittorrent','queue'],
  max_inactive_seeding_time:['bittorrent','seeding'],
  add_trackers_from_url_enabled:['bittorrent','tracker'],
  peer_turnover:['bittorrent','peer'],
  use_https:['webui','server'],
  web_ui_reverse_proxy_enabled:['webui','reverseProxy'],
  web_ui_custom_http_headers:['webui','headers'],
  scheduler_days:['advanced','bandwidth'],
  disk_io_type:['advanced','disk'],
  rss_processing_enabled:['advanced','rss']
};
for(const [key,[surface,section]] of Object.entries(expected)){
  const info=S.describeValue(key,true);
  assert(info.surface===surface&&info.section===section,`${key}: ${info.surface}/${info.section} != ${surface}/${section}`);
}
for(const key of ['dl_limit','up_limit','alt_dl_limit','alt_up_limit'])assert(S.describeValue(key,0).surface==='transfer',`${key}: Transfer owner lost`);

const future={
  web_ui_http3_enabled:[true,'webui'],
  web_ui_reverse_proxy_timeout:[30,'webui'],
  proxy_quic_enabled:[true,'connection'],
  socket_future_buffer_size:[4096,'connection'],
  slow_torrent_future_policy:[1,'bittorrent'],
  announce_future_mode:['auto','bittorrent'],
  future_magic_option:['auto','advanced']
};
for(const [key,[value,surface]] of Object.entries(future)){
  const info=S.describeValue(key,value);
  assert(info.surface===surface,`${key}: future route ${info.surface} != ${surface}`);
  assert(info.editable===true,`${key}: scalar future preference should remain editable`);
}
for(const value of [[1,2],{mode:'auto',mtu:1500}]){
  const info=S.describeValue('future_structured_policy',value);
  assert(info.surface==='advanced'&&info.section==='upstream','structured future preference must remain visible in upstream fallback');
  assert(info.kind==='structured'&&info.editable===false,'structured future preference must be read-only');
}

const prefs={save_path:'/downloads',web_ui_http3_enabled:true,future_magic_option:'x',dl_limit:0};
assert(S.keysFor('downloads',prefs).includes('save_path'),'Downloads key missing');
assert(S.keysFor('webui',prefs).includes('web_ui_http3_enabled'),'Future Web UI family key missing');
assert(S.keysFor('advanced',prefs).includes('future_magic_option'),'Upstream fallback key missing');
assert(!S.keysFor('advanced',prefs).includes('dl_limit'),'Transfer-owned speed key leaked into Advanced');

const settings=read('webui/private/scripts/settings.js');
const index=read('webui/private/index.html');
assert(!/\bvar\s+(?:GROUPS|STANDARD|ENUMS)\b/.test(settings),'settings.js duplicated semantic Settings policy');
assert(settings.includes('C.selectControl'),'Settings stopped reusing canonical Select');
assert(settings.includes("className='settings-section'")&&settings.includes("className='setting-row'")&&settings.includes("className='field-input setting-input'"),'Settings stopped reusing existing visual primitives');
assert(!settings.includes('data-settings-tab=\"speed\"'),'Speed navigation policy leaked into settings presentation');
assert(!settings.includes('AdvancedSettings'),'Legacy AdvancedSettings owner leaked into settings presentation');
assert(!index.includes('data-settings-tab=\"speed\"'),'Retired Speed settings tab remains in static navigation');
assert(!index.includes('scripts/advanced-settings.js'),'Retired advanced-settings.js remains loaded by index');

console.log('Settings semantic contract passed: exact routing, future family routing, Transfer retirement, safe structured fallback, and canonical visual reuse.');
