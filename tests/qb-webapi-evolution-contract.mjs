import assert from 'node:assert/strict';
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
const subcategoryChanges=ledger.revisions['2.9.2'].c.filter(change=>change[1].includes('use_subcategories'));
assert.ok(subcategoryChanges.some(change=>change[0]==='S'&&change[1].includes('app/preferences')),'2.9.2 Preference surface must remain source-derived');
assert.ok(subcategoryChanges.some(change=>change[0]==='C'&&change[1].includes('sync/maindata')),'2.9.2 sync/maindata lifecycle must be Endpoint Contract covered');
assert.equal(subcategoryChanges.some(change=>change[0]==='M'),false,'closed Phase D subcategories lifecycle must leave the MISSING backlog');
assert.deepEqual([...new Set(changes.filter(change=>change.classification==='CONTRACT_COVERED').map(change=>change.owner))],['simulator/protocol/endpoint-contracts.js']);
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
