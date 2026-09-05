import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
function filesUnder(rel,extensions){
  const base=path.join(root,rel),out=[];
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,entry.name);
      if(entry.isDirectory())walk(file);
      else if(!extensions||extensions.some(ext=>entry.name.endsWith(ext)))out.push(path.relative(root,file).replaceAll('\\','/'));
    }
  }
  walk(base);
  return out.sort();
}
function jobSection(ci,name,nextName){
  const normalized=ci.replace(/\r\n?/g,'\n');
  const marker=`\n  ${name}:\n`,start=normalized.indexOf(marker);
  assert(start>=0,`Missing CI job ${name}`);
  const end=nextName?normalized.indexOf(`\n  ${nextName}:\n`,start+marker.length):normalized.length;
  assert(end>start,`Unable to bound CI job ${name}`);
  return normalized.slice(start,end);
}

const version=read('VERSION').trim();
const webVersion=read('webui/VERSION').trim();
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
assert(version===webVersion&&version===pkg.version,`Version sources diverged: ${version} / ${webVersion} / ${pkg.version}`);
assert(pkg.devDependencies?.playwright==='1.62.1','Playwright must be an exact repository-owned devDependency at 1.62.1');
assert(lock.lockfileVersion===3,'package-lock.json must use lockfileVersion 3');
assert(lock.packages?.['']?.version===pkg.version,'package-lock root version must match package.json');
assert(lock.packages?.['']?.devDependencies?.playwright==='1.62.1','package-lock root must pin Playwright 1.62.1');
assert(lock.packages?.['node_modules/playwright']?.version==='1.62.1','package-lock must resolve Playwright 1.62.1');
assert(lock.packages?.['node_modules/playwright-core']?.version==='1.62.1','package-lock must resolve playwright-core 1.62.1');

