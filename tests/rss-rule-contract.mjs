import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const rss=fs.readFileSync(path.join(root,'webui/private/scripts/rss.js'),'utf8');
const compat=JSON.parse(fs.readFileSync(path.join(root,'webui/private/data/rss-compat.json'),'utf8'));
const capabilities=JSON.parse(fs.readFileSync(path.join(root,'webui/private/data/capabilities.json'),'utf8'));

assert.equal(capabilities.compatFiles.rss,'data/rss-compat.json','RSS compatibility domain must be registered in the compact control plane.');
assert.equal(compat.schemaVersion,1);
assert.equal(compat.source,'qb-upstream-rss-downloader');
assert.deepEqual({count:compat.releaseSet.count,first:compat.releaseSet.first,last:compat.releaseSet.last},{count:65,first:'4.1.0',last:'5.2.3'});
assert.match(compat.releaseSet.identitySha256,/^[0-9a-f]{64}$/);
const changes=compat.sourceFacts.rssDownloaderUi;
assert.deepEqual(changes.map(x=>x.from),['4.1.0','4.3.0','4.3.2','4.6.0','5.0.0'],'RSS runtime contract must contain only exact source-derived native RSS surface change points.');
const at=v=>changes.find(x=>x.from===v).value;
assert.equal(at('4.1.0').available,false,'qB 4.1/4.2 must not synthesize a native RSS Downloader surface.');
const q430=at('4.3.0'),q432=at('4.3.2'),q460=at('4.6.0'),q500=at('5.0.0');
assert.equal(q430.fields.find(x=>x.key==='smartFilter').path.join('.'),'rule.smartFilter','qB 4.3 native Smart Episode Filter must be source-bound.');
assert.equal(q430.fields.find(x=>x.key==='stopped').path.join('.'),'rule.addPaused');
assert.equal(q430.fields.find(x=>x.key==='subfolder').path.join('.'),'rule.createSubfolder');
assert.equal(q432.fields.some(x=>x.key==='subfolder'),false,'qB 4.3.2 must retire the old native createSubfolder field.');
assert.equal(q432.fields.find(x=>x.key==='layout').path.join('.'),'rule.torrentContentLayout');
assert.equal(q460.fields.find(x=>x.key==='tags').path.join('.'),'torrentParams.tags');
assert.equal(q460.fields.find(x=>x.key==='stopped').path.join('.'),'torrentParams.stopped');
assert.equal(q460.fields.find(x=>x.key==='layout').path.join('.'),'torrentParams.content_layout');
assert.equal(q500.fields.find(x=>x.key==='stopped').controlId,'addStoppedCombobox');
assert.equal(q500.fields.find(x=>x.key==='stopped').translation.source,'Add Stopped:');
for(const surface of [q430,q432,q460,q500])for(const field of surface.fields.filter(x=>x.kind==='triState'||x.kind==='select'))assert.ok(field.options.every(x=>Object.prototype.hasOwnProperty.call(x,'writeValue')),'select/tri-state options must carry source-proven write values.');

assert.match(rss,/R\.ensure\('rss'\)/,'RSS runtime must lazy-load its compact source domain through CapabilityRegistry.');
assert.match(rss,/release\.certified!==true/,'unknown or inherited release identities must fail closed before native RSS projection.');
assert.match(rss,/state\.manifest\.fields\|\|\[\]\)\.forEach|state\.manifest\.fields\|\|\[\]/,'RSS editor must render exact source manifest fields rather than returned-object-shape branches.');
assert.match(rss,/readPath\(rule,fieldDef\.path\)/,'RSS reads must follow the exact source-proven field path.');
assert.match(rss,/writePath\(rule,fieldDef\.path,next\)/,'RSS writes must follow the exact source-proven field path.');
assert.match(rss,/item&&ownKey\(item,'writeValue'\)\?clone\(item\.writeValue\):current/,'RSS select/tri-state writes must use source-proven option writeValue including null/default.');
assert.match(rss,/state\.draft=clone\(state\.rules\[name\]\|\|\{\}\)/,'RSS editing must preserve the complete source-returned rule object before patching source-owned fields.');
assert.doesNotMatch(rss,/function pathIn\(/,'returned-object-shape path guessing must be retired after manifest cutover.');
assert.doesNotMatch(rss,/function triState\(|function triValue\(|function layoutState\(/,'manual historical tri-state/layout owners must be retired after manifest cutover.');
assert.doesNotMatch(rss,/ownKey\(rule,'smartFilter'\).*appendControl/s,'smartFilter visibility must come from exact source manifest, not returned rule shape.');
assert.doesNotMatch(rss,/Client\.prototype\./,'RSS feature module must not regain transport ownership.');

console.log('RSS native projection contract passed: exact 65-release identity, five source change points, source-path rendering/writes, fail-closed unknown releases, and old shape owners retired.');
