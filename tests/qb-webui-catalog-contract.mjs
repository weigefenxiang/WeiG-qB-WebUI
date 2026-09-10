import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {packCatalog,QB_WEBUI_MAX_STATIC_FILE_BYTES,runtimeCatalogData,settingsTranslationShard} from '../tools/qb-webui-catalog.mjs';

const shaA='1111111111111111111111111111111111111111';
const shaB='2222222222222222222222222222222222222222';
const setEn={messages:[{context:'OptionsDialog',source:'Language:',translation:'Language:'}]};
const setZh={messages:[{context:'OptionsDialog',source:'Language:',translation:'语言：'}]};
const catalog=[
  {
    qbVersion:'4.5.0',sourceSha:shaA,webuiLocales:[{value:'en'},{value:'zh'}],preferenceDescriptors:[{key:'locale'}],
    settingsUiSource:'qb-upstream-preferences-ui',settingsUiMappedPreferences:1,settingsUiTotalPreferences:1,
    settingsUi:{locale:{controlId:'locale_select',title:{context:'OptionsDialog',source:'Language:'}}},
    settingsTranslations:{en:'set-en',zh:'set-zh'},settingsTranslationSets:{'set-en':setEn,'set-zh':setZh}
  },
  {
    qbVersion:'5.2.3',sourceSha:shaB,webuiLocales:[{value:'en'},{value:'zh_CN'}],preferenceDescriptors:[{key:'locale'}],
    settingsUiSource:'qb-upstream-preferences-ui',settingsUiMappedPreferences:1,settingsUiTotalPreferences:1,
    settingsUi:{locale:{controlId:'locale_select',title:{context:'OptionsDialog',source:'Language:'}}},
    settingsTranslations:{en:'set-en',zh_CN:'set-zh'},settingsTranslationSets:{}
  }
];

const runtime=runtimeCatalogData(catalog);
assert.equal(runtime.length,2);
for(const profile of runtime){
  for(const key of ['settingsUiSource','settingsUiMappedPreferences','settingsUiTotalPreferences','settingsUi','settingsTranslations','settingsTranslationSets'])assert.equal(Object.hasOwn(profile,key),false,`runtime catalog must not ship ${key}`);
  assert.equal(profile.settingsTranslationPath,`qb-settings/${profile.sourceSha}.json`);
}
assert.equal(JSON.stringify(runtime).includes('语言：'),false,'compatibility catalog must not carry official translation payloads');

const secondShard=settingsTranslationShard(catalog[1],{'set-en':setEn,'set-zh':setZh});
assert.equal(secondShard.qbVersion,'5.2.3');
assert.equal(secondShard.sourceSha,shaB);
assert.deepEqual(Object.keys(secondShard.sets).sort(),['set-en','set-zh'],'a profile shard must resolve hashes from catalog-wide deduplicated sets');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-qb-catalog-'));
try{
  const input=path.join(temp,'input.json');
  const output=path.join(temp,'data','qb-releases.json');
  fs.writeFileSync(input,JSON.stringify(catalog));
  const result=packCatalog(input,output);
  assert.equal(result.profiles,2);
  assert.equal(result.settingsShardCount,2);
  assert.ok(result.packedBytes<QB_WEBUI_MAX_STATIC_FILE_BYTES);
  assert.ok(result.maxSettingsShardBytes<QB_WEBUI_MAX_STATIC_FILE_BYTES);
  const packed=JSON.parse(fs.readFileSync(output,'utf8'));
  assert.equal(packed[0].settingsTranslationPath,`qb-settings/${shaA}.json`);
  assert.equal(Object.hasOwn(packed[0],'settingsTranslations'),false);
  const shardA=JSON.parse(fs.readFileSync(path.join(temp,'data','qb-settings',`${shaA}.json`),'utf8'));
  const shardB=JSON.parse(fs.readFileSync(path.join(temp,'data','qb-settings',`${shaB}.json`),'utf8'));
  assert.equal(shardA.sourceSha,shaA);
  assert.equal(shardB.sourceSha,shaB);
  assert.equal(shardB.sets['set-zh'].messages[0].translation,'语言：');
  assert.equal(fs.existsSync(path.join(temp,'data','qb-settings-translations.json')),false,'retired all-release translation sidecar must not be generated');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}

assert.throws(()=>settingsTranslationShard({...catalog[0],sourceSha:'not-a-sha'},{'set-en':setEn,'set-zh':setZh}),/invalid exact source SHA/);
assert.throws(()=>settingsTranslationShard({...catalog[0],settingsTranslations:{zh:'missing'}},{'set-en':setEn}),/missing Settings translation set/);

console.log('qB WebUI catalog contract passed: compatibility stays translation-free and exact-release official Settings copy is emitted as bounded lazy shards.');
