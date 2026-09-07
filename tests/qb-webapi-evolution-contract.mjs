import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractWebApiChangelogPulls,expandChanges,readLedger,summarizeLedger,validateLedger,validateModernChangelogCoverage} from '../tools/qb-webapi-evolution.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),ledger=readLedger(path.join(root,'tools/data/qb-webapi-evolution-ledger.json'));
assert.equal(validateLedger(ledger),true);
const summary=summarizeLedger(ledger),changes=expandChanges(ledger);
assert.equal(summary.floor,'2.0.0');assert.equal(summary.ceiling,'2.15.1');assert.equal(summary.unclassified,0);
assert.ok(summary.evidenceEntries>=60);assert.ok(summary.changes>=100);
for(const classification of ['SOURCE_DERIVED','CONTRACT_COVERED','MISSING','NOT_APPLICABLE'])assert.ok(summary.classifications[classification]>0);
for(const version of ['2.7.0','2.8.4','2.8.5','2.8.18','2.8.19','2.9.2','2.9.3','2.11.2','2.11.3','2.11.4','2.11.5','2.15.1'])assert.ok(ledger.spine.includes(version),`missing historical revision ${version}`);
assert.equal(ledger.revisions['2.7.0'].q,'4.3.3');

const categoryShapeChanges=ledger.revisions['2.1.0'].c.filter(change=>change[1].includes('sync/maindata categories'));
assert.ok(categoryShapeChanges.some(change=>change[0]==='C'&&change[1].includes('array to object')),'2.1.0 sync/maindata category shape must be Endpoint Contract covered');
assert.equal(categoryShapeChanges.some(change=>change[0]==='M'),false,'closed 2.1.0 category shape lifecycle must leave the MISSING backlog');
const freeSpaceChanges=ledger.revisions['2.1.1'].c.filter(change=>change[1].includes('free_space_on_disk'));
assert.ok(freeSpaceChanges.some(change=>change[0]==='C'),'2.1.1 free_space_on_disk introduction must be Endpoint Contract covered');
assert.equal(freeSpaceChanges.some(change=>change[0]==='M'),false,'closed 2.1.1 free-space lifecycle must leave the MISSING backlog');

const subcategoryChanges=ledger.revisions['2.9.2'].c.filter(change=>change[1].includes('use_subcategories'));
assert.ok(subcategoryChanges.some(change=>change[0]==='S'&&change[1].includes('app/preferences')),'2.9.2 Preference surface must remain source-derived');
assert.ok(subcategoryChanges.some(change=>change[0]==='C'&&change[1].includes('sync/maindata')),'2.9.2 sync/maindata lifecycle must be Endpoint Contract covered');
assert.equal(subcategoryChanges.some(change=>change[0]==='M'),false,'closed Phase D subcategories lifecycle must leave the MISSING backlog');

const parseMetadataChanges=ledger.modern.find(entry=>entry[0]==='2.13.0'&&entry[1]===23085)?.[2]||[];
assert.ok(parseMetadataChanges.some(change=>change[0]==='C'&&change[1].includes('object to ordered array')),'2.13.0 parseMetadata response shape must be Endpoint Contract covered');
assert.equal(parseMetadataChanges.some(change=>change[0]==='M'),false,'closed parseMetadata response-shape boundary must leave the MISSING backlog');

const pr23202Changes=ledger.modern.find(entry=>entry[0]==='2.14.0'&&entry[1]===23202)?.[2]||[];
assert.equal(pr23202Changes.length,3,'PR #23202 must stay split into its three independently audited protocol changes');
assert.ok(pr23202Changes.every(change=>change[0]==='C'),'all PR #23202 protocol changes must be Endpoint Contract covered');
assert.ok(pr23202Changes.some(change=>change[1].includes('unknown endpoint')&&change[1].includes('Endpoint does not exist')),'2.14.0 missing-endpoint error body must be covered');
assert.ok(pr23202Changes.some(change=>change[1].includes('auth/login success becomes 204')&&change[1].includes('401 Unauthorized')),'2.14.0 login success/failure status transition must be covered');
assert.ok(pr23202Changes.some(change=>change[1].includes('torrents/add structured result')),'2.14.0 torrents/add result/status semantics must remain covered');

const basicAuth=changes.find(change=>change.pullRequest===23564&&change.subject.includes('Basic-auth'));
assert.equal(basicAuth?.classification,'CONTRACT_COVERED');assert.equal(basicAuth?.owner,'simulator/protocol/transport-contract.js');
const peerHost=changes.find(change=>change.pullRequest===23708&&change.subject.includes('host_name'));
assert.equal(peerHost?.classification,'CONTRACT_COVERED');assert.equal(peerHost?.owner,'simulator/protocol/endpoint-contracts.js');
const xForwarded=changes.find(change=>change.qbVersion==='5.2.2'&&change.subject.includes('X-Forwarded-Host'));
assert.equal(xForwarded?.classification,'CONTRACT_COVERED');assert.equal(xForwarded?.owner,'simulator/protocol/transport-contract.js');
const resultLifetime=changes.find(change=>change.qbVersion==='5.2.1'&&change.subject.includes('APIController result-buffer'));
assert.equal(resultLifetime?.classification,'NOT_APPLICABLE','qB C++ APIResult retention is an internal lifetime concern, not an observable Virtual qB response contract');
const router=fs.readFileSync(path.join(root,'simulator/protocol/router.js'),'utf8');
const auxiliary=fs.readFileSync(path.join(root,'simulator/protocol/auxiliary-router.js'),'utf8');
assert.doesNotMatch(`${router}\n${auxiliary}`,/\bm_result\b|\bAPIResult\b/,'per-request JavaScript routers must not grow a persistent C++-style APIResult buffer');

assert.deepEqual([...new Set(changes.filter(change=>change.classification==='CONTRACT_COVERED').map(change=>change.owner))].sort(),['simulator/protocol/endpoint-contracts.js','simulator/protocol/transport-contract.js']);
const fixture=`# WebAPI Changelog
## 2.15.1
* [#3](https://github.com/x/y/pull/3)
## 2.15.0
* [#2](https://github.com/x/y/pull/2)
## 2.11.6
* [#1](https://github.com/x/y/pull/1)
## 2.11.5
* [#999](https://github.com/x/y/pull/999)
`;
assert.deepEqual(extractWebApiChangelogPulls(fixture),[{version:'2.15.1',pullRequest:3},{version:'2.15.0',pullRequest:2},{version:'2.11.6',pullRequest:1}]);
const synthetic={schemaVersion:1,scope:{floorQb:'fixture',floorApi:'2.11.6',ceiling:'2.15.1'},codes:ledger.codes,spine:['2.11.6','2.15.0','2.15.1'],revisions:{
  '2.11.6':{t:'webapi_changelog',prs:[],c:[['N','fixture heading']]},
  '2.15.0':{t:'webapi_changelog',prs:[],c:[['N','fixture heading']]},
  '2.15.1':{t:'webapi_changelog',prs:[],c:[['N','fixture heading']]}
},modern:[['2.11.6',1,[['M','fixture']]],['2.15.0',2,[['M','fixture']]],['2.15.1',3,[['M','fixture']]]],supplements:[]};
assert.deepEqual(validateModernChangelogCoverage(synthetic,fixture),{pullRequests:3,minVersion:'2.11.6',maxVersion:'2.15.1'});
console.log(`qB WebAPI evolution contract passed: ${summary.evidenceEntries} evidence entries / ${summary.changes} classified changes, zero UNCLASSIFIED and fail-closed changelog coverage through ${summary.ceiling}.`);
