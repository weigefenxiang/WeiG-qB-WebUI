import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
function filesUnder(rel,extensions){const base=path.join(root,rel),out=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(!extensions||extensions.some(ext=>entry.name.endsWith(ext)))out.push(path.relative(root,file).replaceAll('\\','/'));}}walk(base);return out.sort();}
function jobSection(ci,name,nextName){const normalized=ci.replace(/\r\n?/g,'\n'),marker=`\n  ${name}:\n`,start=normalized.indexOf(marker);assert(start>=0,`Missing CI job ${name}`);const end=nextName?normalized.indexOf(`\n  ${nextName}:\n`,start+marker.length):normalized.length;assert(end>start,`Unable to bound CI job ${name}`);return normalized.slice(start,end);}

const version=read('VERSION').trim(),webVersion=read('webui/VERSION').trim(),pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
assert(version===webVersion&&version===pkg.version&&version===lock.version&&version===lock.packages?.['']?.version,`Version sources diverged: ${version} / ${webVersion} / ${pkg.version} / ${lock.version}`);
assert(pkg.devDependencies?.playwright==='1.62.1','Playwright must be exact repository-owned dependency 1.62.1');
assert(lock.lockfileVersion===3&&lock.packages?.['node_modules/playwright']?.version==='1.62.1'&&lock.packages?.['node_modules/playwright-core']?.version==='1.62.1','package-lock must pin Playwright 1.62.1 with lockfile v3');
assert(pkg.scripts.test.includes('tests/qb-torrent-surface-parser-contract.mjs')&&pkg.scripts.test.includes('tests/release-profile-contract.mjs')&&pkg.scripts.test.includes('tests/torrent-field-provenance-contract.mjs'),'npm test must cover source-derived Torrent surface, exact release-profile ownership, and formal Torrent field provenance');

