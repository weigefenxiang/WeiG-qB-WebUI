import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildReleaseNotes,readGitCommits,resolvePreviousStableTag,isReleaseVisiblePath} from '../tools/release-notes.mjs';

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
const built=buildReleaseNotes({commits,fromTag:'v1.0.0',toSha:'0123456789abcdef0123456789abcdef01234567',imageUrl:'https://example.invalid/demo.gif'});
assert.equal(built.items.length,6,'only user-visible WebUI runtime changes should survive filtering/dedupe');
assert.equal(built.highlights.length,6);
assert.ok(built.markdown.startsWith('![WeiG qB WebUI preview](https://example.invalid/demo.gif)'));
assert.ok(built.markdown.includes('Add theme-consistent time picker'));
assert.equal(/\p{Script=Han}/u.test(built.markdown),false,'release notes must remain English-only');
assert.ok(!built.markdown.includes('engineering subject should be replaced'));
assert.ok(!built.markdown.includes('internal regression coverage'));
assert.ok(!built.markdown.includes('version only'));
assert.ok(!built.markdown.includes('repair peer flags'));
assert.equal((built.markdown.match(/duplicate visible text/g)||[]).length,2,'one deduped item appears once in highlights and once in detail');
assert.ok(built.markdown.includes('English fallback for localized note'));
assert.ok(!built.markdown.includes('中文发布说明'));
for(const heading of ['### Features / UI','### Fixes','### Performance','### Compatibility'])assert.ok(built.markdown.includes(heading),`missing ${heading}`);

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
 assert.equal(resolvePreviousStableTag({to:target,currentTag:'v1.1.0',cwd:temp}),'v1.0.0');
 const history=readGitCommits({fromTag:'v1.0.0',to:target,cwd:temp});
 assert.equal(history.length,2);
 const visibleCommit=history.find(x=>x.subject.includes('visible feature'));
 const identityCommit=history.find(x=>x.subject.includes('identity only'));
 assert.ok(visibleCommit.paths.includes('webui/private/scripts/app.js'));
 assert.ok(identityCommit.paths.includes('webui/VERSION'));
 const filtered=buildReleaseNotes({commits:history});
 assert.equal(filtered.items.length,1,'identity-only webui commit must not enter release notes');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

console.log('Release notes contract passed: only user-visible WebUI runtime paths are eligible; identity/generated/assets are excluded; internal noise is hidden; duplicates are bounded; image insertion is deterministic.');
