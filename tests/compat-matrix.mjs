import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const matrix=JSON.parse(await fs.readFile(path.join(here,'fixtures/qb-compat-matrix.json'),'utf8'));
const client=await fs.readFile(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const advanced=await fs.readFile(path.join(root,'webui/private/scripts/advanced-settings.js'),'utf8');
const docs=await fs.readFile(path.join(root,'docs/002.兼容与实现状态.md'),'utf8').catch(()=>Promise.resolve(''));
function assert(ok,msg){if(!ok)throw new Error(msg);}
const fixtures=matrix.fixtures||[],versions=new Set(fixtures.map(x=>x.qbVersion));
assert(fixtures.length>=12,'compatibility matrix must retain representative/upstream/sentinel fixtures');
for(const required of ['4.1.9.1','4.2.5','4.3.9','4.4.5','4.5.5','4.6.7','5.0.5','5.1.2','5.2.0','5.2.3','master','6.0.0-synthetic'])assert(versions.has(required),`missing representative fixture ${required}`);
assert(JSON.stringify(matrix.fastGate||[])===JSON.stringify(['4.1.9.1','5.2.0']),'daily fastGate must stay pinned to 4.1.9.1 + 5.2.0');
for(const required of matrix.fastGate||[])assert(versions.has(required),`fast gate references unknown fixture ${required}`);
for(const required of matrix.releaseGate||[])assert(versions.has(required),`release gate references unknown fixture ${required}`);
assert((matrix.releaseGate||[]).length>=20,'Release gate must retain broad qB 4.x/5.x coverage');
const future=fixtures.find(x=>x.role==='forward-major-sentinel');assert(future&&!future.realRelease&&future.claimsSupported===false,'future major must remain a synthetic non-support claim');
assert(!/major\s*>\s*5|major\s*>=\s*6|startsWith\(['\"]5\.|qbVersion[^\n]{0,40}5\./i.test(client),'qb-client must not reject future versions by hard-coded major');
assert(/capabilit/i.test(client),'qb-client must expose capability-based behavior');
assert(/torrent_file_size_limit|socket_receive_buffer_size|upload_choking_algorithm/.test(advanced),'AdvancedSettings must retain verified unit/enum metadata');
if(docs){assert(/4\.1\.9\.1/.test(docs)&&/5\.2\.3/.test(docs),'compatibility docs must mention floor and current stable representatives');assert(/synthetic|哨兵|sentinel/i.test(docs),'compatibility docs must distinguish the future-major sentinel');}
console.log(`Compatibility policy passed: daily 4.1.9.1 + 5.2.0; Release retains ${matrix.releaseGate.length} nodes.`);
