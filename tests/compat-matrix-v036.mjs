import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const matrix=JSON.parse(await fs.readFile(path.join(here,'fixtures/qb-compat-matrix.json'),'utf8'));
const client=await fs.readFile(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const v036=await fs.readFile(path.join(root,'webui/private/scripts/v036.js'),'utf8');
const docs=await fs.readFile(path.join(root,'docs/002.兼容与实现状态.md'),'utf8').catch(()=>Promise.resolve(''));

function assert(ok,msg){if(!ok)throw new Error(msg);}
const fixtures=matrix.fixtures||[];
const versions=new Set(fixtures.map(x=>x.qbVersion));
assert(fixtures.length>=12,'compatibility matrix must include at least 12 representative/upstream/sentinel fixtures');
for(const required of ['4.1.9.1','4.2.5','4.3.9','4.4.5','4.5.5','4.6.7','5.0.5','5.1.2','5.2.0','5.2.3','master','6.0.0-synthetic'])assert(versions.has(required),`missing representative fixture ${required}`);
for(const required of matrix.fastGate||[])assert(versions.has(required),`fast gate references unknown fixture ${required}`);
for(const required of matrix.releaseGate||[])assert(versions.has(required),`release gate references unknown fixture ${required}`);
const future=fixtures.find(x=>x.role==='forward-major-sentinel');
assert(future&&!future.realRelease&&future.claimsSupported===false,'future major must remain a synthetic non-support claim');
assert(!/major\s*>\s*5|major\s*>=\s*6|startsWith\(['\"]5\.|qbVersion[^\n]{0,40}5\./i.test(client),'qb-client must not reject future versions by hard-coded qB major');
assert(/capabilit/i.test(client),'qb-client must expose capability-based behavior');
assert(/SETTING-UNIT|Advanced|advanced/i.test(v036),'v0.3.6 interaction layer must own advanced-setting semantics');
if(docs){
  assert(/4\.1\.9\.1/.test(docs)&&/5\.2\.3/.test(docs),'compatibility docs must mention floor and current stable representatives');
  assert(/synthetic|哨兵|sentinel/i.test(docs),'compatibility docs must distinguish the future-major sentinel');
}
console.log(`Compatibility matrix contract passed for ${fixtures.length-1} real/upstream generations + 1 synthetic future-major sentinel.`);
