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

console.log('Pages source drain contract passed: a docs-only follow-up cannot strand an older materialized dev payload behind unpublished Pages-relevant changes, and both ranges share one relevance owner.');
