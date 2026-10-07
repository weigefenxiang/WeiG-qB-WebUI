import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const readmes=['README.md',...fs.readdirSync(path.join(root,'translations')).filter(n=>/^README\..+\.md$/.test(n)).map(n=>'translations/'+n),'installers/README.md'];
const guides=fs.readdirSync(path.join(root,'translations/installation-guide')).filter(n=>/^deployment-guide\..+\.md$/.test(n)).map(n=>'translations/installation-guide/'+n);
assert.equal(guides.length,10,'deployment guide family must stay complete');

const forbidden=[
  [/weig_qb-webui/i,'underscore machine slug'],
  [/WeiG_qB-WebUI/,'historical mixed-case underscore path'],
  [/WeiG-qB-WebUI\.zip/,'historical archive filename'],
  [/weig_qb-webui_install\.(?:sh|ps1)/i,'historical downloaded installer filename'],
  [/weig-install\.(?:sh|ps1)/i,'historical Release installer filename']
];
for(const rel of [...readmes,...guides]){
  const source=read(rel);
  for(const [re,label] of forbidden)assert.doesNotMatch(source,re,rel+': public current docs must not expose '+label);
}
for(const rel of guides){
  const source=read(rel);
  for(const token of ['install.sh','install.ps1','weig-qb-webui','weig-qb-webui.zip']){
    assert.ok(source.includes(token),rel+': missing canonical deployment token '+token);
  }
  assert.ok(source.includes('.config/weig-qb-webui'),rel+': installer state examples must use canonical Linux state root');
  assert.doesNotMatch(source,/releases\/latest\/download\/weig-qb-webui\.zip/,rel+': do not hard-code a canonical asset URL against a historical Latest Release that may still expose legacy asset names');

  const rows=source.split(/\r?\n/);
  let inFence=false;
  let fenceLanguage='';
  for(let i=0;i<rows.length;i++){
    const trimmed=rows[i].trim();
    if(trimmed.startsWith('```')){
      if(!inFence){inFence=true;fenceLanguage=trimmed.slice(3).trim().toLowerCase();}
      else {inFence=false;fenceLanguage='';}
      continue;
    }
    if(inFence&&['sh','bash','shell','powershell'].includes(fenceLanguage)&&rows[i].includes('`weig-qb-webui`')){
      assert.match(rows[i],/^\s*#/,rel+':'+(i+1)+': explanatory canonical-folder prose inside executable fences must be a comment');
    }
  }
}
console.log('Deployment naming contract passed for '+readmes.length+' README-family docs and '+guides.length+' localized deployment guides, including executable-fence copy safety.');
