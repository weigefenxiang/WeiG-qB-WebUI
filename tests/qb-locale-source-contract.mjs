import assert from 'node:assert/strict';
import {extractWebuiLocaleFacts,localeCodesFromPaths,parseExplicitLocaleOptions} from '../tools/qb-locale-source.mjs';
import {extractQbPreferenceUiFacts,extractQbSettingsTranslationFacts,indexQbSettingsTranslationFacts,parseQtTsTranslationSource,translationSourcesForPreferenceUi} from '../tools/qb-settings-translation-source.mjs';
import {applyQbSettingsTranslationOverlay,buildQbSettingsTranslationOverlay,resolveQbTranslationResourcePath} from '../tools/qb-settings-translation-overlay.mjs';

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

const legacyTranslationPaths=[
  'src/lang/qbittorrent_eo.ts',
  'src/lang/qbittorrent_de.ts',
  'src/lang/qbittorrent_ja.ts',
  'src/lang/qbittorrent_ko.ts',
  'src/lang/qbittorrent_zh.ts',
  'src/lang/qbittorrent_zh_HK.ts',
  'src/lang/qbittorrent_zh_TW.ts',
  'src/lang/qbittorrent_sr.ts',
  'src/lang/qbittorrent_uz@Latn.ts'
];
assert.equal(resolveQbTranslationResourcePath('eo_EO',legacyTranslationPaths),'src/lang/qbittorrent_eo.ts','historical region-bearing qB locale resolves to its exact-release official base-language TS resource');
assert.equal(resolveQbTranslationResourcePath('de_DE',legacyTranslationPaths),'src/lang/qbittorrent_de.ts');
assert.equal(resolveQbTranslationResourcePath('ja_JP',legacyTranslationPaths),'src/lang/qbittorrent_ja.ts');
assert.equal(resolveQbTranslationResourcePath('ko_KR',legacyTranslationPaths),'src/lang/qbittorrent_ko.ts');
assert.equal(resolveQbTranslationResourcePath('zh',legacyTranslationPaths),'src/lang/qbittorrent_zh.ts','an exact base locale must win over regional siblings');
assert.equal(resolveQbTranslationResourcePath('zh_TW',legacyTranslationPaths),'src/lang/qbittorrent_zh_TW.ts');
assert.equal(resolveQbTranslationResourcePath('uz@latin',legacyTranslationPaths),'src/lang/qbittorrent_uz@Latn.ts','Qt latin/Latn modifier spelling is the same script identity');
assert.equal(resolveQbTranslationResourcePath('sr@latin',legacyTranslationPaths),null,'script-bearing locale must never fall back to a different-script base resource');
assert.equal(resolveQbTranslationResourcePath('de_DE',['src/lang/qbittorrent_de.ts','src/webui/www/translations/webui_de.ts']),'src/webui/www/translations/webui_de.ts','WebUI-specific official TS wins when both exact-release resource families contain the locale');
assert.throws(()=>resolveQbTranslationResourcePath('eo_EO',['src/lang/qbittorrent_eo_EO.ts','src/lang/qbittorrent_eo-EO.ts']),/Ambiguous official qB translation source/,'ambiguous source identities fail closed instead of guessing');

const preferencesSource=`
<label for="savepath_text">QBT_TR(Default Save Path:)QBT_TR[CONTEXT=OptionsDialog]</label>
<input type="text" id="savepath_text">
<label for="locale_select">QBT_TR(Language:)QBT_TR[CONTEXT=OptionsDialog]</label>
<select id="locale_select"></select>
<script>
  document.getElementById("savepath_text").value = pref.save_path;
  document.getElementById("locale_select").value = pref.locale;
</script>`;
const uiFacts=extractQbPreferenceUiFacts(preferencesSource,['save_path','locale','unproven']);
assert.deepEqual(uiFacts.save_path,{controlId:'savepath_text',evidence:'modern-read',title:{source:'Default Save Path:',context:'OptionsDialog'}});
assert.deepEqual(uiFacts.locale,{controlId:'locale_select',evidence:'modern-read',title:{source:'Language:',context:'OptionsDialog'}});
assert.equal(uiFacts.unproven,undefined,'preference text without a source-proven qB control relation must not be invented');
assert.deepEqual(translationSourcesForPreferenceUi(uiFacts),['Default Save Path:','Language:']);

