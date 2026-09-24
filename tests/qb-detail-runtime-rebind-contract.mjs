import assert from 'node:assert/strict';
import {compileDetailRuntime,resolveDetailRuntime} from '../tools/qb-detail-runtime-rebind.mjs';

const catalog=[
  {qbVersion:'4.1.0',torrentDetailUi:{tabs:['a'],controls:{priority:{options:[1,2,7]}},old:{x:1}}},
  {qbVersion:'4.1.1',torrentDetailUi:{tabs:['a'],controls:{priority:{options:[1,2,7]}},old:{x:1}}},
  {qbVersion:'4.1.5',torrentDetailUi:{tabs:['a'],controls:{priority:{options:[1,6,7]}},old:{x:1}}},
  {qbVersion:'4.2.0',torrentDetailUi:{tabs:['a','b'],controls:{priority:{options:[0,1,6,7]}}}},
  {qbVersion:'5.0.0',torrentDetailUi:{tabs:['a','b'],controls:{priority:{options:[0,1,6,7]}},literal:null}}
];
const runtime=compileDetailRuntime(catalog);
assert.equal(runtime.schemaVersion,1);
assert.equal(runtime.sourceFacts.torrentDetailUi.mode,'merge');
assert.deepEqual(runtime.sourceFacts.torrentDetailUi.changes.map(change=>change.from),['4.1.0','4.1.5','4.2.0','5.0.0']);
assert.ok(Object.prototype.hasOwnProperty.call(runtime.sourceFacts.torrentDetailUi.changes[1],'patch'),'ordinary object deltas should use merge patches');
assert.equal(runtime.sourceFacts.torrentDetailUi.changes[2].patch.old,null,'removed object keys must be encoded as merge-patch deletion');
assert.ok(Object.prototype.hasOwnProperty.call(runtime.sourceFacts.torrentDetailUi.changes[3],'value'),'literal null data must fall back to a full value so null is not mistaken for deletion');
for(const profile of catalog)assert.deepEqual(resolveDetailRuntime(runtime,profile.qbVersion),profile.torrentDetailUi);
assert.throws(()=>compileDetailRuntime([{qbVersion:'4.2.0',torrentDetailUi:{}},{qbVersion:'4.1.0',torrentDetailUi:{}}]),/not strictly ordered/);
console.log('qB Detail runtime rebind contract passed: exact release facts compress deterministically to merge changes and round-trip without inventing or losing source state.');
