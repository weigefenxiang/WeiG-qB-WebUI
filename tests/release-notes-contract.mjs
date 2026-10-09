import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildReleaseNotes,readGitCommits,resolvePreviousStableTag,isReleaseVisiblePath,containsNonLatinLetter,normalizePresentation,generateFromGit,readReleaseCuration} from '../tools/release-notes.mjs';

const visible='webui/private/scripts/app.js';
const excluded='webui/VERSION';
assert.equal(isReleaseVisiblePath(visible),true);
for(const p of [excluded,'webui/GIT_SHA','webui/ARCHITECTURE.md','webui/private/product-identity.json','webui/private/data/capabilities.json','webui/private/images/flags/cn.svg','webui/translations/webui_zh_CN.qm','webui/public/assets/Wei.G.png','installers/install.sh'])assert.equal(isReleaseVisiblePath(p),false,p);

const commits=[
 {hash:'1111111',subject:'feat(ui): add compact mobile actions',body:'',paths:[visible]},
 {hash:'2222222',subject:'fix: repair peer flags',body:'',paths:['webui/private/images/flags/cn.svg']},
 {hash:'3333333',subject:'perf: recycle viewport rows',body:'',paths:['webui/private/scripts/core.js']},
 {hash:'4444444',subject:'compat: preserve old qB scheduler semantics',body:'',paths:['webui/private/scripts/settings.js']},
 {hash:'5555555',subject:'test: engineering subject should be replaced',body:'Release-Note: Feature: Add theme-consistent time picker',paths:['webui/private/scripts/time.js']},
 {hash:'6666666',subject:'test: internal regression coverage',body:'',paths:[visible]},
 {hash:'7777777',subject:'fix: version only',body:'',paths:[excluded]},
 {hash:'8888888',subject:'fix: duplicate visible text',body:'',paths:[visible]},
 {hash:'9999999',subject:'fix: duplicate visible text',body:'',paths:[visible]},
 {hash:'aaaaaaa',subject:'fix: explicitly hidden note',body:'Release-Note: skip',paths:[visible]},
 {hash:'bbbbbbb',subject:'feat: English fallback for localized note',body:'Release-Note: 功能/UI: 中文发布说明',paths:[visible]}
];
const built=buildReleaseNotes({commits,fromTag:'v1.0.0',toSha:'0123456789abcdef0123456789abcdef01234567',imageUrl:'https://example.invalid/demo.gif',presentation:'latest'});
assert.equal(built.items.length,6,'only user-visible WebUI runtime changes should survive filtering/dedupe');
assert.equal(built.highlights.length,6);
assert.equal(built.presentation,'latest');
const imageMarker='![WeiG qB WebUI preview](https://example.invalid/demo.gif)';
const imageIndex=built.markdown.indexOf(imageMarker);
const highlightIndex=built.markdown.indexOf('## Highlights');
const detailIndex=built.markdown.indexOf('<details>');
assert.equal(imageIndex,0,'Latest Release must put the preview GIF first');
assert.ok(highlightIndex>imageIndex&&detailIndex>highlightIndex,'Latest Release must render preview -> Highlights -> details');
const linkedHash='0123456789abcdef0123456789abcdef01234567';
const linkedNotes=buildReleaseNotes({commits:[{hash:linkedHash,subject:'fix: Correct qB version gating (#2)',body:'',paths:[visible]}],repository:'weigefenxiang/WeiG-qB-WebUI'});
assert.ok(linkedNotes.markdown.includes('[`0123456`](https://github.com/weigefenxiang/WeiG-qB-WebUI/commit/'+linkedHash+')'),'Commit link must use full SHA');
assert.ok(linkedNotes.markdown.includes('[#2](https://github.com/weigefenxiang/WeiG-qB-WebUI/issues/2)'),'Issue link must be reusable');
const reviewedCuration={
  highlights:['Selected compatibility fix (#2)','Selected paging improvement','Selected mobile improvements','Selected Settings changes','Selected RSS changes','Selected Logs changes'],
  details:[{category:'performance',text:'Reviewed runtime startup improvements'}]
};
const reviewed=buildReleaseNotes({commits,repository:'weigefenxiang/WeiG-qB-WebUI',curation:reviewedCuration,maxDetails:3});
assert.equal(reviewed.highlights.length,6);
assert.ok(reviewed.markdown.includes('- Selected compatibility fix ([#2](https://github.com/weigefenxiang/WeiG-qB-WebUI/issues/2))'));
assert.ok(reviewed.markdown.includes('### Performance\n\n- Reviewed runtime startup improvements'));
assert.equal(reviewed.details.length,3,'Curated detail rows count against the bounded 24-row budget');
const archived=buildReleaseNotes({commits,fromTag:'v1.0.0',toSha:'0123456789abcdef0123456789abcdef01234567',imageUrl:'https://example.invalid/demo.gif',presentation:'archive'});
assert.equal(archived.presentation,'archive');
assert.ok(archived.markdown.startsWith('## Highlights\n'),'Archived Release must start with Highlights');
assert.equal(archived.markdown.includes(imageMarker),false,'Archived Release must not contain the preview GIF');
assert.ok(archived.markdown.indexOf('<details>')>archived.markdown.indexOf('## Highlights'),'Archived Release must render Highlights -> details');
assert.equal(normalizePresentation('LATEST'),'latest');
assert.throws(()=>normalizePresentation('legacy'),/Unsupported Release presentation/);
assert.ok(built.markdown.includes('Add theme-consistent time picker'));
for(const sample of ['中文','日本語','한국어','Русский'])assert.equal(containsNonLatinLetter(sample),true,`non-Latin public text must be rejected: ${sample}`);
assert.equal(containsNonLatinLetter('English release notes 1.1.0'),false);
assert.equal(containsNonLatinLetter(built.markdown),false,'release notes must remain English/Latin-script only');
assert.ok(!built.markdown.includes('engineering subject should be replaced'));
assert.ok(!built.markdown.includes('internal regression coverage'));
assert.ok(!built.markdown.includes('version only'));
assert.ok(!built.markdown.includes('repair peer flags'));
assert.equal((built.markdown.match(/duplicate visible text/g)||[]).length,2,'one deduped item appears once in highlights and once in detail');
assert.ok(built.markdown.includes('English fallback for localized note'));
assert.ok(!built.markdown.includes('中文发布说明'));
for(const heading of ['### Features / UI','### Fixes','### Performance','### Compatibility'])assert.ok(built.markdown.includes(heading),`missing ${heading}`);

