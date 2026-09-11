import assert from 'node:assert/strict';
import {buildNativeSettingsBundle,renderNativeSettingsRegistry,renderLocaleTs} from '../tools/qb-settings-native-bundle.mjs';

const shaA='1111111111111111111111111111111111111111';
const shaB='2222222222222222222222222222222222222222';
const shaC='3333333333333333333333333333333333333333';
const shaD='4444444444444444444444444444444444444444';
const title={context:'OptionsDialog',source:'Language:'};
const ui={locale:{controlId:'locale_select',title}};
const setEn={messages:[{...title,translation:'Language:',numerus:false}]};
const setZhOld={messages:[{...title,translation:'语言：',numerus:false}]};
const setZhNew={messages:[{...title,translation:'界面语言：',numerus:false}]};
const sets={en:setEn,old:setZhOld,new:setZhNew};
const base=(qbVersion,sourceSha,zhHash)=>({qbVersion,sourceSha,webuiLocales:[{value:'en'},{value:'zh_CN'}],settingsUi:ui,settingsTranslations:{en:'en',zh_CN:zhHash},settingsTranslationSets:{}});
const catalog=[base('4.1.3',shaA,'old'),base('4.1.4',shaB,'old'),base('4.5.0',shaC,'old'),base('5.2.3',shaD,'new')];
catalog[0].settingsTranslationSets=sets;
const behavior={schemaVersion:1,families:{
  qapp:{altWebuiTranslation:true,missingTranslationFallback:'qt-application-translator'},
  strict:{altWebuiTranslation:true,missingTranslationFallback:'none-explicit'},
  disabled:{altWebuiTranslation:false,missingTranslationFallback:'explicit-source'},
  dedicated:{altWebuiTranslation:true,missingTranslationFallback:'explicit-source'}
},profiles:[
  {qbVersion:'4.1.3',sourceSha:shaA,family:'qapp'},
  {qbVersion:'4.1.4',sourceSha:shaB,family:'strict'},
  {qbVersion:'4.5.0',sourceSha:shaC,family:'disabled'},
  {qbVersion:'5.2.3',sourceSha:shaD,family:'dedicated'}
]};

const bundle=buildNativeSettingsBundle(catalog,behavior);
assert.equal(bundle.profileCount,4);
assert.deepEqual(bundle.profiles[0].nativeLocales,['en','zh_CN'],'qApp family must use the running qB application translator');
assert.deepEqual(bundle.profiles[1].nativeLocales,['en','zh_CN'],'strict dedicated family is native only when every mapped ref has an exact official translation');
assert.deepEqual(bundle.profiles[2].bridgeLocales,['en','zh_CN'],'Alt-WebUI-disabled family must remain on the exact-release bridge');
assert.deepEqual(bundle.profiles[3].nativeLocales,['en'],'English source copy remains native when server-side translation is enabled');
assert.deepEqual(bundle.profiles[3].bridgeLocales,['zh_CN'],'a release whose exact official translation conflicts with the canonical official QM union must fail closed to the bridge');
assert.equal(bundle.localeMessages.zh_CN.find(item=>item.source==='Language:').translation,'语言：','canonical QM union must use the most common exact official translation');

const registry=renderNativeSettingsRegistry(catalog);
assert.equal((registry.match(/QBT_TR\(Language:\)QBT_TR\[CONTEXT=OptionsDialog\]/g)||[]).length,1,'native registry must deduplicate identical qB source/context markers');
assert.equal((registry.match(/@@WEIGG_PROFILE/g)||[]).length,4,'each exact release must bind its preference key to the shared source/context ref');
assert.ok(registry.includes(shaD)&&registry.includes('locale_select'));

const ts=renderLocaleTs('zh_CN',[{context:'OptionsDialog',source:'A & B',translation:'甲 < 乙'}]);
assert.ok(ts.includes('<source>A &amp; B</source>')&&ts.includes('<translation>甲 &lt; 乙</translation>'),'generated minimal TS must remain valid XML');

assert.throws(()=>buildNativeSettingsBundle(catalog,{...behavior,profiles:behavior.profiles.slice(1)}),/does not match/,'missing source-bound behavior evidence must fail closed');
console.log('Native qB Settings bundle contract passed: native routes are exact-source proven, conflicting locales fall back to bridge, QBT_TR refs dedupe, and QM TS stays official-source derived.');
