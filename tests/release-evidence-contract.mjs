import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const promote=read('.github/workflows/promote.yml');
const release=read('.github/workflows/release.yml');
const full=read('.github/workflows/real-qb-full.yml');
const localeWorkflow=read('.github/workflows/real-qb-locale.yml');
const candidateVerifier=read('tests/release-candidate-evidence.mjs');
const compatVerifier=read('tests/release-compat-evidence.mjs');
const pkg=JSON.parse(read('package.json'));

for(const [name,source] of [['promotion',promote],['release',release]]){
  assert(source.includes('release-candidate-${sha}'),`${name} must resolve the exact candidate artifact`);
  assert(source.includes('candidate-deployment-${sha}'),`${name} must resolve same-run candidate deployment evidence`);
  assert(source.includes('if (candidate && evidence)')&&source.includes('candidateArtifact = candidate')&&source.includes('evidenceArtifact = evidence')&&source.includes('!candidateArtifact || !evidenceArtifact'),`${name} must require candidate + evidence from the same successful CI run`);
  assert(source.includes("workflow_id: 'real-qb-full.yml'")&&source.includes('real-qb-full-aggregate-${sha}'),`${name} must resolve exact-SHA Full Frozen Matrix evidence`);
  assert(source.includes("workflow_id: 'real-qb-locale.yml'")&&source.includes('real-qb-current-locale-aggregate-${sha}'),`${name} must resolve exact-SHA current-stable Locale evidence`);
  assert(source.includes("run.event === 'workflow_dispatch'"),`${name} must accept release-grade compatibility evidence only from manual matrix runs`);
  assert(source.includes('path: gfm')&&source.includes('path: locale'),`${name} must download both G-FM and Locale aggregate evidence`);
  assert(source.includes('node tests/release-compat-evidence.mjs'),`${name} must execute the central release compatibility evidence verifier`);
  assert(source.includes('node tests/release-candidate-evidence.mjs'),`${name} must execute the repository-owned candidate evidence verifier`);
}
assert(promote.includes('--mode=promotion')&&promote.includes('--main-before="$MAIN_BEFORE"'),'promotion must bind rehearsal evidence to the current pre-promotion main SHA');
assert(promote.includes("core.setOutput('main_sha', mainSha)"),'promotion resolver must export the exact current main SHA used for rehearsal freshness');
assert(release.includes('--mode=release')&&release.includes('--tag="$GITHUB_REF_NAME"'),'release must verify the pushed stable tag against candidate evidence');
assert(candidateVerifier.includes("rehearsal.remoteWrites===0")&&candidateVerifier.includes("stableTagInitiallyAbsent")&&candidateVerifier.includes("releaseArtifactByteIdentity")&&candidateVerifier.includes("simulatedRollbackRestoresMain")&&candidateVerifier.includes("remoteRefsUntouched"),'candidate evidence verifier must fail closed on remote writes, tag collision, artifact drift, rollback failure and remote-ref drift');
assert(candidateVerifier.includes("rehearsalMainBefore===expectedMainBefore"),'promotion evidence verifier must reject a stale main baseline');

for(const required of [
  "gfm.phase!=='G-FM'||gfm.module!=='aggregate'||gfm.status!=='PASS'",
  'gfm.expected_stable_count!==65||gfm.executed_runtime_count!==65',
  'gfm.PASS!==65||gfm.FAIL!==0||gfm.BLOCKED!==0',
  "result.status!=='PASS'",
  "qb!==String(result.runtime_version||'')",
  "/@sha256:[0-9a-f]{64}$/",
  "locale.module!=='real-qb-current-locale-aggregate'||locale.status!=='PASS'",
  "String(locale.weigSha||'').toLowerCase()!==sha",
  "locale.qbVersion!==localeLkg.latestAdmittedStable",
  'locale.expectedLocales!==expectedLocales.length||locale.passed!==expectedLocales.length',
  "!Array.isArray(locale.failures)||locale.failures.length!==0"
])assert(compatVerifier.includes(required),`release compatibility verifier is missing fail-closed rule: ${required}`);

assert(full.includes('workflow_dispatch:')&&!/\n\s*push:\s*\n/.test(full),'Full Frozen Matrix must remain manual-only final/release validation');
assert(localeWorkflow.includes('workflow_dispatch:'),'Locale Matrix must remain manually runnable for an exact final candidate');
assert(pkg.scripts.test.includes('tests/release-evidence-contract.mjs'),'npm test must protect promotion/release evidence ownership');

console.log('Release evidence contract passed: promote/release require same-run candidate rehearsal evidence plus manual exact-SHA G-FM 65/65 and current-stable Locale 61/61 aggregates; all compatibility evidence is revalidated fail-closed before promotion or publication.');
