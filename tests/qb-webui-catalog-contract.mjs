import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildNativeSettingsBundle} from '../tools/qb-settings-native-bundle.mjs';
import {packCatalog,QB_WEBUI_MAX_STATIC_FILE_BYTES,runtimeCatalogData,runtimeCatalogIndexData,settingsTranslationShard} from '../tools/qb-webui-catalog.mjs';

const shaA='1111111111111111111111111111111111111111';
const shaB='2222222222222222222222222222222222222222';
const setEn={messages:[{context:'OptionsDialog',source:'Language:',translation:'Language:'}]};
const setZh={messages:[{context:'OptionsDialog',source:'Language:',translation:'语言：'}]};
const catalog=[
  {
    qbVersion:'4.5.0',webApiVersion:'2.8.19',sourceSha:shaA,stable:true,officialWeiGSupport:true,webuiLocales:[{value:'en'},{value:'zh_CN'}],preferenceDescriptors:[{key:'locale'}],
    settingsUiSource:'qb-upstream-preferences-ui',settingsUiMappedPreferences:1,settingsUiTotalPreferences:1,
    settingsUi:{locale:{controlId:'locale_select',title:{context:'OptionsDialog',source:'Language:'}}},
    settingsTranslations:{en:'set-en',zh_CN:'set-zh'},settingsTranslationSets:{'set-en':setEn,'set-zh':setZh}
  },
  {
    qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:shaB,stable:true,officialWeiGSupport:true,webuiLocales:[{value:'en'},{value:'zh_CN'}],preferenceDescriptors:[{key:'locale'}],
    settingsUiSource:'qb-upstream-preferences-ui',settingsUiMappedPreferences:1,settingsUiTotalPreferences:1,
    settingsUi:{locale:{controlId:'locale_select',title:{context:'OptionsDialog',source:'Language:'}}},
    settingsTranslations:{en:'set-en',zh_CN:'set-zh'},settingsTranslationSets:{}
  }
];
const behavior={schemaVersion:1,families:{
  disabled:{altWebuiTranslation:false,missingTranslationFallback:'explicit-source'},
  native:{altWebuiTranslation:true,missingTranslationFallback:'explicit-source'}
},profiles:[
  {qbVersion:'4.5.0',sourceSha:shaA,family:'disabled'},
  {qbVersion:'5.2.3',sourceSha:shaB,family:'native'}
]};
const bundle=buildNativeSettingsBundle(catalog,behavior);
const runtime=runtimeCatalogData(catalog,bundle);
assert.equal(runtime.length,2);
for(const profile of runtime){for(const key of ['settingsUiSource','settingsUiMappedPreferences','settingsUiTotalPreferences','settingsUi','settingsTranslations','settingsTranslationSets'])assert.equal(Object.hasOwn(profile,key),false,`runtime catalog must not ship ${key}`);}
assert.deepEqual(runtime[0].settingsTranslationLocales,['en','zh_CN']);
assert.equal(runtime[0].settingsTranslationPath,`qb-settings/${shaA}.json`,'Alt-WebUI translation hole must keep the exact official TS bridge');
assert.deepEqual(runtime[1].settingsNativeLocales,['en','zh_CN']);
assert.equal(Object.hasOwn(runtime[1],'settingsTranslationPath'),false,'fully native release must retire the browser translation shard');
assert.equal(JSON.stringify(runtime).includes('语言：'),false,'runtime profiles must not carry official translation payloads');

const index=runtimeCatalogIndexData(runtime);
assert.deepEqual(index.map(item=>item.qbVersion),['4.5.0','5.2.3']);
assert.equal(index[0].profilePath,`qb-release-profiles/${shaA}.json`);
assert.equal(Object.hasOwn(index[0],'preferenceDescriptors'),false,'release index must stay tiny and must not inline profile semantics');

