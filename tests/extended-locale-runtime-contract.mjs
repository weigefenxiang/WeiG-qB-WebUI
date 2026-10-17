import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const source=fs.readFileSync(new URL('../webui/private/scripts/i18n.js',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../tools/build-webui-dist.mjs',import.meta.url),'utf8');
assert.ok(builder.includes('inspectExtendedLocaleSources({sourceDir:extendedLocaleDir})')&&builder.includes('weig-qb-webui-all-languages.zip'));
assert.ok(builder.includes('allLanguagesArtifact')&&builder.includes('extendedManifestPath'));
function setup(available){
  const reads=[];
  const W={RuntimeAssets:{readJson(path,options){reads.push(path);if(path.endsWith('extended-manifest.json'))return Promise.resolve({schemaVersion:1,source:'WeiG-extended-locale-inventory',locales:available});if(path.endsWith('/ca.json'))return Promise.resolve({schemaVersion:1,source:'WeiG-runtime-locale-overlay',locale:'ca',messages:{'settings.save':'Desa'}});if(path.endsWith('/pt.json'))return Promise.resolve({schemaVersion:1,source:'WeiG-runtime-locale-overlay',locale:'pt',messages:{'settings.save':'Guardar'}});throw new Error('Unexpected locale request '+path);}}};
  const document={documentElement:{lang:'en'},querySelectorAll(){return[];}};
  const window={WeiG:W,dispatchEvent(){},location:{reload(){}}};
  vm.runInNewContext(source,{window,document,CustomEvent:class{},Intl,Promise,Map,Set,setTimeout,console},{filename:'i18n.js'});
  return {I:W.I18n,reads};
}
const rich=setup(['ca']);
rich.I.applyLocale('ca',{reload:false});
await rich.I.loadWeiGLocale('ca');
for(let i=0;i<10;i++)await Promise.resolve();
assert.equal(rich.I.getLocale(),'ca');
assert.equal(rich.I.t('settings.save'),'Desa');
assert.equal(rich.reads.filter(x=>x.endsWith('extended-manifest.json')).length,1);
rich.I.applyLocale('pt_BR',{reload:false});
await rich.I.loadWeiGLocale('pt-BR');
for(let i=0;i<10;i++)await Promise.resolve();
assert.equal(rich.I.t('settings.save'),'Guardar','Standard build must retain existing Portuguese base fallback');
const basic=setup([]);
basic.I.applyLocale('ca',{reload:false});
await basic.I.loadWeiGLocale('ca');
assert.equal(basic.I.t('settings.save'),'Save','Unshipped locales fail closed to English');
assert.equal(basic.reads.filter(x=>x.endsWith('/ca.json')).length,0,'Standard archive must not probe missing external overlay');
console.log('Extended W.I18n runtime gate passed: optional packaged inventory, lazy current shard, variant fallback, standard-safe behavior.');

const official=JSON.parse(fs.readFileSync(new URL('../tools/data/qb-5.2.4-readme-languages.json',import.meta.url),'utf8')).languages;
assert.equal(official.length,61);
for(const record of official){
  const expected=['en','en_AU','en_GB'].includes(record.code)?'en':record.slug;
  assert.equal(rich.I.normalize(record.code),expected,
    'qB 5.2.4 official locale must reach its exact bundled/extended WeiG shard: '+record.code);
}
for(const [input,want] of [
  ['sr@latin','sr-Latn'],['sr_Latn','sr-Latn'],['pt_BR','pt-BR'],['pt_PT','pt'],
  ['zh_HK','zh-HK'],['zh_Hant_HK','zh-HK'],['zh_Hans','zh-CN'],
  ['en_GB','en'],['en_AU','en']]){
  assert.equal(rich.I.normalize(input),want,'Native qB locale alias mismatch: '+input);
}
console.log('Canonical 5.2.4 locale-to-WeiG shard routing passed: all 61 source locale IDs and script/region variants.');
