import assert from 'node:assert/strict';
import {buildNativeSettingsBundle,renderNativeSettingsRegistry,renderLocaleQm,renderLocaleTs} from '../tools/qb-settings-native-bundle.mjs';
import {extractQbPreferenceUiFacts} from '../tools/qb-settings-translation-source.mjs';
import {extractQbOwnedUiFacts} from '../tools/qb-owned-ui-source.mjs';

const shaA='1111111111111111111111111111111111111111';
const shaB='2222222222222222222222222222222222222222';
const shaC='3333333333333333333333333333333333333333';
const shaD='4444444444444444444444444444444444444444';
const title={context:'OptionsDialog',source:'Language:'};
const ui={locale:{controlId:'locale_select',title}};
const owned={
  'settings.tab.downloads':{context:'OptionsDialog',source:'Downloads'},
  'filter.all':{context:'StatusFilterWidget',source:'All (0)'},
  'transfer.rate.global':{context:'OptionsDialog',source:'Global Rate Limits'}
};
const ownedMessages=[
  {context:'OptionsDialog',source:'Downloads',translation:'下载',numerus:false},
  {context:'StatusFilterWidget',source:'All (0)',translation:'全部 (0)',numerus:false},
  {context:'OptionsDialog',source:'Global Rate Limits',translation:'全局速率限制',numerus:false}
];
const setEn={messages:[{...title,translation:'Language:',numerus:false},{context:'OptionsDialog',source:'Downloads',translation:'Downloads',numerus:false},{context:'StatusFilterWidget',source:'All (0)',translation:'All (0)',numerus:false},{context:'OptionsDialog',source:'Global Rate Limits',translation:'Global Rate Limits',numerus:false}]};
const setZhOld={messages:[{...title,translation:'语言：',numerus:false},...ownedMessages]};
const setZhNew={messages:[{...title,translation:'界面语言：',numerus:false},...ownedMessages]};
const sets={en:setEn,old:setZhOld,new:setZhNew};
const base=(qbVersion,sourceSha,zhHash)=>({qbVersion,sourceSha,webuiLocales:[{value:'en'},{value:'zh_CN'}],settingsUi:ui,qbOwnedUi:owned,settingsTranslations:{en:'en',zh_CN:zhHash},settingsTranslationSets:{}});
const catalog=[base('4.1.3',shaA,'old'),base('4.1.4',shaB,'old'),base('4.5.0',shaC,'old'),base('5.2.3',shaD,'new')];
catalog[0].settingsTranslationSets=sets;
const behavior={schemaVersion:1,families:{
  'qapp-native':{altWebuiTranslation:true,missingTranslationFallback:'qt-application-translator'},
  strict:{altWebuiTranslation:true,missingTranslationFallback:'none-explicit'},
  disabled:{altWebuiTranslation:false,missingTranslationFallback:'explicit-source'},
  dedicated:{altWebuiTranslation:true,missingTranslationFallback:'explicit-source'}
},profiles:[
  {qbVersion:'4.1.3',sourceSha:shaA,family:'qapp-native'},
  {qbVersion:'4.1.4',sourceSha:shaB,family:'strict'},
  {qbVersion:'4.5.0',sourceSha:shaC,family:'disabled'},
  {qbVersion:'5.2.3',sourceSha:shaD,family:'dedicated'}
]};

const bundle=buildNativeSettingsBundle(catalog,behavior);
assert.equal(bundle.profileCount,4);
assert.equal(bundle.profiles[0].mappedUi,3,'native bundle must count exact qB-owned UI source/context bindings');
assert.deepEqual(bundle.profiles[0].nativeLocales,['en','zh_CN'],'qApp family must use the running qB application translator');
assert.deepEqual(bundle.profiles[1].nativeLocales,['en','zh_CN'],'strict dedicated family is native only when every mapped ref has an exact official translation');
assert.deepEqual(bundle.profiles[2].bridgeLocales,['en','zh_CN'],'Alt-WebUI-disabled family must remain on the exact-release bridge');
assert.deepEqual(bundle.profiles[3].nativeLocales,['en'],'English source copy remains native when server-side translation is enabled');
assert.deepEqual(bundle.profiles[3].bridgeLocales,['zh_CN'],'a release whose exact official translation conflicts with the canonical official QM union must fail closed to the bridge');
assert.equal(bundle.localeMessages.zh_CN.find(item=>item.source==='Language:').translation,'语言：','canonical QM union must use the most common exact official translation');
assert.equal(bundle.localeMessages.zh_CN.find(item=>item.source==='Downloads').translation,'下载','qB-owned UI refs must share the same official QM union');

