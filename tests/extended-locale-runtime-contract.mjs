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

// A78-337: exercise all current external source overlays through the real
// W.I18n runtime in isolation. This is a 48 × 693 translation-resolution
// technical gate, NOT linguistic accuracy, browser, RTL or owner-bound QA.
const allDraftLocaleDir=new URL('../language-packs/weig-i18n/',import.meta.url);
const extendedNames=fs.readdirSync(allDraftLocaleDir).filter(file=>file.endsWith('.json')).sort();
assert.equal(extendedNames.length,48,'48 external overlays must be available to the QA-only harness');
const messagesByLocale=new Map(extendedNames.map(filename=>{
  const data=JSON.parse(fs.readFileSync(new URL(filename,allDraftLocaleDir),'utf8'));
  assert.equal(data.locale,filename.slice(0,-5));
  assert.ok(['draft','approved'].includes(data.translationStatus));
  return[data.locale,data.messages];
}));
const canonical=JSON.parse(/var EN=(\{[^\n]+\});/.exec(source)[1]);
assert.equal(Object.keys(canonical).length,693,'Canonical quality inventory drifted');
const readPaths=[];
const fullAssets={RuntimeAssets:{readJson(file,options){
  readPaths.push(file);
  if(file==='data/weig-i18n/extended-manifest.json'){
    assert.equal(options.identity,'extended-manifest');
    return Promise.resolve({schemaVersion:1,source:'WeiG-extended-locale-inventory',locales:[...messagesByLocale.keys()]});
  }
  const match=/^data\/weig-i18n\/([A-Za-z0-9-]+)\.json$/.exec(file);
  assert.ok(match,'Unexpected WeiG locale runtime asset '+file);
  assert.equal(options.identity,match[1],'Locale asset identity must match exact selected locale');
  assert.ok(messagesByLocale.has(match[1]),'Missing source locale '+match[1]);
  return Promise.resolve({schemaVersion:1,source:'WeiG-runtime-locale-overlay',
    locale:match[1],messages:messagesByLocale.get(match[1])});
}}};
const fullDocument={documentElement:{lang:'en'},querySelectorAll(){return[];}};
const fullWindow={WeiG:fullAssets,dispatchEvent(){},location:{reload(){throw new Error('Reload during no-reload QA');}}};
vm.runInNewContext(source,{window:fullWindow,document:fullDocument,
  CustomEvent:class{},Intl,Promise,Map,Set,setTimeout,console},{filename:'i18n.js'});
const I48=fullAssets.I18n;
let checks=0;
for(const [locale,overlay] of messagesByLocale){
  assert.equal(I48.applyLocale(locale,{reload:false}),locale);
  await I48.loadWeiGLocale(locale);
  for(let i=0;i<6;i++)await Promise.resolve();
  assert.equal(I48.getLocale(),locale,'Current WeiG locale drifted: '+locale);
  assert.equal(fullDocument.documentElement.lang,locale,'Document language was not painted: '+locale);
  assert.equal(fullDocument.documentElement.dir,['ar','fa','he'].includes(locale)?'rtl':'ltr',
    'Document writing direction mismatch for extended locale '+locale);
  for(const [key,englishValue] of Object.entries(canonical)){
    const expected=Object.hasOwn(overlay,key)?overlay[key]:englishValue;
    assert.equal(I48.t(key),expected,'WeiG runtime translation or English fallback drift: '+locale+'/'+key);
    checks++;
  }
}
I48.applyLocale('en',{reload:false});
assert.equal(fullDocument.documentElement.dir,'ltr','Returning from RTL to English must restore LTR');
assert.equal(checks,48*693,'All external canonical slots must be exercised');
assert.equal(readPaths.filter(value=>value==='data/weig-i18n/extended-manifest.json').length,1,
  '48-locale runtime must coalesce extended inventory load');
assert.equal(readPaths.filter(value=>/data\/weig-i18n\/[^/]+\.json$/.test(value)&&
  !value.endsWith('/extended-manifest.json')).length,48,
  'Each external locale must be fetched once, excluding the separate inventory manifest');
console.log('WeiG extended runtime 48 × 693 PASS: '+checks+
  ' source-matched translation/fallback resolutions, 48 document language transitions; semantic/native/Chrome/RTL QA pending.');
