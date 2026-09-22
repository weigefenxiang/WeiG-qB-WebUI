import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildReleaseNotes,readGitCommits,resolvePreviousStableTag} from '../tools/release-notes.mjs';

const commits=[
  {hash:'1111111',subject:'feat(ui): add compact mobile actions',body:''},
  {hash:'2222222',subject:'fix: repair peer flags',body:''},
  {hash:'3333333',subject:'perf: recycle viewport rows',body:''},
  {hash:'4444444',subject:'compat: preserve old qB scheduler semantics',body:''},
  {hash:'5555555',subject:'test: engineering subject should be replaced',body:'Release-Note: 功能/UI: 新增主题一致的时间选择器'},
  {hash:'6666666',subject:'fix: another user fix',body:''},
  {hash:'7777777',subject:'feat: another feature',body:''},
  {hash:'8888888',subject:'perf: another performance change',body:''},
  {hash:'9999999',subject:'compat: another compatibility change',body:''},
  {hash:'aaaaaaa',subject:'fix: ninth user-facing entry',body:''},
  {hash:'bbbbbbb',subject:'test: internal regression coverage',body:''},
  {hash:'ccccccc',subject:'ci: update workflow',body:''},
  {hash:'ddddddd',subject:'docs: refresh docs',body:''},
  {hash:'eeeeeee',subject:'chore: cleanup',body:''},
  {hash:'fffffff',subject:'refactor: owner cleanup',body:''},
  {hash:'abababa',subject:'fix: explicitly hidden note',body:'Release-Note: skip'}
];
const built=buildReleaseNotes({commits,fromTag:'v1.0.0',toSha:'0123456789abcdef0123456789abcdef01234567'});
assert.equal(built.highlights.length,8,'release overview must stay capped at eight user-facing changes');
assert.equal(built.items.length,15,'explicit Release-Note: skip must remove one synthetic commit');
assert.ok(built.markdown.includes('新增主题一致的时间选择器'),'structured Release-Note metadata must replace an engineering commit subject');
assert.ok(!built.markdown.includes('engineering subject should be replaced'),'structured metadata must fully override the engineering subject');
assert.ok(!built.markdown.split('<details>')[0].includes('internal regression coverage'),'test/ci/docs/chore/refactor must stay out of the overview by default');
for(const heading of ['### 功能 / UI','### 修复','### 性能','### 兼容','### 内部工程'])assert.ok(built.markdown.includes(heading),`missing release-note category ${heading}`);
assert.ok(built.markdown.includes('<summary>查看完整更新记录（15 项）</summary>'),'full update history must expose a stable folded item count');
assert.ok(built.markdown.includes('_范围：v1.0.0 → 0123456789abcdef0123456789abcdef01234567_'),'release notes must state the source range');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weig-release-notes-'));
try{
  const git=(...args)=>execFileSync('git',args,{cwd:temp,encoding:'utf8'}).trim();
  git('init','-q');git('config','user.email','release-notes@example.invalid');git('config','user.name','Release Notes Test');
  fs.writeFileSync(path.join(temp,'file.txt'),'base\n');git('add','file.txt');git('commit','-q','-m','chore: baseline');git('tag','v1.0.0');
  fs.appendFileSync(path.join(temp,'file.txt'),'one\n');git('add','file.txt');git('commit','-q','-m','feat: visible feature');
  fs.appendFileSync(path.join(temp,'file.txt'),'two\n');git('add','file.txt');git('commit','-q','-m','test: internal proof','-m','Release-Note: 修复: 修复用户可见问题');
  const target=git('rev-parse','HEAD');git('tag','v1.1.0');
  assert.equal(resolvePreviousStableTag({to:target,currentTag:'v1.1.0',cwd:temp}),'v1.0.0','generator must select the previous stable semver tag, not the current release tag');
  const history=readGitCommits({fromTag:'v1.0.0',to:target,cwd:temp});
  assert.equal(history.length,2,'git history range must be previous stable tag exclusive to exact target inclusive');
  assert.ok(history.some(item=>item.body.includes('Release-Note: 修复: 修复用户可见问题')),'git parser must preserve structured Release-Note body metadata');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

const releaseDocs=fs.readFileSync(new URL('../docs/RELEASE.md',import.meta.url),'utf8');
assert.ok(releaseDocs.includes('Release-Note: Fix: Correct a user-visible issue'),'public release docs must document structured metadata with an English-only example');

const workflow=fs.readFileSync(new URL('../.github/workflows/release.yml',import.meta.url),'utf8');
assert.ok(workflow.includes('fetch-depth: 0'),'Release checkout must fetch tag history for deterministic range resolution');
assert.ok(workflow.includes('node tools/release-notes.mjs'),'Release workflow must consume the unique release-note generator');
assert.ok(workflow.includes('--to "$RELEASE_SHA"')&&workflow.includes('--current-tag "$GITHUB_REF_NAME"'),'Release workflow must bind note generation to the exact release SHA and current tag identity.');
assert.ok(workflow.includes('--notes-file release-notes.md'),'Release publication must consume the generated notes file');
assert.ok(!workflow.includes('--generate-notes'),'GitHub generated notes must be retired as a second owner');
assert.ok(!/\s--notes\s/.test(workflow),'static inline release notes must be retired as a second owner');

console.log('Release notes contract passed: previous-stable exact-SHA range, structured overrides, capped user highlights, folded categorized history and single workflow owner are deterministic.');
