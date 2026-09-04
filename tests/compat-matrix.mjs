import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const matrix=JSON.parse(await fs.readFile(path.join(here,'fixtures/qb-compat-matrix.json'),'utf8'));
const client=await fs.readFile(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const settingsSchemaSource=await fs.readFile(path.join(root,'webui/private/scripts/settings-schema.js'),'utf8');
const docs=await fs.readFile(path.join(root,'docs/002.兼容与实现状态.md'),'utf8').catch(()=>Promise.resolve(''));

function assert(ok,msg){if(!ok)throw new Error(msg);}
function parts(v){return String(v).split('.').map(x=>Number.parseInt(x,10)||0);}
function cmp(a,b){const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d);}return 0;}

const sandbox={window:{WeiG:{t:key=>key,util:{parseScalar:value=>value},I18n:{getLocale:()=> 'en'}}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(settingsSchemaSource,sandbox,{filename:'settings-schema.js'});
const settingsSchema=sandbox.window.WeiG.SettingsSchema;
assert(settingsSchema&&settingsSchema.meta,'W.SettingsSchema must own preference metadata');

const fixtures=matrix.fixtures||[],versions=new Set(fixtures.map(x=>x.qbVersion));
assert(fixtures.length>=12,'compatibility matrix must retain representative/upstream/sentinel fixtures');
for(const required of ['4.1.9.1','4.2.5','4.3.9','4.4.5','4.5.5','4.6.7','5.0.5','5.1.2','5.2.0','5.2.3','master','6.0.0-synthetic'])assert(versions.has(required),`missing representative fixture ${required}`);

const generationFixtures=fixtures
  .filter(x=>x.realRelease&&/^5\.\d+\.0$/.test(String(x.qbVersion)))
  .sort((a,b)=>cmp(a.qbVersion,b.qbVersion));
assert(generationFixtures.length>=1,'fixture matrix must include at least one real qB 5.x.0 generation');
const latestGeneration=generationFixtures.at(-1).qbVersion;
const fastGate=matrix.fastGate||[];
assert(fastGate[0]==='4.1.9.1','fixture fastGate must begin at the supported qB floor');
assert(fastGate.at(-1)===latestGeneration,`fixture fastGate must use the highest checked-in qB 5.x.0 generation (${latestGeneration})`);
for(const required of fastGate)assert(versions.has(required),`fast gate references unknown fixture ${required}`);
for(const required of matrix.releaseGate||[])assert(versions.has(required),`release gate references unknown fixture ${required}`);
assert((matrix.releaseGate||[]).length>=20,'Representative release fixture gate must retain broad qB 4.x/5.x coverage');

const future=fixtures.find(x=>x.role==='forward-major-sentinel');
assert(future&&!future.realRelease&&future.claimsSupported===false,'future major must remain a synthetic non-support claim');
assert(!/major\s*>\s*5|major\s*>=\s*6|startsWith\(['\"]5\.|qbVersion[^\n]{0,40}5\./i.test(client),'qb-client must not reject future versions by hard-coded major');
assert(/capabilit/i.test(client),'qb-client must expose capability-based behavior');

const meta=settingsSchema.meta;
assert(meta.torrent_file_size_limit?.unit==='MiB','SettingsSchema must retain torrent file size metadata');
assert(meta.socket_receive_buffer_size?.unit==='KiB'&&meta.socket_receive_buffer_size?.scale===1024,'SettingsSchema must retain socket buffer metadata');
assert(Array.isArray(meta.upload_choking_algorithm?.enum)&&meta.upload_choking_algorithm.enum.length>=3,'SettingsSchema must retain upload choking enum metadata');
await fs.access(path.join(root,'webui/private/scripts/advanced-settings.js'))
  .then(()=>assert(false,'retired advanced-settings.js must not return'))
  .catch(error=>{if(error&&error.code!=='ENOENT')throw error;});

if(docs){
  assert(/4\.1\.9\.1/.test(docs)&&/5\.2\.3/.test(docs),'compatibility docs must mention floor and current stable representatives');
  assert(/synthetic|哨兵|sentinel/i.test(docs),'compatibility docs must distinguish the future-major sentinel');
  assert(/55[^\n]*(?:stable|稳定)[^\n]*40[^\n]*4\.x[^\n]*15[^\n]*5\.x/i.test(docs),'compatibility docs must state the current 55-release supported stable range split');
  assert(/Linux Hosted Chrome browser/.test(docs)&&/Windows Hosted Chrome browser/.test(docs)&&/Full upstream stable-tag audit/.test(docs),'compatibility docs must distinguish representative browser coverage from the full stable-tag audit');
}
console.log(`Compatibility policy passed: fixture floor 4.1.9.1 + latest checked-in 5.x.0 generation ${latestGeneration}; release fixture matrix retains ${matrix.releaseGate.length} nodes; live upstream generation selection is owned by upstream-release-audit.mjs.`);
