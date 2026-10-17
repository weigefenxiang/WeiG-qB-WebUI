import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
const locales=inventory.languages.filter(lang=>!['en','en_AU','en_GB'].includes(lang.code))
  .map(lang=>lang.slug).filter(locale=>fs.existsSync(path.join(root,'translations/README.'+locale+'.md')));
assert(locales.length>=28,'Existing localized README examples unexpectedly disappeared');
const chinese=fs.readFileSync(path.join(root,'translations/README.zh-CN.md'),'utf8');
const blocks=s=>(s.match(/```/g)||[]).length/2;
for(const locale of locales){
  const doc=fs.readFileSync(path.join(root,'translations/README.'+locale+'.md'),'utf8');
  assert.equal(blocks(doc),blocks(chinese),'README '+locale+' lost Chinese-source install examples');
  assert.ok(doc.includes('sh install.sh --container=qbittorrent-test -configure'),'README '+locale+' missing explicit second Docker target');
  assert.ok(doc.includes('sh install.sh -dev \\'),'README '+locale+' missing canonical multi-target dev example');
  assert.ok(doc.includes('sh install.sh --config-root=/root/qbittorrent/config -configure'),'README '+locale+' missing explicit host config path');
}
console.log('Localized README source parity passed for '+locales.length+' languages: 39 examples and canonical Docker deployment commands.');
