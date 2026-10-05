import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {readSettingsRuntime} from '../tools/qb-compact-runtime.mjs';
import {expandQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
const matrix=JSON.parse(await fs.readFile(path.join(here,'fixtures/qb-compat-matrix.json'),'utf8'));
const client=await fs.readFile(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const settingsSchemaSource=await fs.readFile(path.join(root,'webui/private/scripts/settings-schema.js'),'utf8');
const docs=await fs.readFile(path.join(root,'docs/COMPATIBILITY.md'),'utf8').catch(()=>Promise.resolve(''));
const releaseDocs=await fs.readFile(path.join(root,'docs/RELEASE.md'),'utf8').catch(()=>Promise.resolve(''));
function assert(ok,msg){if(!ok)throw new Error(msg);}
function parts(v){return String(v).split('.').map(x=>Number.parseInt(x,10)||0);}
function cmp(a,b){const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d);}return 0;}

const sandbox={window:{WeiG:{t:key=>key,util:{parseScalar:value=>value},I18n:{getLocale:()=> 'en'}}}};sandbox.window.window=sandbox.window;vm.runInNewContext(settingsSchemaSource,sandbox,{filename:'settings-schema.js'});const settingsSchema=sandbox.window.WeiG.SettingsSchema;assert(settingsSchema&&typeof settingsSchema.loadCompatibility==='function'&&typeof settingsSchema.sourcePreference==='function','W.SettingsSchema must be the source-native Preferences adapter');

const fixtures=matrix.fixtures||[],versions=new Set(fixtures.map(x=>x.qbVersion));
assert(fixtures.length>=14,'compatibility fixture matrix must retain broad representative/upstream/sentinel fixtures');
for(const required of ['4.1.0','4.1.9.1','4.2.5','4.3.9','4.4.5','4.5.5','4.6.1','4.6.7','5.0.5','5.1.2','5.2.0','5.2.3','master','6.0.0-synthetic'])assert(versions.has(required),`missing representative fixture ${required}`);
assert(matrix.supportedRange?.minimum==='4.1.0','fixture supported range must begin at qB 4.1.0');
const v461=fixtures.find(x=>x.qbVersion==='4.6.1');assert(v461?.webApiVersion==='2.9.3','fixture must preserve qB 4.6.1 -> WebAPI 2.9.3');

const generationFixtures=fixtures.filter(x=>x.realRelease&&/^5\.\d+\.0$/.test(String(x.qbVersion))).sort((a,b)=>cmp(a.qbVersion,b.qbVersion));assert(generationFixtures.length>=1,'fixture matrix must include at least one real qB 5.x.0 generation');const latestGeneration=generationFixtures.at(-1).qbVersion;
const fastGate=matrix.fastGate||[];assert(fastGate[0]==='4.1.0','fixture fastGate must begin at the formal supported qB floor');assert(fastGate.at(-1)===latestGeneration,`fixture fastGate must use highest checked-in qB 5.x.0 generation (${latestGeneration})`);for(const required of fastGate)assert(versions.has(required),`fast gate references unknown fixture ${required}`);for(const required of matrix.releaseGate||[])assert(versions.has(required),`release gate references unknown fixture ${required}`);assert((matrix.releaseGate||[]).length>=20,'Representative release fixture gate must retain broad qB 4.x/5.x coverage');

const future=fixtures.find(x=>x.role==='forward-major-sentinel');assert(future&&!future.realRelease&&future.claimsSupported===false,'future major must remain a synthetic non-support claim');assert(!/major\s*>\s*5|major\s*>=\s*6|startsWith\(['\"]5\.|qbVersion[^\n]{0,40}5\./i.test(client),'qb-client must not reject future versions by hard-coded major');assert(/capabilit/i.test(client),'qb-client must expose capability-based behavior');

const formalSettings=readSettingsRuntime(),expandedSettings=expandQbPreferencesCompact(formalSettings.settingsData,'5.2.3');const dlLimit=expandedSettings.preferences.dl_limit,uploadChoking=expandedSettings.preferences.upload_choking_algorithm;assert(dlLimit?.control?.unit?.source==='KiB/s'&&dlLimit?.projection?.kind==='scale'&&dlLimit?.projection?.scale===1024,'source-native Settings IR must retain source-proven rate-limit unit/scale');assert(Array.isArray(uploadChoking?.control?.options)&&uploadChoking.control.options.length>=3,'source-native Settings IR must retain upload choking enum options');
await fs.access(path.join(root,'webui/private/scripts/advanced-settings.js')).then(()=>assert(false,'retired advanced-settings.js must not return')).catch(error=>{if(error&&error.code!=='ENOENT')throw error;});

if(docs){assert(/4\.1\.0/.test(docs)&&/stable/i.test(docs),'compatibility docs must state the qB 4.1.0 stable support floor');assert(/future[^\n]*(?:stable|new-major|major)/i.test(docs),'compatibility docs must define future stable/new-major admission');assert(/4\.0\.x[\s\S]{0,300}outside the current implementation and CI support scope/i.test(docs),'compatibility docs must keep qB 4.0.x outside the current implementation/CI scope');assert(/source-derived/i.test(docs),'compatibility docs must describe source-derived release truth');const evidenceDocs=`${docs}\n${releaseDocs}`;assert(/simulator\/browser checks/i.test(evidenceDocs)&&/real-qB/i.test(evidenceDocs),'canonical compatibility/release docs must distinguish browser validation from real-qB evidence');assert(!/55[^\n]*stable[^\n]*40[^\n]*4\.x[^\n]*15[^\n]*5\.x/i.test(docs),'compatibility docs must not hard-code obsolete stable counts');}
console.log(`Compatibility policy passed: formal fixture floor qB 4.1.0 + latest checked-in 5.x.0 generation ${latestGeneration}; representative release fixture matrix has ${matrix.releaseGate.length} nodes while full stable truth is source-generated.`);