const browserTests=['browser-runtime.mjs','browser-theme.mjs','browser-feedback.mjs','browser-feature-parity.mjs','browser-torrent-workspace.mjs','browser-adaptive-ui.mjs','browser-sidebar-capability-visual.mjs'];
const driver=read('tests/browser-driver.mjs');
assert(/import\s*\{\s*chromium\s*\}\s*from\s*['"]playwright['"]/.test(driver),'browser-driver must be the Playwright Chromium owner');
assert(driver.includes('WEIGG_BROWSER_CHANNEL')&&driver.includes("DEFAULT_CHANNEL='chrome'")&&driver.includes("channel!=='chrome'"),'browser-driver must own hosted Chrome policy and fail closed');
for(const name of browserTests){const source=read(`tests/${name}`);assert(source.includes("from './browser-driver.mjs'"),`${name} must consume browser-driver`);assert(!/from\s*['"]playwright['"]/.test(source),`${name} imports Playwright directly`);assert(source.includes('launchBrowser('),`${name} does not launch through browser-driver`);}
const directPlaywrightOwners=filesUnder('tests',['.mjs']).filter(rel=>/from\s*['"]playwright['"]/.test(read(rel)));
assert(JSON.stringify(directPlaywrightOwners)===JSON.stringify(['tests/browser-driver.mjs']),`Playwright ownership duplicated: ${directPlaywrightOwners.join(', ')}`);

const workflowFiles=filesUnder('.github/workflows',['.yml','.yaml']);
for(const rel of workflowFiles){const source=read(rel);assert(!/npm\s+install[^\n]*playwright(?:@|\s|$)/i.test(source),`${rel} dynamically installs Playwright`);assert(!/\bnpx\s+playwright\s+install(?:-deps)?\b/i.test(source),`${rel} provisions a second browser runtime`);}

const ci=read('.github/workflows/ci.yml');
const ui=jobSection(ci,'ui_browser','release_compatibility'),releaseCompat=jobSection(ci,'release_compatibility','browser'),linux=jobSection(ci,'browser','windows_browser'),windows=jobSection(ci,'windows_browser','release_candidate'),candidate=jobSection(ci,'release_candidate');
for(const [name,section] of [['ui_browser',ui],['browser',linux],['windows_browser',windows]]){assert(/WEIGG_BROWSER_CHANNEL:\s*chrome/.test(section),`${name} must select hosted Chrome`);assert(section.includes('npm ci --no-audit --no-fund --prefer-offline'),`${name} must use repository-locked npm ci`);assert(/cache:\s*npm/.test(section)&&/cache-dependency-path:\s*package-lock\.json/.test(section),`${name} must key npm cache by package-lock.json`);}
assert(ui.includes('runs-on: ubuntu-24.04')&&linux.includes('runs-on: ubuntu-24.04')&&windows.includes('runs-on: windows-2025'),'browser runner generations must remain pinned');
assert(windows.includes('$tests = @(')&&windows.includes('foreach ($test in $tests)')&&(windows.match(/\$LASTEXITCODE\s+-ne\s+0/g)||[]).length>=3,'Windows browser gate must be one fail-fast loop');
for(const name of browserTests)assert(windows.includes(`'tests/${name}'`),`Windows browser list missing ${name}`);
assert(releaseCompat.includes('from 4.1.0')&&releaseCompat.includes('qb-release-catalog.mjs upstream-qb --output=qb-releases.json'),'candidate compatibility job must generate the exact qB 4.1.0 -> latest stable catalog');
assert(releaseCompat.includes('node tests/upstream-release-audit.mjs upstream-qb'),'candidate compatibility job must audit every supported stable tag');
assert(releaseCompat.includes('node tests/full-stable-product-compat.mjs qb-releases.json'),'candidate compatibility job must execute formal product semantics for every generated stable profile');
assert(releaseCompat.indexOf('qb-release-catalog.mjs upstream-qb --output=qb-releases.json')<releaseCompat.indexOf('full-stable-product-compat.mjs qb-releases.json'),'formal product matrix must consume the exact generated catalog');
assert(releaseCompat.includes('name: qb-release-catalog-${{ github.sha }}'),'exact stable catalog must cross the job boundary as a SHA-named artifact');
assert(candidate.includes('actions/download-artifact@v8')&&candidate.includes('qb-release-catalog-${{ github.sha }}'),'release candidate must reuse the exact audited catalog artifact');
assert(candidate.includes('node tools/qb-webui-catalog.mjs release-catalog/qb-releases.json webui/private/data/qb-releases.json')&&candidate.includes('test -s release/WeiG-qB-WebUI/private/data/qb-releases.json'),'release zip must compact the exact source-derived catalog below qB WebUI static-file limits before embedding it for W.ReleaseProfile');
const catalogPack=read('tools/qb-webui-catalog.mjs');
assert(catalogPack.includes('10*1024*1024')&&catalogPack.includes('Packed qB release catalog')&&catalogPack.includes('JSON.stringify(catalog)'),'catalog packaging must preserve JSON semantics and fail closed at qB WebUI static-file limits');
for(const [name,section] of [['release_compatibility',releaseCompat],['browser',linux],['windows_browser',windows],['release_candidate',candidate]]){
  assert(section.includes("github.ref == 'refs/heads/dev'"),`${name} candidate gate must run on dev`);
  assert(!section.includes("github.ref == 'refs/heads/main'"),`${name} must not require a second heavy main candidate`);
}

const promote=read('.github/workflows/promote.yml'),release=read('.github/workflows/release.yml');
assert(!promote.includes('LIVE-PASS')&&!promote.includes('live_gate:'),'promotion must not require deferred Phase G LIVE-PASS for the current release checkpoint');
assert(promote.includes("branch: 'dev'")&&promote.includes('release-candidate-${sha}'),'promotion must resolve the exact reusable dev candidate artifact');
assert(promote.includes('actions/download-artifact@v8')&&promote.includes('sha256sum -c SHA256SUMS')&&promote.includes('WeiG-qB-WebUI/GIT_SHA'),'promotion must verify the exact candidate artifact before moving main');
assert(promote.includes('git merge-base --is-ancestor origin/main "$CANDIDATE_SHA"')&&promote.includes('git push origin "$CANDIDATE_SHA:refs/heads/main"'),'promotion must remain safe fast-forward only');
assert(!promote.includes('validation_mode=candidate')&&!promote.includes('main-only candidate'),'promotion must not instruct a redundant main candidate rebuild');

assert(release.includes("branch: 'dev'")&&release.includes('release-candidate-${sha}'),'Release must reuse the exact dev candidate artifact');
assert(!release.includes("branch: 'main'\n              event: 'workflow_dispatch'"),'Release must not depend on a second main candidate run');
assert(release.includes('actions/download-artifact@v8')&&release.includes('run-id: ${{ steps.verify.outputs.run_id }}'),'Release must download the exact validated candidate run artifact');
assert(release.includes('test "$GITHUB_REF_NAME" = "v$VERSION"'),'Release tag must equal repository VERSION');
assert(release.includes('sha256sum -c SHA256SUMS')&&release.includes('WeiG-qB-WebUI/GIT_SHA')&&release.includes('WeiG-qB-WebUI/VERSION'),'Release must verify checksum, exact SHA and embedded VERSION');
assert(release.includes('--verify-tag')&&release.includes('--latest')&&release.includes('--generate-notes'),'Release must verify the pushed tag, publish it as Latest and generate notes');
assert(release.includes("Latest stable release of WeiG qB WebUI.")&&release.includes('--title "WeiG qB WebUI ${VERSION}"'),'Release presentation must lead with English stable-release text and a version title without the v-prefix');
assert(!release.includes('qb-release-catalog.mjs')&&!release.includes('zip -r WeiG-qB-WebUI.zip'),'Release workflow must publish the validated artifact without rebuilding product/catalog');
assert(!release.includes("workflow_id: 'upstream-compat.yml'"),'Release must rely on the full candidate all-stable source/product audit rather than require an unrelated exact-SHA parser workflow');

const fullProduct=read('tests/full-stable-product-compat.mjs');
for(const owner of ['release-profile.js','torrent-fields.js','settings-schema.js','capabilities.js','torrent-semantics.js','qb-client.js'])assert(fullProduct.includes(`'${owner}'`),`full stable product matrix must execute formal owner ${owner}`);
assert(fullProduct.includes("catalog[0].qbVersion,'4.1.0'")&&fullProduct.includes('every generated stable profile must enter the formal product matrix'),'full stable product matrix must protect floor and complete catalog coverage');
assert(!/major\s*>=\s*5\s*\?[^\n]*(?:start|stop|paused|stopped)/i.test(read('tests/release-compat.mjs')),'representative release gate must not use major>=5 as a product behavior oracle');

const pages=read('.github/workflows/pages.yml'),pagesBuild=jobSection(pages,'build','deploy'),pagesVerify=jobSection(pages,'verify','reuse_main'),pagesReuse=jobSection(pages,'reuse_main','promote_deploy'),pagesPromote=jobSection(pages,'promote_deploy'),pagesSource=read('.github/workflows/pages-source.yml');
assert(pagesSource.includes('name: Virtual qB Pages Source')&&/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*- main/.test(pagesSource),'Pages source relay must watch dev + main');
assert(pagesSource.includes("- 'webui/**'")&&pagesSource.includes("- 'simulator/**'")&&pagesSource.includes("- 'tools/data/qb-stable-lkg.json'")&&pagesSource.includes("- 'tests/fixtures/qb-release-catalog.lkg.json'"),'Pages source relay must watch product/simulator and admitted Frozen LKG inputs');
assert(!pagesSource.includes("- 'tools/qb-*.mjs'"),'Pages source relay must not redeploy for qB parser-only changes after Frozen LKG ownership is established');
assert(/actions:\s*write/.test(pagesSource)&&/contents:\s*read/.test(pagesSource),'Pages source relay must have only the Actions write capability needed to dispatch the deployment owner');
assert(!/pages:\s*write/.test(pagesSource)&&!/id-token:\s*write/.test(pagesSource),'Pages source relay must not own deployment permissions');
assert(pagesSource.includes('/actions/workflows/pages.yml/dispatches')&&pagesSource.includes('-f ref="$BRANCH"'),'Pages source relay must dispatch Virtual qB Pages on the same dev/main ref');
assert(pagesSource.includes('REMOTE_SHA=')&&pagesSource.includes('is stale; current head is'),'Pages source relay must suppress stale branch signals before dispatch');
assert(pages.includes('workflow_dispatch:')&&!pages.includes('workflow_run:')&&!/\n  push:\n/.test(pages),'Pages deployment must be ref-bound workflow_dispatch only; workflow_run would alias GITHUB_SHA to the default branch');
assert(!/\n  schedule:\n/.test(pages),'Pages deployment must not rebuild unchanged content on a weekly schedule; Stable Watch owns upstream change discovery');
assert(pages.includes('group: virtual-qb-pages-dispatch')&&pages.includes('cancel-in-progress: true'),'ref-bound Pages runs must serialize independently from the legacy default-branch workflow-run concurrency group');
assert(pages.includes('WEIGG_PAGES_SOURCE_SHA: ${{ github.sha }}')&&pages.includes('WEIGG_PAGES_SOURCE_BRANCH: ${{ github.ref_name }}'),'Pages source identity must be the dispatched ref SHA/branch used by deploy-pages');
assert(pagesBuild.includes("github.ref_name == 'dev'")&&pagesBuild.includes('ref: ${{ env.WEIGG_PAGES_SOURCE_SHA }}')&&pagesBuild.includes('DEV_SHA="$WEIGG_PAGES_SOURCE_SHA"')&&pagesBuild.includes('git archive --format=tar "$DEV_SHA":webui'),'dev Pages build must archive the exact dispatched dev SHA rather than a moving origin/dev ref');
assert(pagesBuild.includes('--simulator-sha="$WEIGG_PAGES_SOURCE_SHA"'),'Pages build metadata must remain bound to the exact dispatched SHA');
assert(!pagesBuild.includes('Checkout qBittorrent upstream')&&!pagesBuild.includes('.upstream/qBittorrent'),'Pages build must not re-clone or re-parse frozen qB history on every deployment');
assert(pagesBuild.includes('tools/data/qb-stable-lkg.json')&&pagesBuild.includes('catalogSha256')&&pagesBuild.includes("crypto.createHash('sha256')")&&pagesBuild.includes('cmp tests/fixtures/qb-release-catalog.lkg.json'),'Pages build must hash-verify and consume the admitted Frozen LKG byte-for-byte');
assert(pagesBuild.includes('Frozen Locale overlay was not applied to all 65 Pages profiles'),'Pages build must fail closed unless the frozen Locale overlay reaches all 65 exact profiles');
assert(pagesBuild.includes('virtual-qb-pages-site-${{ env.WEIGG_PAGES_SOURCE_SHA }}'),'dev Pages build must publish an exact-SHA reusable site artifact');
assert(pagesBuild.includes('Drain legacy default-branch Pages watcher')&&pagesBuild.includes('workflow[_]run')&&pagesBuild.includes('event=workflow_run')&&pagesBuild.includes('refusing to race deployment'),'while main still carries the legacy watcher, the ref-bound dev deployment must drain that post-dispatch run and fail closed rather than race it');
assert(pagesVerify.includes('runs-on: ubuntu-24.04')&&/WEIGG_BROWSER_CHANNEL:\s*chrome/.test(pagesVerify),'Pages live verification must use hosted Chrome on pinned Ubuntu');
assert(pagesVerify.includes('WEIGG_EXPECTED_SIMULATOR_SHA: ${{ github.sha }}')&&pagesVerify.includes('test "$GITHUB_SHA" = "$WEIGG_PAGES_SOURCE_SHA"'),'Pages verify must bind browser evidence and deploy-pages build version to the exact dispatched SHA');
assert(pagesVerify.includes('node tests/pages-live-acceptance.mjs')&&pagesVerify.includes('node tests/pages-live-preferences.mjs')&&pagesVerify.includes('node tests/pages-live-release-profile.mjs'),'Pages verify must cover base acceptance, all stable Preferences, and exact release-profile capability/filter truth');
assert(pagesReuse.includes("github.ref_name == 'main'")&&pagesReuse.includes('branch=dev&event=workflow_dispatch&status=success')&&pagesReuse.includes('virtual-qb-pages-site-$EXACT_SHA'),'main Pages promotion must resolve only a successful exact dev workflow_dispatch artifact');
assert(!pagesReuse.includes('--name github-pages')&&!pagesReuse.includes('legacy exact dev github-pages'),'main Pages promotion must not fall back to legacy github-pages artifacts');
assert(pagesReuse.includes('No successful exact reusable dev Pages artifact exists'),'main Pages promotion must fail closed when the exact validated dev artifact is unavailable');
assert(pagesPromote.includes('Verify promoted main Pages identity')&&pagesPromote.includes('main/app/virtual-qb-build.json')&&pagesPromote.includes('Promoted Pages did not converge to exact main SHA'),'main Pages deployment must verify the live main/dev exact-SHA alias instead of trusting deploy-pages success alone');
const deployPagesSource=read('.github/workflows/pages.yml');
assert(!deployPagesSource.includes('GITHUB_SHA: ${{ env.WEIGG_PAGES_SOURCE_SHA }}'),'Pages must not attempt to override reserved GITHUB_SHA; trigger choreography owns the deploy-pages build version');
const profileLive=read('tests/pages-live-release-profile.mjs');
assert(profileLive.includes("catalog[0].qbVersion,'4.1.0'")||profileLive.includes("catalog[0].qbVersion,'4.1.0'"),'Pages release-profile gate must protect formal qB 4.1.0 floor');
assert(profileLive.includes("item.qbVersion==='4.6.1'")&&profileLive.includes("webApiVersion==='2.9.3'"),'Pages release-profile gate must protect qB 4.6.1/WebAPI 2.9.3 fact');
assert(profileLive.includes("['downloads','connection','speed','bittorrent','webui','advanced']"),'Pages release-profile gate must exercise all six qB Settings surfaces');
const authLive=read('tests/pages-live-auth.mjs'),preferencesLive=read('tests/pages-live-preferences.mjs'),servicesLive=read('tests/pages-live-services-core.mjs');
for(const source of [authLive,preferencesLive,servicesLive])assert(source.includes('weigshare'),'Pages authentication owners must use the fixed weigshare credential');
assert(!preferencesLive.includes("username:'demo'")&&!servicesLive.includes("inputValue(),'demo'"),'Pages live gates must not retain the old demo credential assumption');
assert(authLive.includes("virtualQbAuthLifecycle:'PASS'")&&authLive.includes('wrongPasswordRejected:true')&&authLive.includes('oldPasswordRejectedAfterChange:true')&&authLive.includes('passwordWriteOnly:true'),'Pages auth lifecycle must gate wrong-password rejection, password change invalidation and write-only password semantics');

console.log(`CI contract passed for WeiG ${version}: exact qB 4.1.0+ source catalog is audited once on dev, executed through every formal product compatibility owner, compact-packed for qB WebUI static delivery, embedded in the reusable candidate artifact, and that exact artifact is promoted/released without a main rebuild; Pages consumes hash-bound Frozen LKG + Locale facts, dispatches on the real dev/main ref so deploy-pages build identity is exact, drains the legacy default-branch watcher during branch migration, main promotion reuses only the validated dev site artifact, and hosted Chrome remains canonical.`);
