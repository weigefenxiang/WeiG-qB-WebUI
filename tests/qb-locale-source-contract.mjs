import assert from 'node:assert/strict';
import {extractWebuiLocaleFacts,localeCodesFromPaths,parseExplicitLocaleOptions} from '../tools/qb-locale-source.mjs';
import {extractQbSettingsTranslationFacts,indexQbSettingsTranslationFacts,parseQtTsTranslationSource} from '../tools/qb-settings-translation-source.mjs';

const oldHtml=`
<select id="locale_select">
  <option value="en">English</option>
  <option value="zh_TW">正體中文</option>
  <option value="ja_JP">日本語</option>
</select>`;
assert.deepEqual(parseExplicitLocaleOptions(oldHtml),[
  {value:'en',label:'English'},
  {value:'zh_TW',label:'正體中文'},
  {value:'ja_JP',label:'日本語'}
]);
assert.deepEqual(extractWebuiLocaleFacts({preferencesSource:oldHtml,paths:[]}),{
  webuiLocales:[
    {value:'en',label:'English'},
    {value:'zh_TW',label:'正體中文'},
    {value:'ja_JP',label:'日本語'}
  ],
  webuiLocaleSource:'preferences-html'
});

const placeholder='<select id="locale_select">${LANGUAGE_OPTIONS}</select>';
assert.deepEqual(parseExplicitLocaleOptions(placeholder),[],'runtime placeholder is not an explicit historical locale table');
const paths=[
  'src/webui/www/translations/webui_zh_CN.ts',
  'src/webui/www/translations/webui_en.ts',
  'src/webui/www/translations/webui_ja.ts',
  'src/webui/www/translations/README.md',
  'src/lang/qbittorrent_ko.ts'
];
assert.deepEqual(localeCodesFromPaths(paths),['en','ja','zh_CN']);
assert.deepEqual(extractWebuiLocaleFacts({preferencesSource:placeholder,paths}),{
  webuiLocales:[{value:'en',label:null},{value:'ja',label:null},{value:'zh_CN',label:null}],
  webuiLocaleSource:'translation-resources'
});
assert.deepEqual(extractWebuiLocaleFacts({preferencesSource:'',paths:[]}),{webuiLocales:[],webuiLocaleSource:'unresolved'});

const qtTs=`<?xml version="1.0" encoding="utf-8"?>
<TS version="2.1" language="de">
<context>
  <name>OptionsDialog</name>
  <message><source>Options</source><translation>Optionen</translation></message>
  <message><source>Save</source><translation>Speichern &amp; schließen</translation></message>
  <message><source>Unfinished</source><translation type="unfinished"></translation></message>
  <message><source>Old</source><translation type="vanished">Alt</translation></message>
  <message numerus="yes"><source>%n minute(s)</source><translation><numerusform>%n Minute</numerusform><numerusform>%n Minuten</numerusform></translation></message>
</context>
<context>
  <name>AboutDlg</name>
  <message><source>About</source><translation>Über</translation></message>
</context>
</TS>`;
const parsed=parseQtTsTranslationSource(qtTs,{contexts:['OptionsDialog']});
assert.equal(parsed.language,'de');
assert.deepEqual(parsed.messages,[
  {context:'OptionsDialog',source:'Options',comment:null,translation:'Optionen',numerus:false},
  {context:'OptionsDialog',source:'Save',comment:null,translation:'Speichern & schließen',numerus:false},
  {context:'OptionsDialog',source:'%n minute(s)',comment:null,translation:['%n Minute','%n Minuten'],numerus:true}
]);
const facts=extractQbSettingsTranslationFacts({qbVersion:'5.2.3',sourceSha:'0b63c3d17373f6132ea211c9dcd4241284ccdfaf',locale:'de',translationSource:qtTs});
assert.equal(facts.source,'qb-upstream-webui-ts');
assert.equal(facts.qbVersion,'5.2.3');
assert.equal(facts.sourceSha,'0b63c3d17373f6132ea211c9dcd4241284ccdfaf');
assert.equal(facts.messages.length,3);
const index=indexQbSettingsTranslationFacts(facts);
assert.equal(index.get('OptionsDialog\u0000Options\u0000'),'Optionen');
assert.throws(()=>extractQbSettingsTranslationFacts({qbVersion:'5.2.3',sourceSha:'abc',locale:'fr',translationSource:qtTs}),/locale mismatch/);

console.log('qB locale source contract passed: exact-release locale sets and Settings translations remain upstream-derived facts.');
