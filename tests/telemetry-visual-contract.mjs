import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const layout=read('webui/private/css/layout.css');
const transferCss=read('webui/private/css/transfer.css');
const transfer=read('webui/private/scripts/transfer.js');

// Transfer speed text and both chart presentations share the existing canonical series colors.
assert(transfer.includes("getPropertyValue('--accent-primary')")&&transfer.includes("getPropertyValue('--accent-cyan')"),'Transfer canvas renderer must retain the canonical download/upload accent pair');
assert(transferCss.includes('.status-speed--dl{color:var(--accent-primary)}.status-speed--up{color:var(--accent-cyan)}'),'Transfer speed typography must use the exact chart series colors');
assert(transferCss.includes('.transfer-chart-legend>span[data-series="download"]{color:var(--accent-primary)}')&&transferCss.includes('.transfer-chart-legend>span[data-series="upload"]{color:var(--accent-cyan)}'),'Full transfer legend must expose the same download/upload series colors');
assert(transferCss.includes('.transfer-mini-chart__legend span:first-child{color:var(--accent-primary)}.transfer-mini-chart__legend span+span{color:var(--accent-cyan)}'),'Compact transfer legend must expose the same download/upload series colors');
assert(transferCss.includes('background:currentColor'),'Transfer legend dots must inherit their semantic series color instead of maintaining a second color map');
assert(transfer.includes("var last=null,samples=[],minuteBuckets=[],RAW_MAX=900,BUCKET_MAX=720")&&transfer.includes('function averageSamples(data,seconds)')&&transfer.includes("{value:'3',label:'3 s'}")&&transfer.includes("{value:'5',label:'5 s'}")&&transfer.includes("{value:'10',label:'10 s'}")&&transfer.includes('chartAverage=5'),'Transfer smoothing must remain display-only over the existing bounded history with Raw/3s/5s/10s and default 5s averaging');
assert(transfer.includes('windowSeconds<=900?averageSamples(visible,chartAverage):visible'),'Long transfer windows must continue using the existing minute buckets rather than expanding raw-sample CPU work');
assert(transfer.includes("setLegendTotal('download',downloaded)")&&transfer.includes("setLegendTotal('upload',uploaded)")&&transfer.includes('dl_info_data')&&transfer.includes('up_info_data'),'Full dialog legend totals must reuse canonical qB session traffic totals');
assert(transfer.includes("ctx.lineCap='round'")&&transfer.includes("ctx.lineJoin='round'")&&transfer.includes('ctx.quadraticCurveTo'),'Transfer chart smoothing must use low-cost Canvas path interpolation without another polling/history owner');

// Android Connected copy has exactly the same responsive type size as the transfer speed values.
const speedFont=transferCss.match(/\.transfer-runtime-capsule \.status-speed strong\{[^}]*font-size:([^;}]*)/)?.[1]?.trim();
const connectionFont=transferCss.match(/\.mobile-drawer-telemetry__row--transfer>#status-connection\{[^}]*font-size:([^;}]*)/)?.[1]?.trim();
assert(speedFont&&connectionFont&&speedFont===connectionFont,`Android Connected text must match transfer speed font size: speed=${speedFont} connection=${connectionFont}`);
assert(speedFont==='clamp(10px,3vw,13.5px)','Android transfer/connection typography must retain the approved readable clamp');
assert(transferCss.includes('.transfer-runtime-capsule__limits{width:30px;min-width:30px;flex:0 0 30px}'),'Rate-limit control must retain its reserved Mobile hit region');

// Connected status breathes at half the old frequency while Reduced Motion remains authoritative.
assert(layout.includes('connection-online-pulse 3.8s ease-in-out infinite'),'Connected marker must use the slower 3.8s breathing period');
assert(layout.includes('connection-online-pulse 2.6s ease-in-out infinite'),'Firewalled warning timing must remain protected baseline');
assert(layout.includes('@media(prefers-reduced-motion:reduce)')&&layout.includes('html[data-motion="reduced"]')&&layout.includes('.connection-indicator[data-connection="connected"] .connection-indicator__dot'),'System and WeiG Reduced Motion must still target the canonical Connected marker');
assert((layout.match(/connection-indicator\[data-connection="connected"\] \.connection-indicator__dot/g)||[]).length>=3,'Connected marker must have base plus both Reduced Motion protections');

console.log('Telemetry visual contract passed: bounded display-only averaging, session legend totals, matching speed/chart colors, slower Connected breathing, Android typography, and Reduced Motion protection.');
