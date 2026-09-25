import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
function gitFiles(scope){
  const result=spawnSync('git',['ls-files','-z',scope],{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw new Error(`git ls-files ${scope} failed: ${String(result.stderr||'').trim()}`);
  return String(result.stdout||'').split('\0').filter(Boolean);
}
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function run(file){
  const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
  if(result.status!==0)throw new Error(`${file} failed:\n${result.stdout||''}\n${result.stderr||''}`);
  return String(result.stdout||'').trim().split(/\r?\n/).filter(Boolean).at(-1)||'PASS';
}

const toolFiles=gitFiles('tools').filter(file=>/\.(?:mjs|js)$/.test(file));
const webuiFiles=gitFiles('webui').filter(file=>/\.(?:mjs|js|html)$/.test(file));
const decoderHits=[],qbtParserEscapes=[],specialVersionHits=[],rawDialogCreators=[],directShowModal=[],rawSelectCreators=[];
const entityDecode=/\.replace\([^\n]*\/&(?:amp|lt|gt|quot|apos|#(?:x[0-9a-f]+|\d+));/i;
const directQbtParser=/(?:match|matchAll)\(\/QBT_TR\\\(/;
for(const file of toolFiles){
  const source=read(file);
  if(file!=='tools/qb-source-text.mjs'&&entityDecode.test(source))decoderHits.push(file);
  if(file!=='tools/qb-source-text.mjs'&&directQbtParser.test(source)&&!source.includes("qb-source-text.mjs"))qbtParserEscapes.push(file);
}
const specialStable=/\b(?:4\.1\.9\.1|4\.3\.0\.1|4\.3\.4\.1|4\.4\.3\.1)\b/g;
for(const file of webuiFiles){
  const source=read(file),hits=source.match(specialStable);
  if(hits?.length)specialVersionHits.push({file,versions:[...new Set(hits)]});
  if(file.startsWith('webui/private/scripts/')){
    if(file!=='webui/private/scripts/dialog-runtime.js'&&/document\.createElement\(['"]dialog['"]\)/.test(source))rawDialogCreators.push(file);
    if(file!=='webui/private/scripts/dialog-runtime.js'&&/\.showModal\(\)/.test(source))directShowModal.push(file);
    if(file!=='webui/private/scripts/floating.js'&&/document\.createElement\(['"]select['"]\)/.test(source))rawSelectCreators.push(file);
  }
}
assert.deepEqual(decoderHits,[],'Ownership integrity scan found a second raw entity decoder outside tools/qb-source-text.mjs: '+decoderHits.join(', '));
assert.deepEqual(qbtParserEscapes,[],'Ownership integrity scan found a QBT_TR parser bypassing shared qB source-text ownership: '+qbtParserEscapes.join(', '));
assert.deepEqual(specialVersionHits,[],'Ownership integrity scan found product special-version literals; per-domain source relation must stay data-driven: '+JSON.stringify(specialVersionHits));
const dialogRuntime=read('webui/private/scripts/dialog-runtime.js');
assert.match(dialogRuntime,/addEventListener\('click',[\s\S]*event\.target!==dialog[\s\S]*backdropClose===false[\s\S]*!mobile\(\)[\s\S]*close\(dialog,'backdrop'\)/,'DialogRuntime mobile backdropClose must keep one canonical single-click owner');
assert.match(dialogRuntime,/addEventListener\('dblclick',[\s\S]*event\.target!==dialog[\s\S]*backdropClose===false[\s\S]*mobile\(\)[\s\S]*event\.button!==0[\s\S]*close\(dialog,'backdrop'\)/,'DialogRuntime desktop backdropClose must keep one canonical left-double-click owner');
assert.deepEqual(rawDialogCreators,[],'PRIMITIVE-GATE found feature-local Dialog construction outside DialogRuntime: '+rawDialogCreators.join(', '));
assert.deepEqual(directShowModal,[],'PRIMITIVE-GATE found feature-local showModal lifecycle outside DialogRuntime: '+directShowModal.join(', '));
assert.deepEqual(rawSelectCreators,[],'PRIMITIVE-GATE found feature-local native Select construction outside the canonical Select owner: '+rawSelectCreators.join(', '));

const focused=[
  'tests/release-profile-contract.mjs',
  'tests/session-contract.mjs',
  'tests/qb-locale-source-contract.mjs',
  'tests/locale-bootstrap-failure-contract.mjs',
  'tests/qb-preferences-composite-contract.mjs',
  'tests/qb-qbt-owned-string-inventory-contract.mjs',
  'tests/qb-qm-provisioning-source-contract.mjs',
  'tests/qbt-tr-emulator-contract.mjs'
];
const focusedResults=Object.fromEntries(focused.map(file=>[file,run(file)]));
const report={
  schemaVersion:1,
  source:'ownership-integrity-exact-tree-contract',
  scanned:{toolFiles:toolFiles.length,webuiFiles:webuiFiles.length,rawDialogCreators:rawDialogCreators.length,directShowModal:directShowModal.length,rawSelectCreators:rawSelectCreators.length},
  versionRelation:{specialVersionProductHits:specialVersionHits.length,focused:'release-profile-contract'},
  session:{versionAliasProductHits:specialVersionHits.length,focused:'session-contract'},
  locale:{focused:['qb-locale-source-contract','locale-bootstrap-failure-contract']},
  compound:{focused:'qb-preferences-composite-contract'},
  copy:{rawDecoderHits:decoderHits.length,qbtParserEscapes:qbtParserEscapes.length,focused:['qb-qbt-owned-string-inventory-contract','qb-qm-provisioning-source-contract','qbt-tr-emulator-contract']},
  focusedContracts:focusedResults
};
const output=process.env.WEIGG_OWNERSHIP_INTEGRITY_OUTPUT;
if(output)fs.writeFileSync(path.resolve(output),JSON.stringify(report,null,2)+'\n','utf8');
console.log('Ownership integrity contract passed: '+JSON.stringify(report));
