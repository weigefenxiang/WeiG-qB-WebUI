import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const docsDir=path.join(root,'docs');
const files=fs.readdirSync(docsDir).filter(name=>name.endsWith('.md')).sort();

const required=[
  '001.项目总方案.md',
  '002.兼容与实现状态.md',
  '003.项目架构.md',
  '004.UI与缓存契约.md',
  '005.统一交互与设置系统.md',
  '006.发布与晋级流程.md',
  '007.安装升级与手动部署.md',
  '008.Torrent工作区与状态所有权.md',
  '009.Virtual-qB-Lab.md',
  '010.真实qB产品兼容路线.md',
  '011.全版本真实qB验证规则.md',
  '014.AI协作与分支纪律.md',
  '015.开发硬规则（长期版）.md'
];
for(const name of required)assert.ok(files.includes(name),`missing canonical docs authority: ${name}`);
assert.ok(fs.existsSync(path.join(root,'DESIGN.md')),'DESIGN.md must remain the Current Owner / design authority');

const retired=[
  '008.Windows开发版安装.md',
  '012.qB原生翻译与国际化复盘.md',
  '013.Windows配置编码事故复盘.md',
  '016.0.3.74源事实扩展复盘与AI交接.md',
  '017.0.3.75写能力与源事实收口复盘.md',
  '018.0.3.76-0.3.77产品收口复盘与下一AI交接.md',
  '019.0.3.78产品与源事实收口复盘及下一AI交接.md',
  '020.0.3.79-0.3.82源事实与TorrentDetail浏览器收口复盘.md',
  '021.0.3.82安装器备份收口与下一AI交接.md'
];
for(const name of retired)assert.equal(files.includes(name),false,`retired duplicate/version-history doc must not return: ${name}`);

const versionHistory=files.filter(name=>/0\.\d+\.\d+.*(?:复盘|交接)/i.test(name));
assert.deepEqual(versionHistory,[],'docs must not accumulate new per-VERSION retrospective/handoff files; Git history owns completed version history');

const read=name=>fs.readFileSync(path.join(docsDir,name),'utf8');
const handoff=read('014.AI协作与分支纪律.md');
assert.match(handoff,/single current handoff authority/i,'014 must remain the single current handoff authority');
assert.ok(handoff.includes('一键复制给下一位 AI'),'014 must keep one copyable next-AI handoff block');
assert.ok(handoff.includes('## 4. 当前未完成事项判定'),'014 must preserve one explicit current-scope/TODO authority section without hard-coding an obsolete plan name');
assert.match(handoff,/完成[^\n。]*阅读[^\n。]*fresh-read[^\n。]*后/,'copyable handoff must require docs reading + fresh repository truth before development without pinning one obsolete sentence');
assert.ok(handoff.includes('SKIPPED != PASS'),'014 must keep skipped evidence distinct from exact-head PASS');
assert.match(handoff,/ordinary CI[\s\S]*Pages materialization\/build\/deploy\/live/,'014 current-scope state must remain bound to ordinary CI plus exact-SHA Pages materialization/build/deploy/live evidence');

const project=read('001.项目总方案.md');
const current=read('002.兼容与实现状态.md');
assert.ok(project.includes('Git history 是版本历史档案'),'001 must keep completed version history out of current authority docs');
assert.ok(current.includes('当前未完成事项只维护在 `docs/014.AI协作与分支纪律.md`'),'002 must route mutable handoff/TODO state to the single handoff owner');

console.log(`Docs authority contract passed: ${required.length} canonical docs + DESIGN remain, ${retired.length} retired duplicate/version-history docs stay removed, per-VERSION retrospective/handoff files are blocked, and docs/014 is the single copyable exact-head-evidence-bound current handoff owner.`);
