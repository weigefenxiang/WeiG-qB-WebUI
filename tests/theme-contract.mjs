import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
function filesUnder(rel,exts){const base=path.join(root,rel),out=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(!exts||exts.some(x=>e.name.endsWith(x)))out.push(path.relative(root,p).replaceAll('\\','/'));}}walk(base);return out.sort();}

const version=read('VERSION').trim();
const webVersion=read('webui/VERSION').trim();
const pkg=JSON.parse(read('package.json'));
assert(version===webVersion&&version===pkg.version,`Version sources diverged: ${version} / ${webVersion} / ${pkg.version}`);

const index=read('webui/private/index.html');
const core=read('webui/private/scripts/core.js');
const app=read('webui/private/scripts/app.js');
const settings=read('webui/private/scripts/settings.js');
const header=read('webui/private/scripts/header.js');
const theme=read('webui/private/scripts/theme.js');
const spatial=read('webui/private/css/spatial.css');
const controls=read('webui/private/css/controls.css');
const ui=read('webui/private/css/ui.css');
const settingsCss=read('webui/private/css/settings.css');
const transferCss=read('webui/private/css/transfer.css');
const logsCss=read('webui/private/css/logs.css');
const layout=read('webui/private/css/layout.css');
const brandCss=read('webui/private/css/brand.css');
const headerCss=read('webui/private/css/header.css');
const docs=[read('DESIGN.md'),read('docs/003.项目架构.md'),read('docs/004.UI与缓存契约.md'),read('docs/005.统一交互与设置系统.md')].join('\n');
const runtimeJs=filesUnder('webui/private/scripts',['.js']);
const runtimeCss=filesUnder('webui/private/css',['.css']);
const runtimeJsText=runtimeJs.map(p=>`\n/* ${p} */\n${read(p)}`).join('');

