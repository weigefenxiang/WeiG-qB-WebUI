import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const promote=read('.github/workflows/promote.yml');
const release=read('.github/workflows/release.yml');
const verifier=read('tests/release-candidate-evidence.mjs');
const pkg=JSON.parse(read('package.json'));

for(const [name,source] of [['promotion',promote],['release',release]]){
  assert(source.includes('release-candidate-${sha}'),`${name} must resolve the exact candidate artifact`);
  assert(source.includes('candidate-deployment-${sha}'),`${name} must resolve same-run candidate deployment evidence`);
  assert(source.includes('candidateArtifact && evidenceArtifact'),`${name} must require candidate + evidence from the same successful CI run`);
  assert(source.includes('actions/download-artifact@v8')&&source.includes('evidence/candidate.json'),`${name} must download machine-readable candidate deployment evidence`);
  assert(source.includes('node tests/release-candidate-evidence.mjs'),`${name} must execute the repository-owned evidence verifier`);
}
assert(promote.includes('--mode=promotion')&&promote.includes('--main-before="$MAIN_BEFORE"'),'promotion must bind rehearsal evidence to the current pre-promotion main SHA');
assert(promote.includes("core.setOutput('main_sha', mainSha)"),'promotion resolver must export the exact current main SHA used for rehearsal freshness');
assert(release.includes('--mode=release')&&release.includes('--tag="$GITHUB_REF_NAME"'),'release must verify the pushed stable tag against candidate evidence');
assert(verifier.includes("rehearsal.remoteWrites===0")&&verifier.includes("stableTagInitiallyAbsent")&&verifier.includes("releaseArtifactByteIdentity")&&verifier.includes("simulatedRollbackRestoresMain")&&verifier.includes("remoteRefsUntouched"),'evidence verifier must fail closed on remote writes, tag collision, artifact drift, rollback failure and remote-ref drift');
assert(verifier.includes("rehearsalMainBefore===expectedMainBefore"),'promotion evidence verifier must reject a stale main baseline');
assert(pkg.scripts.test.includes('tests/release-evidence-contract.mjs'),'npm test must protect promotion/release evidence ownership');

console.log('Release evidence contract passed: promote/release require same-run deployment + rehearsal evidence, exact artifact identity, fresh promotion main baseline, zero remote writes and rollback proof.');
