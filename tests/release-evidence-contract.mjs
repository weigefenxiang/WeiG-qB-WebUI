import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const promote=read('.github/workflows/promote.yml');
const release=read('.github/workflows/release.yml');
const focused=read('.github/workflows/candidate-deployment-only.yml');
const full=read('.github/workflows/real-qb-full.yml');
const locale=read('.github/workflows/real-qb-locale.yml');
const verifier=read('tests/release-compat-evidence.mjs');

assert(focused.includes('workflow_dispatch:')&&focused.includes('release-candidate-$CANDIDATE_SHA')&&focused.includes('candidate-deployment-${{ steps.resolve.outputs.candidate_sha }}'),'candidate deployment must be independently retryable against one exact candidate artifact');
assert(focused.includes('WEIG_CANDIDATE_EXPECTED_SHA')&&focused.includes('run_rehearsal=1')&&focused.includes('run_rehearsal=0'),'focused deployment must distinguish final exact-head rehearsal from validation-only ancestor debugging');

assert(promote.includes('release-candidate-${sha}')&&promote.includes("workflow_id: 'candidate-deployment-only.yml'")&&promote.includes('candidate-deployment-${sha}'),'promotion must resolve candidate package and isolated deployment evidence as independent SHA-bound owners');
assert(promote.includes("core.setOutput('deployment_run_id'")&&promote.includes('run-id: ${{ steps.verify.outputs.deployment_run_id }}'),'promotion must download deployment evidence from its own successful workflow run');
assert(promote.includes('real-qb-full-aggregate-${compatSha}')&&promote.includes('real-qb-current-locale-aggregate-${compatSha}'),'promotion must bind Full Frozen and Locale aggregates to one guarded compatibility evidence SHA');
assert(promote.includes('node tests/release-compat-evidence.mjs')&&promote.includes('node tests/release-candidate-evidence.mjs'),'promotion must centrally revalidate both compatibility and deployment/rehearsal evidence before main moves');
assert(promote.includes('release-certification-${{ steps.verify.outputs.sha }}')&&promote.includes("kind:'weig-release-certification'")&&promote.includes('packageSha256')&&promote.includes('evidenceSha256'),'promotion must freeze all validated run/artifact identities and digests into one immutable release certification');
assert(promote.indexOf('Upload immutable release certification')<promote.indexOf('Fast-forward main to exact validated dev SHA'),'certification must be created from validated dev evidence before the authenticated fast-forward');
assert(promote.includes('git merge-base --is-ancestor origin/main "$CANDIDATE_SHA"')&&promote.includes('git push origin "$CANDIDATE_SHA:refs/heads/main"'),'promotion must remain fast-forward-only');

assert(release.includes("workflow_id:'promote.yml'")&&release.includes('release-certification-${sha}'),'Release must require a successful promotion certification for the exact tag SHA');
assert(release.includes('Download immutable promotion certification')&&release.includes("kind!=='weig-release-certification'"),'Release must download and validate the immutable certification');
assert(release.includes('candidate_run_id')&&release.includes('CERTIFIED_PACKAGE_SHA256'),'Release must use certification to locate the exact candidate artifact and pin its package digest');
assert(!release.includes("workflow_id: 'real-qb-full.yml'")&&!release.includes("workflow_id: 'real-qb-locale.yml'")&&!release.includes('node tests/release-compat-evidence.mjs'),'Release must not repeat Full Frozen/Locale discovery or compatibility verification already certified by Promotion');
assert(!release.includes('Download exact candidate deployment evidence')&&!release.includes('node tests/release-candidate-evidence.mjs'),'Release must not redownload/revalidate deployment evidence already certified by Promotion');
assert(release.includes('test "$GITHUB_REF_NAME" = "v$VERSION"')&&release.includes('--verify-tag')&&release.includes('--latest'),'Release must still bind tag, VERSION and published assets exactly');

assert(full.includes('workflow_dispatch:')&&!/\n\s*push:\s*/.test(full),'Full Frozen Matrix must remain intentional manual release-grade evidence');
assert(locale.includes('workflow_dispatch:')&&!/\n\s*push:\s*/.test(locale),'Locale Matrix must remain intentional manual release-grade evidence');
assert(verifier.includes('gfm.expected_stable_count!==65||gfm.executed_runtime_count!==65')&&verifier.includes('gfm.PASS!==65||gfm.FAIL!==0||gfm.BLOCKED!==0'),'Promotion compatibility verifier must remain strict 65/65');
assert(verifier.includes("locale.module!=='real-qb-current-locale-aggregate'||locale.status!=='PASS'"),'Promotion compatibility verifier must remain strict for Locale aggregate evidence');

console.log('Release evidence contract passed: expensive compatibility/deployment evidence is verified once by Promotion, frozen into an immutable SHA-bound certification, and Release only verifies certification + candidate bytes + tag/main identity.');
