import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const workflow=read('.github/workflows/real-qb-full.yml');
const runner=read('tests/real-qb-full-runner.sh');
const matrix=read('tests/real-qb-full-matrix.mjs');

assert(workflow.includes('workflow_dispatch:'),'G-FM must remain explicitly dispatchable.');
assert(workflow.includes("branches: [dev]")&&workflow.includes("'tests/real-qb-full-*.mjs'")&&workflow.includes("'tests/real-qb-full-runner.sh'"),'G-FM implementation changes must self-trigger on dev.');
assert(workflow.includes('versions: ${{ steps.matrix.outputs.versions }}')&&workflow.includes('node tests/real-qb-full-matrix.mjs --matrix'),'G-FM must derive its matrix from Frozen LKG, not a handwritten version table.');
assert(workflow.includes('fail-fast: false')&&workflow.includes('max-parallel: 16'),'G-FM must use 65 independent jobs with fail-fast false and max-parallel 16.');
assert(workflow.includes('qb: ${{ fromJson(needs.plan.outputs.versions) }}'),'G-FM matrix must consume the dynamic Frozen version list.');
assert(workflow.includes('real-qb-full-runner.sh --version "$QB_VERSION" --allow-writes'),'G-FM must execute the dedicated isolated exact-version runtime runner.');
assert(workflow.includes('if: always()')&&workflow.includes('real-qb-full-${{ matrix.qb }}-${{ github.sha }}')&&workflow.includes('if-no-files-found: error'),'Every version must upload exact-SHA evidence and missing evidence must fail closed.');
assert(workflow.includes('needs: [plan, real]')&&workflow.includes('--aggregate full-evidence')&&workflow.includes('real-qb-full-aggregate-${{ github.sha }}'),'G-FM must have a final exact-SHA aggregate gate.');

for(const status of ["'BLOCKED'","'FAIL'","'PASS'"])assert(runner.includes(`finalize ${status}`),`Runtime runner missing ${status} finalization.`);
for(const provider of ['qbittorrentofficial/qbittorrent-nox','linuxserver/qbittorrent','crazymax/qbittorrent','wernight/qbittorrent@sha256:'])assert(runner.includes(provider),`G-FM resolver missing approved provider ${provider}`);
assert(!runner.includes('justmiles/qbittorrent'),'Unverified justmiles startup contract must not be used by G-FM.');
assert(runner.includes('hub.docker.com/v2/repositories/linuxserver/qbittorrent/tags?page_size=1000'),'G-FM must discover auditable LinuxServer historical build tags instead of assuming one naming scheme.');
assert(runner.includes("docker network create --internal")&&!runner.includes('-p 8080:8080'),'G-FM real qB targets must remain private and must not publish WebUI ports.');
assert(runner.includes('resolved="$(docker image inspect')&&runner.includes('!= *@sha256:*'),'Mutable provider tags must be locked to immutable RepoDigests before execution.');
assert(runner.includes('numeric')&&runner.includes('== "$VERSION"'),'Resolved runtime must self-report the exact expected qB version.');
assert(runner.includes("CLEANUP_RESULT='PASS'")&&runner.includes('isolated Docker cleanup failed'),'G-FM must fail closed when isolated cleanup fails.');
assert(runner.includes("'RUNTIME_ESTABLISHED'")&&runner.includes('run_semantics'),'G-FM may run semantic evidence only after exact runtime identity is established.');
assert(matrix.includes('manifest.catalogSha256')&&matrix.includes('manifest.profileCount')&&matrix.includes('duplicate qB versions'),'G-FM planner must verify Frozen identity, count and uniqueness.');
assert(matrix.includes("runtime.cleanup_result!=='PASS'")&&matrix.includes('expected one core semantic evidence')&&matrix.includes('expected one Search evidence'),'G-FM aggregate must require cleanup plus core/search semantic evidence for every PASS runtime.');
assert(matrix.includes('pass===f.manifest.profileCount')&&matrix.includes('blocked===0')&&matrix.includes('missing.length===0')&&matrix.includes('duplicates.length===0'),'G-FM aggregate must fail unless every Frozen profile passes with zero missing/duplicate/BLOCKED results.');

console.log('Real-qB Full Frozen Matrix contract passed: dedicated historical runtime resolver, immutable image identity, complete failure evidence, isolated cleanup and strict 65/65 aggregate are enforced.');