assert(index.includes('scripts/theme.js?v=__WEIGG_GIT_SHA__'),'Canonical theme owner is not loaded');
assert(/id="theme-btn"[^>]*theme-control-host/.test(index),'Header theme host missing');
assert(!/<button[^>]+id="theme-btn"/.test(index),'Legacy theme button owner survived');
assert(index.indexOf('scripts/floating.js')<index.indexOf('scripts/theme.js')&&index.indexOf('scripts/theme.js')<index.indexOf('scripts/settings.js'),'Theme owner load order is invalid');
assert(/W\.Theme=\{/.test(theme),'W.Theme Current Owner missing');
for(const mode of ['system','time','light','dark'])assert(theme.includes(`'${mode}'`),`Theme mode ${mode} missing`);
assert(theme.includes("matchMedia('(prefers-color-scheme: dark)')"),'System theme capability missing');
assert(theme.includes('nextBoundary')&&theme.includes('setHours(8,0,0,0)')&&theme.includes('setHours(20,0,0,0)'),'Smart Auto boundary scheduler missing');
assert(!/setInterval\s*\(/.test(theme),'Theme owner must not poll with setInterval');
assert(!/fetch\s*\(|new\s+W\.QBClient|MutationObserver|prototype\.|XMLHttpRequest/.test(theme),'Theme owner introduced network/repair/monkey-patch work');
assert(/if\(W\.Theme&&W\.Theme\.applyConfig\)W\.Theme\.applyConfig\(cfg\)/.test(core),'Config does not delegate resolved theme to W.Theme');
assert(!/prefers-color-scheme/.test(core),'Config still owns system theme resolution');
assert(!/function\s+toggleTheme|theme-btn'\)\.onclick|theme-btn"\)\.onclick/.test(app),'Legacy app Theme owner/caller survived');
assert(settings.includes('W.Theme.options()')&&settings.includes('weiggDraft')&&settings.includes('W.Config.apply(nextConfig)'),'Settings is not a draft-based W.Theme presentation caller');
assert(!settings.includes("if(key==='theme'){W.Theme.setMode(value)"),'Settings must not bypass shared Save with immediate Theme persistence');
assert(header.includes("C.selectControl({id:'theme-control'")&&header.includes('W.Theme.setMode(value)'),'Header does not reuse canonical Select/W.Theme');
assert(header.includes('.setOptions(')&&header.includes('.setValue('),'Header Theme presentation is not synchronized through canonical Select API');
assert(!header.includes('toggleTheme'),'Header contains a second Theme policy');

// Exact-checkout repo-wide caller/owner audit. GitHub Code Search is not used as proof.
assert((runtimeJsText.match(/W\.Theme=\{/g)||[]).length===1,'Runtime contains more than one W.Theme definition');
assert(!/function\s+toggleTheme\s*\(/.test(runtimeJsText),'Legacy toggleTheme survived elsewhere in runtime');
assert(!/getElementById\(['"]theme-btn['"]\)\.onclick|U\.\$\(['"]theme-btn['"]\)\.onclick/.test(runtimeJsText),'Direct theme-btn onclick survived elsewhere in runtime');
const schemeOwners=runtimeJs.filter(p=>read(p).includes("matchMedia('(prefers-color-scheme: dark)')"));
assert(JSON.stringify(schemeOwners)===JSON.stringify(['webui/private/scripts/theme.js']),`System Theme resolution has duplicate JS owners: ${schemeOwners.join(', ')}`);
for(const p of [...runtimeJs,...runtimeCss])assert(!/(?:^|\/)(?:theme|light)[-_]?v\d+/i.test(p)&&!/(?:^|\/)(?:theme|light)[-_]?(?:fix|patch)\.(?:js|css)$/i.test(p),`Versioned/patch Theme runtime file is prohibited: ${p}`);

const sandbox={window:null,document:{hidden:false,documentElement:{dataset:{}},querySelector(){return null;},addEventListener(){}},CustomEvent:function(){},Date,clearTimeout,setTimeout(){return 1;},matchMedia(){return{matches:false,addEventListener(){},removeEventListener(){}}},addEventListener(){},dispatchEvent(){}};
sandbox.window=sandbox;sandbox.WeiG={Config:{load(){return{theme:'dark'};},save(){}}};vm.runInNewContext(theme,sandbox,{filename:'theme.js'});
const T=sandbox.WeiG.Theme;
const at=h=>new Date(2026,0,2,h,0,0,0);
assert(T.resolveFor('time',at(7))==='dark','07:00 must resolve Dark');
assert(T.resolveFor('time',at(8))==='light','08:00 must resolve Light');
assert(T.resolveFor('time',at(19))==='light','19:00 must resolve Light');
assert(T.resolveFor('time',at(20))==='dark','20:00 must resolve Dark');
assert(T.nextBoundary(new Date(2026,0,2,7,59)).getHours()===8,'Next Smart Auto boundary before 08:00 is wrong');
assert(T.nextBoundary(new Date(2026,0,2,8,1)).getHours()===20,'Next Smart Auto boundary after 08:00 is wrong');
assert(T.nextBoundary(new Date(2026,0,2,20,1)).getHours()===8,'Next Smart Auto boundary after 20:00 is wrong');

assert(spatial.includes('html[data-theme="light"]{--spatial-void:#f7faff')&&spatial.includes('--spatial-panel:#fff'),'Light spatial palette is not white-based');
assert(!/html\[data-theme="light"\][^{]*(?:\.topbar|\.sidebar|\.torrent-panel|\.stat-card)[^{]*\{[^}]*!important/.test(spatial),'Legacy Light CSS patch layering survived');
assert(settingsCss.includes('html[data-theme=light]{--settings-section-surface:')&&!settingsCss.includes('.settings-section{margin-bottom:14px;overflow:hidden;border:1px solid var(--border);border-radius:15px;background:linear-gradient(180deg,rgba(20,36,62,.42),rgba(9,18,34,.28))'),'Settings still hard-codes its Dark surface outside semantic tokens');
assert(controls.includes('--control-option-hover')&&ui.includes('--ui-dialog-backdrop')&&layout.includes('--mobile-state-overlay'),'Shared controls/Dialog/Mobile state are not theme-tokenized');
assert(/@media\(max-width:820px\)[\s\S]*theme-control-host[\s\S]*44px/.test(headerCss),'Mobile Theme target is not 44px');

// THEME-DARK-STABILITY: tokenization for Light must reproduce the accepted Dark baseline.
const darkSignatures=[
  [spatial,'--spatial-topbar-shadow:0 13px 34px rgba(0,0,0,.30),0 1px 0 rgba(117,151,225,.06),inset 0 1px rgba(255,255,255,.07)','Dark Topbar shadow drifted'],
  [spatial,'--spatial-search-shadow:0 10px 27px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.065)','Dark Search shadow drifted'],
  [spatial,'--spatial-stat-shadow:0 17px 42px rgba(0,0,0,.21),inset 0 1px rgba(255,255,255,.06)','Dark Stat surface drifted'],
  [spatial,'--spatial-tool-shadow:0 20px 52px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.05)','Dark Tool surface drifted'],
  [controls,'--control-subtle:rgba(255,255,255,.018)','Dark control subtle surface drifted'],
  [controls,'box-shadow:inset 0 1px rgba(255,255,255,.025)}.ui-select__trigger:hover','Dark Select trigger shadow drifted'],
  [controls,'box-shadow:var(--shadow-lg),inset 0 1px rgba(255,255,255,.055);overflow:hidden','Dark Select menu shadow drifted'],
  [settingsCss,'--settings-section-surface:linear-gradient(180deg,rgba(20,36,62,.42),rgba(9,18,34,.28))','Dark Settings surface drifted'],
  [settingsCss,'box-shadow:inset 0 1px rgba(255,255,255,.025)}','Dark Settings inset drifted'],
  [transferCss,'--transfer-mode-label:#c8b9ff;--transfer-alt-label:#d3c8ff','Dark Transfer labels drifted'],
  [transferCss,'box-shadow:inset 0 1px rgba(255,255,255,.035)}','Dark Transfer capsule drifted'],
  [logsCss,'--logs-toolbar-shadow:var(--shadow-sm),inset 0 1px rgba(255,255,255,.05)','Dark Logs toolbar drifted'],
  [logsCss,'--logs-warning-surface:linear-gradient(90deg,rgba(255,189,90,.035),transparent 35%)','Dark Logs warning surface drifted'],
  [brandCss,'--brand-name-hover:#f5f8ff','Dark Brand hover drifted'],
  [layout,'--mobile-state-overlay:linear-gradient(180deg,rgba(8,16,29,.88),rgba(8,16,29,.74))','Dark Mobile state overlay drifted'],
  [ui,'--ui-dialog-backdrop:rgba(2,7,15,.62)','Dark Dialog backdrop drifted']
];
for(const [source,signature,message] of darkSignatures)assert(source.includes(signature),message);

for(const rule of ['THEME-OWNER','THEME-MODE','THEME-RESOLUTION','THEME-SYSTEM','THEME-TIME','THEME-SURFACE','THEME-DARK-STABILITY','THEME-MOTION','THEME-RETIRE'])assert(docs.includes(rule),`Documentation rule ${rule} missing`);
assert(pkg.scripts.test.includes('tests/theme-contract.mjs'),'Theme contract is missing from npm test');
assert(!/0\.3\.\d+/.test(read('tests/browser-theme.mjs')),'Browser Theme fixture hard-codes a product patch version');

console.log(`Theme contract passed for product ${version}: single owner, four modes, repo-wide caller audit, Smart Auto boundaries, Light tokens, Dark stability, Mobile and docs.`);