const browserTests=[
  'browser-runtime.mjs',
  'browser-theme.mjs',
  'browser-feedback.mjs',
  'browser-feature-parity.mjs',
  'browser-torrent-workspace.mjs',
  'browser-adaptive-ui.mjs'
];
const driver=read('tests/browser-driver.mjs');
assert(/import\s*\{\s*chromium\s*\}\s*from\s*['"]playwright['"]/.test(driver),'browser-driver must be the Playwright Chromium owner');
assert(driver.includes('WEIGG_BROWSER_CHANNEL')&&driver.includes("DEFAULT_CHANNEL='chrome'"),'browser-driver must own hosted Chrome channel policy');
assert(driver.includes("channel!=='chrome'"),'browser-driver must fail closed for non-canonical browser channels');
assert(driver.includes("Object.hasOwn(launchOptions,'channel')")&&driver.includes("Object.hasOwn(launchOptions,'executablePath')"),'browser-driver must reject caller browser-policy overrides');

for(const name of browserTests){
  const source=read(`tests/${name}`);
  assert(source.includes("from './browser-driver.mjs'"),`${name} must consume the canonical browser-driver`);
  assert(!/from\s*['"]playwright['"]/.test(source),`${name} still imports Playwright directly`);
  assert(!/\bchromium\.launch\s*\(/.test(source),`${name} still owns chromium.launch policy`);
  assert(source.includes('launchBrowser('),`${name} does not launch through browser-driver`);
}
const pagesLive=read('tests/pages-live-acceptance.mjs');
assert(pagesLive.includes("from './browser-driver.mjs'"),'pages-live-acceptance.mjs must consume the canonical browser-driver');
assert(!/from\s*['"]playwright['"]/.test(pagesLive),'pages-live-acceptance.mjs must not import Playwright directly');
assert(!/\bchromium\.launch\s*\(/.test(pagesLive),'pages-live-acceptance.mjs must not own chromium.launch policy');
assert(pagesLive.includes('launchBrowser('),'pages-live-acceptance.mjs must launch through browser-driver');
assert(pagesLive.includes('WEIGG_EXPECTED_SIMULATOR_SHA')&&pagesLive.includes('metadata/site.json'),'Pages live acceptance must bind deployed evidence to exact simulator SHA metadata');
assert(pagesLive.includes("qb:'5.2.3',count:5000")&&pagesLive.includes("qb:'4.1.9.1'"),'Pages live acceptance must protect qB5 5000-Torrent and qB4 floor sessions');
const directPlaywrightOwners=filesUnder('tests',['.mjs']).filter(rel=>/from\s*['"]playwright['"]/.test(read(rel)));
assert(JSON.stringify(directPlaywrightOwners)===JSON.stringify(['tests/browser-driver.mjs']),`Playwright test ownership is duplicated: ${directPlaywrightOwners.join(', ')}`);

const workflowFiles=filesUnder('.github/workflows',['.yml','.yaml']);
for(const rel of workflowFiles){
  const source=read(rel);
  assert(!/npm\s+install[^\n]*playwright(?:@|\s|$)/i.test(source),`${rel} dynamically installs Playwright`);
  assert(!/\bnpx\s+playwright\s+install(?:-deps)?\b/i.test(source),`${rel} provisions a Playwright browser runtime`);
  assert(!/Use Ubuntu archive mirror|Install Chromium test runtime/i.test(source),`${rel} retains retired Chromium provisioning steps`);
}
const activeAuditFiles=[...workflowFiles,...filesUnder('tests',['.mjs','.sh']),...filesUnder('docs',['.md']),'DESIGN.md','package.json','package-lock.json'];
const retiredPlaywrightVersion=['playwright','@1.55.0'].join('');
for(const rel of activeAuditFiles)assert(!read(rel).includes(retiredPlaywrightVersion),`${rel} retains retired Playwright 1.55.0 ownership`);

const ci=read('.github/workflows/ci.yml');
const ui=jobSection(ci,'ui_browser','release_compatibility');
const linux=jobSection(ci,'browser','windows_browser');
const windows=jobSection(ci,'windows_browser','release_candidate');
for(const [name,section] of [['ui_browser',ui],['browser',linux],['windows_browser',windows]]){
  assert(/WEIGG_BROWSER_CHANNEL:\s*chrome/.test(section),`${name} must explicitly select hosted Chrome`);
  assert(section.includes('npm ci --no-audit --no-fund --prefer-offline'),`${name} must install repository-locked dependencies with npm ci`);
  assert(/cache:\s*npm/.test(section)&&/cache-dependency-path:\s*package-lock\.json/.test(section),`${name} must use setup-node npm cache keyed by package-lock.json`);
  assert(section.includes("require('playwright/package.json').version"),`${name} must log Playwright identity`);
}
assert(ui.includes('runs-on: ubuntu-24.04')&&linux.includes('runs-on: ubuntu-24.04'),'Linux browser gates must pin the Ubuntu 24.04 runner generation');
assert(windows.includes('runs-on: windows-2025'),'Windows browser candidate must pin the Windows 2025 runner generation');
assert(ui.includes('google-chrome --version')&&linux.includes('google-chrome --version'),'Linux browser gates must verify hosted Google Chrome Stable');
assert(windows.includes('Hosted Google Chrome Stable is missing.'),'Windows browser candidate must fail closed when hosted Chrome is unavailable');
assert(windows.includes('VersionInfo.ProductVersion')&&windows.includes('Google Chrome $chromeVersion'),'Windows browser candidate must log hosted Google Chrome version from file metadata');
const windowsNativeFailureChecks=(windows.match(/\$LASTEXITCODE\s+-ne\s+0/g)||[]).length;
assert(windowsNativeFailureChecks>=3,'Windows browser candidate must fail fast after native Node/npm commands instead of inheriting the last command exit code');
assert(windows.includes('$tests = @(')&&windows.includes('foreach ($test in $tests)')&&windows.includes('node $test'),'Windows browser candidate must run browser callers through one fail-fast loop');
for(const name of browserTests)assert(windows.includes(`'tests/${name}'`),`Windows fail-fast browser list is missing ${name}`);

const pages=read('.github/workflows/pages.yml');
const pagesVerify=jobSection(pages,'verify');
assert(pages.includes("page_url: ${{ steps.deployment.outputs.page_url }}"),'Pages deploy job must export the exact deployed page URL');
assert(pagesVerify.includes('needs: deploy'),'Pages live verification must run only after deployment');
assert(pagesVerify.includes('runs-on: ubuntu-24.04'),'Pages live verification must pin Ubuntu 24.04');
assert(/WEIGG_BROWSER_CHANNEL:\s*chrome/.test(pagesVerify),'Pages live verification must explicitly select hosted Chrome');
assert(pagesVerify.includes('WEIGG_PAGES_URL: ${{ needs.deploy.outputs.page_url }}'),'Pages live verification must consume the deploy action page URL');
assert(pagesVerify.includes('WEIGG_EXPECTED_SIMULATOR_SHA: ${{ github.sha }}'),'Pages live verification must bind evidence to github.sha');
assert(pagesVerify.includes('npm ci --no-audit --no-fund --prefer-offline'),'Pages live verification must install repository-locked dependencies with npm ci');
assert(pagesVerify.includes("require('playwright/package.json').version")&&pagesVerify.includes('google-chrome --version'),'Pages live verification must log Playwright and hosted Chrome identity');
assert(pagesVerify.includes('node tests/pages-live-acceptance.mjs'),'Pages live verification must execute the canonical deployed-runtime acceptance test');

console.log(`CI browser-runtime contract passed for WeiG ${version}: Playwright 1.62.1 is repository-owned; Linux/Windows use hosted Chrome; Windows native browser commands are fail-fast; deployed Virtual qB Pages is exact-SHA verified after deployment.`);
