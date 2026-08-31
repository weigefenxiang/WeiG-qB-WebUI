import fs from 'node:fs';
import vm from 'node:vm';

function assert(ok,msg){if(!ok)throw new Error(msg);}
const source=fs.readFileSync('webui/private/scripts/advanced-v036.js','utf8');
const sandbox={window:{WeiG:{Components:{preferenceField(){},selectControl(){}},util:{parseScalar(value){const s=String(value).trim();if(s!==''&&!Number.isNaN(Number(s)))return Number(s);return value;}}}}};
vm.runInNewContext(source,sandbox,{filename:'advanced-v036.js'});
const api=sandbox.window.WeiG.AdvancedSettingsV036;
assert(api,'AdvancedSettingsV036 contract export missing');

assert(api.toDisplay('torrent_file_size_limit',104857600)===100,'torrent file size bytes must display as 100 MiB');
assert(api.toRaw('torrent_file_size_limit',100)===104857600,'100 MiB must round-trip to exact qB byte value');
assert(api.toDisplay('socket_receive_buffer_size',65536)===64,'socket receive buffer bytes must display as KiB');
assert(api.toRaw('socket_receive_buffer_size',64)===65536,'socket receive buffer KiB must round-trip to bytes');
assert(api.toDisplay('socket_send_buffer_size',131072)===128,'socket send buffer bytes must display as KiB');
assert(api.toRaw('socket_send_buffer_size',128)===131072,'socket send buffer KiB must round-trip to bytes');
assert(api.toDisplay('disk_queue_size',1048576)===1024,'disk queue bytes must display as KiB');
assert(api.toRaw('disk_queue_size',1024)===1048576,'disk queue KiB must round-trip to bytes');
assert(api.toRaw('stop_tracker_timeout',2)===2,'same-unit settings must not be rescaled');
assert(api.titleWithUnit('Torrent File Size Limit (B)',api.meta.torrent_file_size_limit)==='Torrent File Size Limit (MiB)','raw API unit suffix must be replaced, not stacked');
assert(api.titleWithUnit('Socket Receive Buffer Size (B)',api.meta.socket_receive_buffer_size)==='Socket Receive Buffer Size (KiB)','socket raw byte suffix must be replaced by display KiB');
assert(api.meta.socket_receive_buffer_size.zero==='System default','socket zero semantic missing');
assert(api.meta.upnp_lease_duration.zero==='Permanent lease','UPnP zero semantic missing');
assert(api.meta.stop_tracker_timeout.zero==='Disabled','tracker timeout zero semantic missing');
assert(api.meta.torrent_content_remove_option.enum.some(x=>x.value==='MoveToTrash'),'torrent content removal enum missing MoveToTrash');

console.log('v0.3.6 Advanced unit/enum round-trip contract passed.');
