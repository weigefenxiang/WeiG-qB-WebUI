import assert from 'node:assert/strict';
import {extractWebuiLocaleFacts,localeCodesFromPaths,parseExplicitLocaleOptions} from '../tools/qb-locale-source.mjs';
import {extractQbSettingsTranslationFacts,indexQbSettingsTranslationFacts,parseQtTsTranslationSource} from '../tools/qb-settings-translation-source.mjs';
import {buildQbSettingsTranslationOverlay} from '../tools/qb-settings-translation-overlay.mjs';

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

const enTs=`<TS version="2.1" language="en"><context><name>OptionsDialog</name><message><source>Options</source><translation type="unfinished" /></message><message><source>Save</source><translation type="unfinished" /></message></context></TS>`;
const enFacts=extractQbSettingsTranslationFacts({qbVersion:'5.2.3',sourceSha:'sha-new',locale:'en',translationSource:enTs});
assert.deepEqual(enFacts.messages.map(item=>item.translation),['Options','Save'],'English official source text is the translation fallback');
const deOld=qtTs.replace('language="de"','language="de"');
const catalog=[
  {qbVersion:'4.1.0',sourceSha:'sha-old',tag:'release-4.1.0',webuiLocales:[{value:'en'},{value:'de_DE'}]},
  {qbVersion:'5.2.3',sourceSha:'sha-new',tag:'release-5.2.3',webuiLocales:[{value:'en'},{value:'de'}]}
];
const sourceByLocale={en:enTs,de:qtTs,de_DE:deOld};
const overlay=buildQbSettingsTranslationOverlay(catalog,({locale})=>sourceByLocale[locale]);
assert.equal(overlay.schema,1);
assert.equal(overlay.source,'qb-upstream-webui-ts');
assert.equal(overlay.profiles.length,2);
assert.equal(overlay.profiles[0].qbVersion,'4.1.0');
assert.equal(overlay.profiles[0].sourceSha,'sha-old');
assert.equal(overlay.profiles[1].sourceSha,'sha-new');
assert.equal(Object.keys(overlay.profiles[0].translations).length,2);
assert.equal(Object.keys(overlay.profiles[1].translations).length,2);
assert.equal(overlay.profiles[0].translations.en,overlay.profiles[1].translations.en,'identical official source translations are deduplicated without losing exact profile binding');
assert.equal(overlay.profiles[0].translations.de_DE,overlay.profiles[1].translations.de,'historical locale aliases may share identical source-derived payloads');
assert.equal(Object.keys(overlay.sets).length,2);
assert.throws(()=>buildQbSettingsTranslationOverlay([{qbVersion:'5.2.3',sourceSha:'sha',tag:'release-5.2.3',webuiLocales:[{value:'fr'}]}],()=>''),/missing official WebUI translation source/);

console.log('qB locale source contract passed: exact-release locale sets and Settings translations remain upstream-derived, hash-bound facts.');