const bridgeShard=settingsTranslationShard(catalog[0],{'set-en':setEn,'set-zh':setZh},['zh_CN']);
assert.equal(bridgeShard.schemaVersion,2);
assert.deepEqual(Object.keys(bridgeShard.translations),['zh_CN'],'compatibility shard must contain only locales that cannot use native QBT_TR');
assert.deepEqual(Object.keys(bridgeShard.sets),['set-zh']);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-qb-catalog-'));
try{
  const input=path.join(temp,'input.json');
  const output=path.join(temp,'data','qb-releases.json');
  const qmSourceDir=path.join(temp,'qm-src');
  const qmOutputDir=path.join(temp,'translations');
  fs.writeFileSync(input,JSON.stringify(catalog));
  const result=packCatalog(input,output,{behaviorEvidence:behavior,qmSourceDir,qmOutputDir});
  assert.equal(result.profiles,2);
  assert.equal(result.profileShardCount,2,'every exact stable profile must be emitted as one small runtime shard');
  assert.equal(result.settingsShardCount,1,'only the source-proven compatibility family should emit a browser translation shard');
  assert.equal(result.nativeLocaleRoutes,2);
  assert.equal(result.bridgeLocaleRoutes,2);
  assert.equal(result.qmCount,1,'non-English canonical official copy must be packaged as a minimal QM');
  assert.ok(result.packedBytes<64*1024,'runtime release index should stay far below qB static-file limits');
  assert.ok(result.maxProfileShardBytes<5*1024*1024,'one exact runtime profile shard must stay below project static-file budget');
  assert.ok(result.packedBytes<QB_WEBUI_MAX_STATIC_FILE_BYTES);
  assert.ok(result.nativeRegistryBytes<5*1024*1024);
  assert.ok(result.maxQmBytes<5*1024*1024);
  const packed=JSON.parse(fs.readFileSync(output,'utf8'));
  assert.equal(packed[0].profilePath,`qb-release-profiles/${shaA}.json`);
  assert.equal(Object.hasOwn(packed[0],'settingsTranslationPath'),false,'tiny index must not inline exact profile fields');
  const profileA=JSON.parse(fs.readFileSync(path.join(temp,'data','qb-release-profiles',`${shaA}.json`),'utf8'));
  const profileB=JSON.parse(fs.readFileSync(path.join(temp,'data','qb-release-profiles',`${shaB}.json`),'utf8'));
  assert.equal(profileA.settingsTranslationPath,`qb-settings/${shaA}.json`);
  assert.equal(Object.hasOwn(profileB,'settingsTranslationPath'),false);
  assert.ok(fs.readFileSync(path.join(temp,'data','qb-settings-native.txt'),'utf8').includes('QBT_TR(Language:)QBT_TR[CONTEXT=OptionsDialog]'));
  const shardA=JSON.parse(fs.readFileSync(path.join(temp,'data','qb-settings',`${shaA}.json`),'utf8'));
  assert.equal(shardA.sourceSha,shaA);
  assert.equal(fs.existsSync(path.join(temp,'data','qb-settings',`${shaB}.json`)),false);
  assert.ok(fs.readFileSync(path.join(qmSourceDir,'webui_zh_CN.ts'),'utf8').includes('<translation>语言：</translation>'));
  const qm=fs.readFileSync(path.join(qmOutputDir,'webui_zh_CN.qm'));
  assert.equal(qm.subarray(0,16).toString('hex'),'3cb86418caef9c95cd211cbf60a1bddd');
  assert.equal(fs.existsSync(path.join(temp,'data','qb-settings-translations.json')),false,'retired all-release translation sidecar must not be generated');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}

assert.throws(()=>runtimeCatalogIndexData([{qbVersion:'5.2.3',sourceSha:'bad'}]),/exact source SHA/);
assert.throws(()=>settingsTranslationShard({...catalog[0],sourceSha:'not-a-sha'},{'set-en':setEn,'set-zh':setZh},['zh_CN']),/invalid exact source SHA/);
assert.throws(()=>settingsTranslationShard({...catalog[0],settingsTranslations:{zh_CN:'missing'}},{'set-en':setEn},['zh_CN']),/missing Settings translation set/);

console.log('qB WebUI catalog contract passed: runtime release facts are served as a tiny index plus one exact profile shard, native QBT_TR/minimal QM remains primary, and only source-proven incompatible locales keep exact official TS shards.');