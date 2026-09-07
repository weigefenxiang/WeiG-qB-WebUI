import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8').replace(/\r\n?/g,'\n');
const heavy=read('.github/workflows/upstream-compat.yml'),frozen=read('.github/workflows/frozen-stable-compat.yml');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const sourcePaths=[
  "'tools/qb-release-catalog.mjs'",
  "'tools/qb-release-tags.mjs'",
  "'tools/qb-source-parsers.mjs'",
  "'tools/qb-preference-semantics.mjs'",
  "'tools/qb-torrent-surface-parsers.mjs'",
  "'tools/qb-torrent-fields-parser.mjs'",
  "'tools/qb-detail-surface-parsers.mjs'",
  "'tools/qb-action-surface-parsers.mjs'",
  "'tools/qb-catalog-evolution.mjs'",
  "'tools/qb-webapi-evolution.mjs'",
  "'tools/qb-webapi-evolution-audit.mjs'",
  "'tools/data/qb-webapi-evolution-ledger.json'",
  "'tests/upstream-release-audit.mjs'"
];
assert(/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*paths:/m.test(heavy),'heavy upstream audit must be path-scoped on dev pushes');
for(const entry of sourcePaths)assert(heavy.includes(`- ${entry}`),`heavy upstream audit trigger is missing source/evolution input ${entry}`);
for(const forbidden of ["'docs/**'","'webui/private/scripts/qb-client.js'","'webui/private/scripts/settings-schema.js'","'tools/qb-stable-admission.mjs'","'tools/qb-product-capability-diff.mjs'"])assert(!heavy.includes(`- ${forbidden}`),`heavy upstream audit must not be triggered by non-source-history input ${forbidden}`);
assert(!heavy.includes('run: npm test'),'upstream evolution audit must not duplicate repository npm test');
assert(heavy.includes('workflow_dispatch:'),'heavy upstream audit must remain manually runnable');
assert(heavy.includes('qb-release-catalog.mjs upstream-qb'),'heavy upstream audit must regenerate exact stable source facts');
assert(heavy.includes('tests/upstream-release-audit.mjs upstream-qb'),'heavy upstream audit must verify all supported stable tags');
assert(heavy.includes('qb-webapi-evolution-audit.mjs upstream-qb'),'heavy upstream audit must verify WebAPI chronology/classification evidence');

assert(/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*paths:/m.test(frozen),'frozen stable compatibility must be path-scoped on dev pushes');
for(const owner of ['release-profile.js','capabilities.js','torrent-semantics.js','settings-schema.js','qb-client.js'])assert(frozen.includes(`'webui/private/scripts/${owner}'`),`frozen stable regression trigger missing product owner ${owner}`);
assert(frozen.includes("'tests/fixtures/qb-release-catalog.lkg.json'"),'frozen stable regression must be owned by committed LKG catalog');
assert(!frozen.includes('repository: qbittorrent/qBittorrent'),'frozen product regression must not checkout or re-parse upstream history');
assert(frozen.includes('qb-stable-admission.mjs verify'),'frozen product regression must verify LKG identity');
assert(frozen.includes('compat-architecture-contract.mjs'),'frozen product regression must enforce architecture guard');
assert(frozen.includes('full-stable-product-compat.mjs tests/fixtures/qb-release-catalog.lkg.json'),'frozen product regression must execute all LKG profiles through formal product owners');

console.log('Upstream workflow contract passed: source-parser changes retain a manual/path-scoped full history audit, while generic product compatibility changes use the frozen LKG matrix without re-parsing old upstream releases.');
