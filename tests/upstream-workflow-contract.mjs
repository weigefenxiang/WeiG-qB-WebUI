import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/upstream-compat.yml'),'utf8').replace(/\r\n?/g,'\n');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const requiredPaths=[
  "'.github/workflows/upstream-compat.yml'",
  "'tools/qb-*.mjs'",
  "'tools/data/qb-webapi-evolution-ledger.json'",
  "'tests/upstream-release-audit.mjs'",
  "'webui/private/scripts/qb-client.js'",
  "'webui/private/scripts/settings-schema.js'"
];

assert(/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*paths:/m.test(workflow),'heavy upstream audit must be path-scoped on dev pushes');
for(const entry of requiredPaths)assert(workflow.includes(`- ${entry}`),`upstream audit trigger is missing ${entry}`);
assert(!workflow.includes("'docs/**'"),'docs-only changes must not trigger the heavy upstream audit');
assert(!workflow.includes('run: npm test'),'upstream evolution audit must not duplicate repository npm test');
assert(workflow.includes('workflow_dispatch:'),'heavy upstream audit must remain manually runnable');
assert(workflow.includes('qb-release-catalog.mjs upstream-qb'),'heavy upstream audit must regenerate exact stable source facts');
assert(workflow.includes('tests/upstream-release-audit.mjs upstream-qb'),'heavy upstream audit must verify all supported stable tags');
assert(workflow.includes('qb-webapi-evolution-audit.mjs upstream-qb'),'heavy upstream audit must verify WebAPI chronology/classification evidence');

console.log('Upstream workflow contract passed: full stable WebAPI evolution audit is path-scoped, manual-runnable, and docs-only pushes do not trigger it.');
