import assert from 'node:assert/strict';
import {buildNativeSettingsBundle,renderNativeSettingsRegistry,renderLocaleQm,renderLocaleTs} from '../tools/qb-settings-native-bundle.mjs';

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
const recoveryUnion={schemaVersion:1,source:'qb-official-ts-deterministic-recovery-union',locales:{
  zh_CN:[
    ...ownedMessages,
    {...title,translation:'语言：',numerus:false},
    {context:'RecoveryOnly',source:'Recovery-only official text',translation:'仅恢复资产',numerus:false},
    {context:'RecoveryOnly',source:'%n item(s)',translation:['%n 项','%n 项'],numerus:true}
  ]
}};

const bundle=buildNativeSettingsBundle(catalog,behavior,{recoveryUnion});
assert.equal(bundle.schemaVersion,2);
assert.equal(bundle.profileCount,4);
assert.equal(bundle.profiles[0].mappedUi,3,'native bundle must count exact qB-owned UI source/context bindings');
assert.deepEqual(bundle.profiles[0].nativeLocales,['en','zh_CN'],'qApp family must use the running qB application translator');
assert.deepEqual(bundle.profiles[1].nativeLocales,['en','zh_CN'],'strict dedicated family is native only when every mapped ref has an exact official translation');
assert.deepEqual(bundle.profiles[2].bridgeLocales,['en','zh_CN'],'Alt-WebUI-disabled family must remain on the exact-release bridge');
assert.deepEqual(bundle.profiles[3].nativeLocales,['en'],'English source copy remains native when server-side translation is enabled');
assert.deepEqual(bundle.profiles[3].bridgeLocales,['zh_CN'],'a release whose exact official translation conflicts with the deterministic recovery union must fail closed to the bridge');
assert.equal(bundle.localeMessages.zh_CN.find(item=>item.source==='Language:').translation,'语言：','native QM copy must come from the certified deterministic recovery union');
assert.equal(bundle.localeMessages.zh_CN.find(item=>item.source==='Downloads').translation,'下载','qB-owned UI refs must share the same certified recovery union');
assert.equal(bundle.localeMessages.zh_CN.find(item=>item.source==='Recovery-only official text').translation,'仅恢复资产','full recovery QM must include official messages outside the narrow Settings/qB-owned bridge surface');
assert.deepEqual(bundle.localeMessages.zh_CN.find(item=>item.source==='%n item(s)').translation,['%n 项','%n 项'],'full recovery QM must preserve official plural forms');
assert.throws(()=>buildNativeSettingsBundle(catalog,behavior),/certified deterministic recovery union/,'native bundle may not silently reconstruct an order-dependent union from narrow bridge sets');

const registry=renderNativeSettingsRegistry(catalog);
assert.equal((registry.match(/QBT_TR\(Language:\)QBT_TR\[CONTEXT=OptionsDialog\]/g)||[]).length,1,'native registry must deduplicate identical qB source/context markers');
assert.equal((registry.match(/@@WEIGG_PROFILE/g)||[]).length,4,'each exact release must bind its preference key to the shared source/context ref');
assert.equal((registry.match(/@@WEIGG_UI/g)||[]).length,12,'each exact release must bind qB-owned UI keys to exact source/context refs');
assert.ok(registry.includes(shaD)&&registry.includes('locale_select')&&registry.includes(encodeURIComponent('settings.tab.downloads')));

const sample=[
  {context:'OptionsDialog',source:'A & B',translation:'甲 < 乙',numerus:false},
  {context:'OptionsDialog',source:'%n file(s)',translation:['%n 个文件','%n 个文件'],numerus:true}
];
const ts=renderLocaleTs('zh_CN',sample);
assert.ok(ts.includes('<source>A &amp; B</source>')&&ts.includes('<translation>甲 &lt; 乙</translation>'),'generated recovery TS must remain valid XML');
assert.ok(ts.includes('<message numerus="yes">')&&(ts.match(/<numerusform>/g)||[]).length===2,'recovery TS must preserve plural forms');
const qm=renderLocaleQm(sample);
assert.equal(qm.subarray(0,16).toString('hex'),'3cb86418caef9c95cd211cbf60a1bddd','QM must use the Qt translator magic marker');
assert.equal(qm[16],0x42,'QM must emit the Qt hash section first');
assert.equal(qm.readUInt32BE(17),16,'two translations must emit two hash/offset pairs');
const messagesBlock=16+1+4+16;
assert.equal(qm[messagesBlock],0x69,'QM must emit the Qt message section');
const messageDataStart=messagesBlock+5,messageDataLength=qm.readUInt32BE(messagesBlock+1),messageData=qm.subarray(messageDataStart,messageDataStart+messageDataLength);
let cursor=0,scalarSeen=false,pluralSeen=false;
while(cursor<messageData.length){
  const translations=[];let source='',context='';
  for(;;){
    const tag=messageData[cursor++];
    if(tag===1)break;
    const length=messageData.readUInt32BE(cursor);cursor+=4;
    const bytes=Buffer.from(messageData.subarray(cursor,cursor+length));cursor+=length;
    if(tag===3){bytes.swap16();translations.push(bytes.toString('utf16le'));}
    else if(tag===6)source=bytes.toString('utf8');
    else if(tag===7)context=bytes.toString('utf8');
  }
  if(source==='A & B'){assert.deepEqual(translations,['甲 < 乙']);assert.equal(context,'OptionsDialog');scalarSeen=true;}
  if(source==='%n file(s)'){assert.deepEqual(translations,['%n 个文件','%n 个文件'],'Qt QM plural record must encode one Tag_Translation per official plural form');pluralSeen=true;}
}
assert.ok(scalarSeen&&pluralSeen,'QM SaveEverything records must carry both scalar and plural source/context translations');
assert.ok(qm.includes(Buffer.from('A & B','utf8'))&&qm.includes(Buffer.from('OptionsDialog','utf8')),'QM SaveEverything record must carry source/context for exact QTranslator matching');

assert.throws(()=>buildNativeSettingsBundle(catalog,{...behavior,profiles:behavior.profiles.slice(1)},{recoveryUnion}),/does not match/,'missing source-bound behavior evidence must fail closed');
console.log('Native qB Settings bundle contract passed: exact translator-family routing consumes one certified deterministic full recovery union, plural QM forms are Qt-compatible, and the Alternative WebUI gap remains bridge-routed.');
