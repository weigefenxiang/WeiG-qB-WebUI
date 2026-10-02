import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pages-source.yml'),'utf8').replace(/\r\n?/g,'\n');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

assert(workflow.includes('PAGES_DEV_SHA_URL="https://${GITHUB_REPOSITORY_OWNER}.github.io/${GITHUB_REPOSITORY#*/}/downloads/dev/GIT_SHA'),
  'Pages source relay must probe the currently published dev payload identity when a dev push itself looks Pages-irrelevant');
assert(workflow.includes("-H 'Cache-Control: no-cache'")&&workflow.includes('relay=$GITHUB_RUN_ID-$GITHUB_SHA'),
  'published dev payload probe must bypass stale CDN responses with a unique no-cache request');
assert(workflow.includes('git merge-base --is-ancestor "$PUBLISHED_SHA" "$GITHUB_SHA"'),
  'Pages source relay must require the published dev payload SHA to be an ancestor of current dev before reuse');
assert(workflow.includes('scan_pages_relevant_range "$PUBLISHED_SHA" "$GITHUB_SHA" "published dev payload" true'),
  'Pages source relay must scan the entire published-payload-to-current-dev range through the canonical relevance scanner');
assert(workflow.includes('Published dev Pages payload is stale across Pages-relevant change:'),
  'Pages source relay must dispatch when an older failed Pages build left a relevant product/materialization change unpublished');
assert(workflow.includes('Unable to read published dev Pages payload SHA; fail closed by requiring a Pages owner run.')&&workflow.includes('Published dev Pages SHA is not an ancestor of current dev; fail closed by requiring a Pages owner run.'),
  'published payload reconciliation must fail closed when live identity cannot be trusted');

const materializer=workflow.slice(workflow.indexOf('\n  admitted_copy_materialize:\n'),workflow.indexOf('\n  dispatch_pages:\n'));
assert(materializer.includes('name: qB admitted Settings copy/QM product materialization')&&materializer.includes('contents: write')&&materializer.includes('actions: write'),
  'Pages source must own one narrowly scoped admitted current-product copy/QM materializer');
assert(materializer.includes('qb-settings-translation-artifact.mjs')&&materializer.includes('--certified-only')&&materializer.includes('applyQbSettingsTranslationLkg')&&materializer.includes('qb-webui-catalog.mjs'),
  'admitted copy materializer must consume certified exact-dev source evidence and reuse canonical Settings/LKG packaging owners');
assert(materializer.includes('qb-runtime-copy-materialization-contract.mjs')&&materializer.includes('webui/private/data/qb-settings-native.txt|webui/translations/webui_*.qm')&&materializer.includes('Unexpected admitted copy materializer path:'),
  'admitted copy materializer must prove source-to-runtime copy coherence and restrict writes to registry/QM product assets');
assert(materializer.includes('git fetch --no-tags origin dev')&&materializer.includes('REMOTE_DEV_SHA')&&materializer.includes('handoff_latest_pages_source')&&materializer.includes('pages-source.yml/dispatches')&&materializer.includes('git push origin HEAD:dev'),
  'admitted copy materializer must fresh-check dev, use SAFE-REF semantics and hand stale ownership to latest dev');
assert(materializer.includes('for mode in ui native-surfaces')&&materializer.includes('validation_mode:$mode'),
  'a generated admitted copy commit must dispatch semantic UI and native-source validation on its exact new head');
assert(!materializer.includes('[candidate]')&&!materializer.includes('parts[2]+=1')&&!materializer.includes('Materialized Product VERSION'),
  'admitted copy materialization must not create candidate semantics or a second VERSION owner');
assert(workflow.includes('tests/qb-runtime-copy-materialization-contract.mjs|webui/*'),
  'copy materialization contract changes must stay inside the Pages evidence relevance boundary');
const dispatch=workflow.slice(workflow.indexOf('\n  dispatch_pages:\n'));
assert(dispatch.includes('admitted_copy_materialize')&&dispatch.includes("github.ref_name != 'dev' || needs.admitted_copy_materialize.result == 'success'"),
  'dev Pages deployment must wait for admitted product-copy materialization while main remains read-only');

console.log('Pages source drain contract passed: a docs-only follow-up cannot strand an older materialized dev payload behind unpublished Pages-relevant changes, and both ranges share one relevance owner.');
