import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'webui/private/data');
const i18n=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');
const profiles={
  '4.6.4':'785320e7f6a5e228caf817b01dca69da0b83a012',
  '4.6.5':'5e81347933adec219dab27a503f8dc9c4a1c522d',
  '5.2.3':'0b63c3d17373f6132ea211c9dcd4241284ccdfaf'
};
const readProfile=version=>JSON.parse(fs.readFileSync(path.join(data,'qb-copy-profiles',profiles[version]+'.json'),'utf8'));
const has=(profile,field,locale)=>Array.isArray(profile[field])&&profile[field].includes(locale);
const p464=readProfile('4.6.4'),p465=readProfile('4.6.5'),p523=readProfile('5.2.3');

assert.equal(p464.family,'dedicated-alt-disabled');
assert.equal(p464.nativeLocales.length,0,'qB 4.6.4 Alternative WebUI translation is source-proven disabled and must not be promoted to native QM');
for(const locale of ['zh_CN','zh_HK','zh_TW','ja'])assert.equal(has(p464,'fallbackLocales',locale),true,`qB 4.6.4 ${locale} must stay on exact official fallback`);

assert.equal(p465.family,'dedicated-native-explicit-fallback');
assert.equal(has(p465,'nativeLocales','da'),true,'qB 4.6.5 must preserve source-proven native-QM routes');
for(const locale of ['zh_CN','zh_HK','zh_TW','ja'])assert.equal(has(p465,'fallbackLocales',locale),true,`qB 4.6.5 ${locale} must stay exact fallback when its active-root QM route is not source-proven`);

assert.equal(p523.family,'dedicated-native-explicit-fallback');
assert.equal(has(p523,'nativeLocales','zh_HK'),true,'qB 5.2.3 zh_HK is source-proven native through QBT_TR + active-root official QM');
for(const locale of ['zh_CN','zh_TW','ja']){
  assert.equal(has(p523,'nativeLocales',locale),false,`qB 5.2.3 ${locale} must not be inferred native from version alone`);
  assert.equal(has(p523,'fallbackLocales',locale),true,`qB 5.2.3 ${locale} must use its exact official fallback shard`);
}

assert.ok(i18n.includes("var nativeLocale=routeLocale(profile.nativeLocales),fallbackLocale=nativeLocale?null:routeLocale(profile.fallbackLocales)"),'runtime must select translation ownership from exact profile locale routes');
assert.ok(i18n.includes("source:mode==='native'?'qb-native-QBT_TR+official-QM':'qb-exact-official-fallback-shard'"),'runtime must expose native-QM vs exact-fallback ownership');
assert.ok(i18n.includes("if(fallbackLocale&&setId){var major=expectedVersion.split('.')[0];fallbackTask=loader.readJson('data/qb-copy-fallback/'+major+'/'+fallbackLocale+'.json'"),'only fallback routes may fetch one current major/locale JSON fallback shard');
assert.ok(i18n.includes("bindingTask=loader.readText('data/qb-copy-bindings/'+profile.bindingId+'.txt'"),'native and fallback routes must share the exact source/context binding');
assert.equal(/(?:>=|>|startsWith\(|indexOf\()[^\n]{0,80}4\.6\.5/.test(i18n),false,'browser runtime must not infer native translation from a 4.6.5+ version threshold');
assert.equal(i18n.includes('translations/webui_'),false,'browser JavaScript must not fetch or parse qB QM files; native QBT_TR translation stays server-owned');

console.log('A62.3 QM-first routing contract passed: exact source profiles choose native QBT_TR/QM per locale, source-proven gaps load only the current major/locale official fallback shard, and version thresholds do not invent native routes.');