const registry=renderNativeSettingsRegistry(catalog);
assert.equal((registry.match(/QBT_TR\(Language:\)QBT_TR\[CONTEXT=OptionsDialog\]/g)||[]).length,1,'native registry must deduplicate identical qB source/context markers');
assert.equal((registry.match(/@@WEIGG_PROFILE/g)||[]).length,4,'each exact release must bind its preference key to the shared source/context ref');
assert.equal((registry.match(/@@WEIGG_UI/g)||[]).length,12,'each exact release must bind qB-owned UI keys to exact source/context refs');
assert.ok(registry.includes(shaD)&&registry.includes('locale_select')&&registry.includes(encodeURIComponent('settings.tab.downloads')));

const ariaPreferences=`
<label id="filelogDeleteOldLabel" for="filelog_delete_old_checkbox">QBT_TR(Delete backup logs older than:)QBT_TR[CONTEXT=OptionsDialog]</label>
<input id="filelog_age_input" aria-labelledby="filelogDeleteOldLabel">
<script>document.getElementById("filelog_age_input").value = pref.file_log_age;</script>`;
const ariaFacts=extractQbPreferenceUiFacts(ariaPreferences,['file_log_age']);
assert.equal(ariaFacts.file_log_age.controlId,'filelog_age_input','aria-labelledby controls must resolve through the exact upstream label id');
assert.deepEqual(ariaFacts.file_log_age.title,{source:'Delete backup logs older than:',context:'OptionsDialog'});

const toolbar=`<li id="PrefDownloadsLink"><a>QBT_TR(Downloads)QBT_TR[CONTEXT=OptionsDialog]</a></li><li id="PrefWebUILink"><a>QBT_TR(WebUI)QBT_TR[CONTEXT=OptionsDialog]</a></li>`;
const filters=`<li id="all_filter"><span>QBT_TR(All (0))QBT_TR[CONTEXT=StatusFilterWidget]</span></li><li id="running_filter"><span>QBT_TR(Running (0))QBT_TR[CONTEXT=StatusFilterWidget]</span></li>`;
const ownedFacts=extractQbOwnedUiFacts({preferencesSource:'<legend>QBT_TR(Global Rate Limits)QBT_TR[CONTEXT=OptionsDialog]</legend><legend>QBT_TR(Alternative Rate Limits)QBT_TR[CONTEXT=OptionsDialog]</legend>',toolbarSource:toolbar,filtersSource:filters});
assert.deepEqual(ownedFacts['settings.tab.downloads'],{source:'Downloads',context:'OptionsDialog'});
assert.deepEqual(ownedFacts['settings.tab.webui'],{source:'WebUI',context:'OptionsDialog'});
assert.deepEqual(ownedFacts['filter.all'],{source:'All (0)',context:'StatusFilterWidget'});
assert.deepEqual(ownedFacts['filter.running'],{source:'Running (0)',context:'StatusFilterWidget'});
assert.deepEqual(ownedFacts['transfer.rate.global'],{source:'Global Rate Limits',context:'OptionsDialog'});
assert.deepEqual(ownedFacts['transfer.rate.alternative'],{source:'Alternative Rate Limits',context:'OptionsDialog'});

const sample=[{context:'OptionsDialog',source:'A & B',translation:'甲 < 乙'}];
const ts=renderLocaleTs('zh_CN',sample);
assert.ok(ts.includes('<source>A &amp; B</source>')&&ts.includes('<translation>甲 &lt; 乙</translation>'),'generated minimal TS must remain valid XML');
const qm=renderLocaleQm(sample);
assert.equal(qm.subarray(0,16).toString('hex'),'3cb86418caef9c95cd211cbf60a1bddd','QM must use the Qt translator magic marker');
assert.equal(qm[16],0x42,'QM must emit the Qt hash section first');
assert.equal(qm.readUInt32BE(17),8,'one translation must emit one hash/offset pair');
const messagesBlock=16+1+4+8;
assert.equal(qm[messagesBlock],0x69,'QM must emit the Qt message section');
const messageStart=messagesBlock+5;
assert.equal(qm[messageStart],3,'Qt message record must begin with Tag_Translation');
const translatedBytes=qm.readUInt32BE(messageStart+1),translated=Buffer.from(qm.subarray(messageStart+5,messageStart+5+translatedBytes));translated.swap16();
assert.equal(translated.toString('utf16le'),'甲 < 乙','QM translation payload must be UTF-16BE as QDataStream QString expects');
assert.ok(qm.includes(Buffer.from('A & B','utf8'))&&qm.includes(Buffer.from('OptionsDialog','utf8')),'QM SaveEverything record must carry source/context for exact QTranslator matching');

assert.throws(()=>buildNativeSettingsBundle(catalog,{...behavior,profiles:behavior.profiles.slice(1)}),/does not match/,'missing source-bound behavior evidence must fail closed');
console.log('Native qB Settings bundle contract passed: source-bound Settings + qB-owned UI routing, aria-labelledby label ownership, QBT_TR ref dedupe and Qt-compatible minimal QM structure are enforced.');