const activeVersion=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();
const currentReview=readReleaseCuration({cwd:fileURLToPath(new URL('..',import.meta.url)),version:activeVersion});
if(currentReview){
 assert.equal(currentReview.highlights.length>=5&&currentReview.highlights.length<=8,true,'Reviewed release needs 5 to 8 Highlights');
 const currentDraft=buildReleaseNotes({commits,repository:'weigefenxiang/WeiG-qB-WebUI',curation:currentReview,imageUrl:'https://example.invalid/demo.gif',presentation:'latest'});
 for(const text of currentReview.highlights)assert.ok(currentDraft.markdown.includes(text.includes('#2')?text.replace('#2','[#2](https://github.com/weigefenxiang/WeiG-qB-WebUI/issues/2)'):text),'Current reviewed Highlight must survive canonical renderer');
 assert.ok(currentDraft.markdown.includes('### Performance')&&currentDraft.markdown.includes('### Compatibility'),'Reviewed details must preserve category grouping');
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weig-release-notes-'));
try{
 const git=(...args)=>execFileSync('git',args,{cwd:temp,encoding:'utf8'}).trim();
 git('init','-q');git('config','user.email','release-notes@example.invalid');git('config','user.name','Release Notes Test');
 fs.mkdirSync(path.join(temp,'webui/private/scripts'),{recursive:true});fs.mkdirSync(path.join(temp,'assets/screenshots'),{recursive:true});
 fs.writeFileSync(path.join(temp,'VERSION'),'1.1.0\n');fs.writeFileSync(path.join(temp,'webui/private/scripts/app.js'),'base\n');
 git('add','.');git('commit','-q','-m','chore: baseline');git('tag','v1.0.0');
 fs.appendFileSync(path.join(temp,'webui/private/scripts/app.js'),'one\n');git('add','.');git('commit','-q','-m','feat: visible feature');
 fs.writeFileSync(path.join(temp,'webui/VERSION'),'1.1.0\n');git('add','.');git('commit','-q','-m','fix: identity only');
 const target=git('rev-parse','HEAD');git('tag','v1.1.0');
 fs.writeFileSync(path.join(temp,'assets/screenshots/weig-qb-webui-desktop-overview.gif'),'GIF89a');
 const mainImage='https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/assets/screenshots/weig-qb-webui-desktop-overview.gif';
 const latestPreview=generateFromGit({to:target,currentTag:'v1.1.0',cwd:temp,repository:'weigefenxiang/WeiG-qB-WebUI',presentation:'latest'});
 assert.ok(latestPreview.markdown.startsWith('![WeiG qB WebUI preview]('+mainImage+')'),'Latest must use main GIF regardless of version');
 const archivePreview=generateFromGit({to:target,currentTag:'v1.1.0',cwd:temp,repository:'weigefenxiang/WeiG-qB-WebUI',presentation:'archive'});
 assert.ok(!archivePreview.markdown.includes(mainImage),'Archived notes must omit GIF');
 assert.equal(resolvePreviousStableTag({to:target,currentTag:'v1.1.0',cwd:temp}),'v1.0.0');
 const history=readGitCommits({fromTag:'v1.0.0',to:target,cwd:temp});
 assert.equal(history.length,2);
 const visibleCommit=history.find(x=>x.subject.includes('visible feature'));
 const identityCommit=history.find(x=>x.subject.includes('identity only'));
 assert.ok(visibleCommit.paths.includes('webui/private/scripts/app.js'));
 assert.ok(identityCommit.paths.includes('webui/VERSION'));
 fs.mkdirSync(path.join(temp,'tools/data'),{recursive:true});
 fs.writeFileSync(path.join(temp,'tools/data/release-notes-curation.json'),JSON.stringify({schemaVersion:1,version:'1.1.0',highlights:reviewedCuration.highlights,details:reviewedCuration.details}));
 const input=readReleaseCuration({cwd:temp,version:'1.1.0'});
 assert.equal(input.highlights.length,6);
 assert.equal(readReleaseCuration({cwd:temp,version:'1.0.0'}),null,'Historical archive must not inherit a newer version curation');
 const selectedPreview=generateFromGit({to:target,currentTag:'v1.1.0',cwd:temp,repository:'weigefenxiang/WeiG-qB-WebUI',presentation:'latest'});
 assert.ok(selectedPreview.markdown.includes('Selected RSS changes'),'Exact release must consume reviewed highlights from the shared generator');
 assert.ok(!generateFromGit({to:target,currentTag:'v1.0.0',cwd:temp,repository:'weigefenxiang/WeiG-qB-WebUI',presentation:'archive'}).markdown.includes('Selected RSS changes'),'Previous release archive cannot inherit current curation');
 const filtered=buildReleaseNotes({commits:history});
 assert.equal(filtered.items.length,1,'identity-only webui commit must not enter release notes');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

console.log('Release notes contract passed: latest/archive presentation is canonical; only Latest gets a GIF, archived releases omit it, and user-visible change filtering remains deterministic.');
