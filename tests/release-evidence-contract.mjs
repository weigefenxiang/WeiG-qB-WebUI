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
  assert(source.includes('real-qb-full-aggregate-${compatSha}')&&source.includes('real-qb-current-locale-aggregate-${compatSha}')||source.includes('real-qb-full-aggregate-${evidenceSha}')&&source.includes('real-qb-current-locale-aggregate-${evidenceSha}'),`${name} must bind both expensive matrix aggregates to one verified compatibility evidence SHA`);
  assert(source.includes("run.event === 'workflow_dispatch'"),`${name} compatibility resolver must admit manually dispatched matrix evidence only`);
  assert(source.includes('path: gfm')&&source.includes('path: locale'),`${name} must download both G-FM and Locale aggregate evidence`);
  assert(source.includes('node tests/release-compat-evidence.mjs'),`${name} must execute the central release compatibility evidence verifier`);
  assert(source.includes('node tests/release-candidate-evidence.mjs'),`${name} must execute the repository-owned candidate evidence verifier`);
  assert(!source.includes('real-qb-fast-aggregate-${sha}'),`${name} must never accept Fast G-FM aggregate evidence`);
}
assert(promote.includes('compat_evidence_sha')&&promote.includes('Compatibility evidence reuse refused')&&promote.includes('compatSha !== sha'),'promotion must require explicit guarded reuse whenever compatibility evidence SHA differs from the final candidate');
assert(release.includes('reusableCompatibilitySha')&&release.includes('No Full Frozen + Locale evidence pair can safely represent exact release SHA')&&release.includes('Compatibility evidence')&&release.includes('non-validation changes'),'release must rediscover reusable compatibility evidence only through the same fail-closed validation-only descendant rule');
for(const source of [promote,release]){
  assert(source.includes("'.github/workflows/ci.yml'")&&source.includes("'.github/workflows/promote.yml'")&&source.includes("'.github/workflows/release.yml'")&&source.includes("'tests/full-stable-product-compat.mjs'")&&source.includes("'tests/release-evidence-contract.mjs'"),'compatibility evidence reuse allowlist must stay explicit and narrow');
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

assert(full.includes('workflow_dispatch:')&&!/\n\s*push:\s*/.test(full),'Full Frozen Matrix must be final-candidate manual-only');
assert(full.includes('mode=exhaustive')&&!full.includes('mode=fast'),'Full Frozen Matrix workflow must route only to Exhaustive release-grade evidence');
assert(!full.includes('real-qb-fast-aggregate-${{ github.sha }}')&&full.includes('real-qb-full-aggregate-${{ github.sha }}'),'Only Exhaustive aggregate evidence belongs to the final-candidate workflow');
assert(localeWorkflow.includes('workflow_dispatch:')&&!/\n\s*push:\s*/.test(localeWorkflow),'Locale Matrix must remain manually runnable and must not create ordinary dev-push runs');
assert(pkg.scripts.test.includes('tests/release-evidence-contract.mjs'),'npm test must protect promotion/release evidence ownership');

console.log('Release evidence contract passed: ordinary dev pushes do not start release-grade compatibility matrices; candidate/rehearsal evidence stays exact-SHA while Full Frozen 65/65 + Locale 61/61 may cross only an explicit validation-only descendant boundary, with aggregate SHA identity revalidated fail-closed before promotion or publication.');