const qtTs=`<?xml version="1.0" encoding="utf-8"?>
<TS version="2.1" language="de">
<context>
  <name>OptionsDialog</name>
  <message><source>Options</source><translation>Optionen</translation></message>
  <message><source>Save</source><translation>Speichern &amp; schließen</translation></message>
  <message><source>Default Save Path:</source><translation>Standard-Speicherpfad:</translation></message>
  <message><source>Language:</source><translation>Sprache:</translation></message>
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
assert.equal(parsed.messages.find(item=>item.source==='Default Save Path:').translation,'Standard-Speicherpfad:');
assert.equal(parsed.messages.find(item=>item.source==='Language:').translation,'Sprache:');
assert.ok(!parsed.messages.some(item=>item.source==='Unfinished'||item.source==='Old'));
const facts=extractQbSettingsTranslationFacts({qbVersion:'5.2.3',sourceSha:'0b63c3d17373f6132ea211c9dcd4241284ccdfaf',locale:'de',translationSource:qtTs});
assert.equal(facts.source,'qb-upstream-webui-ts');
assert.equal(facts.qbVersion,'5.2.3');
assert.equal(facts.sourceSha,'0b63c3d17373f6132ea211c9dcd4241284ccdfaf');
const index=indexQbSettingsTranslationFacts(facts);
assert.equal(index.get('OptionsDialog\u0000Options\u0000'),'Optionen');
assert.throws(()=>extractQbSettingsTranslationFacts({qbVersion:'5.2.3',sourceSha:'abc',locale:'fr',translationSource:qtTs}),/locale mismatch/);

const enTs=`<TS version="2.1" language="en"><context><name>OptionsDialog</name><message><source>Default Save Path:</source><translation type="unfinished" /></message><message><source>Language:</source><translation type="unfinished" /></message></context></TS>`;
const enFacts=extractQbSettingsTranslationFacts({qbVersion:'5.2.3',sourceSha:'sha-new',locale:'en',translationSource:enTs,contexts:['OptionsDialog'],sources:['Default Save Path:','Language:']});
assert.deepEqual(enFacts.messages.map(item=>item.translation),['Default Save Path:','Language:'],'English official source text is the translation fallback');
const deOld=qtTs.replace('language="de"','language="de_DE"');
const catalog=[
  {qbVersion:'4.1.0',sourceSha:'sha-old',tag:'release-4.1.0',webuiLocales:[{value:'en'},{value:'de_DE'}],preferenceDescriptors:[{key:'save_path'},{key:'locale'}]},
  {qbVersion:'5.2.3',sourceSha:'sha-new',tag:'release-5.2.3',webuiLocales:[{value:'en'},{value:'de'}],preferenceDescriptors:[{key:'save_path'},{key:'locale'}]}
];
const sourceByLocale={en:enTs,de:qtTs,de_DE:deOld};
const overlay=buildQbSettingsTranslationOverlay(catalog,()=>({preferencesSource,translationSource:locale=>sourceByLocale[locale]}));
assert.equal(overlay.schemaVersion,1);
assert.equal(overlay.source,'qb-upstream-preferences-ui+webui-ts');
assert.equal(overlay.profiles.length,2);
assert.equal(overlay.profiles[0].mappedPreferences,2);
assert.equal(overlay.profiles[0].preferences.save_path.title.source,'Default Save Path:');
assert.equal(overlay.profiles[0].sourceSha,'sha-old');
assert.equal(overlay.profiles[1].sourceSha,'sha-new');
assert.equal(Object.keys(overlay.profiles[0].translations).length,2);
assert.equal(Object.keys(overlay.profiles[1].translations).length,2);
assert.equal(overlay.profiles[0].translations.en,overlay.profiles[1].translations.en,'identical official source translations are deduplicated without losing exact profile binding');
assert.equal(overlay.profiles[0].translations.de_DE,overlay.profiles[1].translations.de,'historical locale aliases may share identical source-derived payloads');
assert.equal(Object.keys(overlay.sets).length,2);
const enriched=applyQbSettingsTranslationOverlay(catalog,overlay);
assert.equal(enriched[0].settingsUiSource,'qb-upstream-preferences-ui');
assert.equal(enriched[0].settingsUiMappedPreferences,2);
assert.ok(enriched.some(item=>item.settingsTranslationSets&&Object.keys(item.settingsTranslationSets).length),'deduplicated translation sets must remain embedded in the canonical catalog');
assert.throws(()=>buildQbSettingsTranslationOverlay([{qbVersion:'5.2.3',sourceSha:'sha',tag:'release-5.2.3',webuiLocales:[{value:'fr'}],preferenceDescriptors:[{key:'save_path'}]}],()=>({preferencesSource,translationSource:()=>''})),/missing official WebUI translation source/);

console.log('qB locale source contract passed: exact-release locale sets and Settings labels are derived from qB preference controls plus official TS translations, hash-bound to source SHA.');
