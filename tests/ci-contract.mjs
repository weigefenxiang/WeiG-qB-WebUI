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
assert(pkg.scripts.test.includes('tests/qb-torrent-surface-parser-contract.mjs')&&pkg.scripts.test.includes('tests/release-profile-contract.mjs'),'npm test must cover source-derived Torrent surface and exact release-profile ownership');

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
assert(releaseCompat.includes('name: qb-release-catalog-${{ github.sha }}'),'exact stable catalog must cross the job boundary as a SHA-named artifact');
assert(candidate.includes('actions/download-artifact@v8')&&candidate.includes('qb-release-catalog-${{ github.sha }}'),'release candidate must reuse the exact audited catalog artifact');
assert(candidate.includes('cp release-catalog/qb-releases.json webui/private/data/qb-releases.json')&&candidate.includes('test -s release/WeiG-qB-WebUI/private/data/qb-releases.json'),'release zip must embed the source-derived catalog consumed by W.ReleaseProfile');

const pages=read('.github/workflows/pages.yml'),pagesBuild=jobSection(pages,'build','deploy'),pagesVerify=jobSection(pages,'verify'),pagesSource=read('.github/workflows/pages-source.yml');
assert(pagesSource.includes('name: Virtual qB Pages Source')&&/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*- main/.test(pagesSource),'Pages source relay must watch dev + main');
assert(pagesSource.includes("- 'webui/**'")&&pagesSource.includes("- 'simulator/**'")&&pagesSource.includes("- 'tools/qb-*.mjs'"),'Pages source relay must watch all product/simulator/qB catalog parser inputs');
assert(!/pages:\s*write/.test(pagesSource)&&!/id-token:\s*write/.test(pagesSource),'Pages source signal must not own deployment permissions');
assert(pages.includes('workflow_run:')&&pages.includes('- Virtual qB Pages Source')&&!/\n  push:\n/.test(pages),'Pages deployment must remain default-branch workflow_run owned');
assert(pages.includes("WEIGG_PAGES_SOURCE_SHA: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}"),'Pages must preserve the source exact SHA');
assert(pagesBuild.includes('ref: ${{ env.WEIGG_PAGES_SOURCE_SHA }}')&&pagesBuild.includes('--simulator-sha="$WEIGG_PAGES_SOURCE_SHA"'),'Pages build must bind source checkout and metadata to exact SHA');
assert(pagesBuild.includes('tools/qb-release-catalog.mjs')&&pagesBuild.includes('test -s "$RUNNER_TEMP/virtual-qb-site/dev/app/__source/private/data/qb-releases.json"'),'Pages build must inject and verify the exact qB release catalog in product runtime data');
assert(pagesVerify.includes('runs-on: ubuntu-24.04')&&/WEIGG_BROWSER_CHANNEL:\s*chrome/.test(pagesVerify),'Pages live verification must use hosted Chrome on pinned Ubuntu');
assert(pagesVerify.includes('WEIGG_PAGES_URL: ${{ needs.deploy.outputs.page_url }}')&&pagesVerify.includes('WEIGG_EXPECTED_SIMULATOR_SHA'),'Pages verify must bind browser evidence to deployed exact SHA');
assert(pagesVerify.includes('node tests/pages-live-acceptance.mjs')&&pagesVerify.includes('node tests/pages-live-preferences.mjs')&&pagesVerify.includes('node tests/pages-live-release-profile.mjs'),'Pages verify must cover base acceptance, all stable Preferences, and exact release-profile capability/filter truth');
const profileLive=read('tests/pages-live-release-profile.mjs');
assert(profileLive.includes("catalog[0].qbVersion,'4.1.0'")||profileLive.includes("catalog[0].qbVersion,'4.1.0'"),'Pages release-profile gate must protect formal qB 4.1.0 floor');
assert(profileLive.includes("item.qbVersion==='4.6.1'")&&profileLive.includes("webApiVersion==='2.9.3'"),'Pages release-profile gate must protect qB 4.6.1/WebAPI 2.9.3 fact');
assert(profileLive.includes("['downloads','connection','speed','bittorrent','webui','advanced']"),'Pages release-profile gate must exercise all six qB Settings surfaces');

console.log(`CI contract passed for WeiG ${version}: exact qB 4.1.0+ source catalog is audited once and embedded in release/Pages artifacts; hosted Chrome remains canonical; Pages live gates bind exact SHA and source-derived Settings/Torrent capability truth.`);
