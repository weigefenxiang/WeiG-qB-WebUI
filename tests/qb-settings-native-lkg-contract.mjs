import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const catalogBytes=fs.readFileSync(path.join(here,'fixtures/qb-release-catalog.lkg.json'));
const localeEvidence=JSON.parse(fs.readFileSync(path.join(here,'../tools/data/qb-locale-lkg.json'),'utf8'));
const behaviorEvidence=JSON.parse(fs.readFileSync(path.join(here,'../tools/data/qb-translator-behavior-lkg.json'),'utf8'));
const catalogSha256=crypto.createHash('sha256').update(catalogBytes).digest('hex');

assert.equal(localeEvidence.schemaVersion,1);
assert.equal(behaviorEvidence.schemaVersion,1);
assert.equal(localeEvidence.baseCatalogSha256,catalogSha256,'frozen locale evidence must remain bound to the exact stable base catalog');
assert.equal(localeEvidence.profileCount,65,'locale evidence must cover all admitted stable releases');
assert.equal(behaviorEvidence.profileCount,65,'translator behavior evidence must cover all admitted stable releases');
assert.equal(localeEvidence.supportFloor,'4.1.0');
assert.equal(behaviorEvidence.supportFloor,'4.1.0');
assert.equal(localeEvidence.latestAdmittedStable,'5.2.3');
assert.equal(behaviorEvidence.latestAdmittedStable,'5.2.3');

const localeByVersion=new Map(localeEvidence.profiles.map(profile=>[String(profile.qbVersion),profile]));
let nativeCapableLocaleRoutes=0;
let mandatoryBridgeLocaleRoutes=0;
let altDisabledProfiles=0;
for(const profile of behaviorEvidence.profiles){
  const localeProfile=localeByVersion.get(String(profile.qbVersion));
  assert.ok(localeProfile,`${profile.qbVersion}: frozen locale profile missing`);
  assert.equal(String(localeProfile.sourceSha),String(profile.sourceSha),`${profile.qbVersion}: locale and translator evidence must bind the same exact source SHA`);
  const locales=localeEvidence.localeSets?.[localeProfile.localeSet];
  assert.ok(Array.isArray(locales)&&locales.length>0,`${profile.qbVersion}: exact WebUI locale set must be resolved`);
  assert.equal(new Set(locales).size,locales.length,`${profile.qbVersion}: locale set must not contain duplicates`);
  const family=behaviorEvidence.families?.[profile.family];
  assert.ok(family,`${profile.qbVersion}: translator family ${profile.family} is missing`);
  assert.equal(family.qbtTrParserExists,true,`${profile.qbVersion}: admitted Settings translation route requires QBT_TR parser evidence`);
  if(profile.family==='dedicated-alt-disabled'){
    altDisabledProfiles+=1;
    assert.equal(family.altWebuiTranslation,false,`${profile.qbVersion}: hard compatibility-hole family must stay non-native`);
    mandatoryBridgeLocaleRoutes+=locales.length;
  }else{
    assert.equal(family.altWebuiTranslation,true,`${profile.qbVersion}: native-capable family must retain Alternative WebUI translation evidence`);
    nativeCapableLocaleRoutes+=locales.length;
  }
}

assert.equal(localeByVersion.size,65,'locale evidence must not contain duplicate/missing stable versions');
assert.equal(altDisabledProfiles,11,'4.5.0 through 4.6.4 must remain the 11-release mandatory compatibility-bridge family');
for(const version of ['4.5.0','4.6.4']){
  assert.equal(behaviorEvidence.profiles.find(profile=>profile.qbVersion===version)?.family,'dedicated-alt-disabled',`${version}: hard Alternative WebUI translation hole boundary changed`);
}
for(const version of ['4.4.5','4.6.5','5.0.0','5.2.3']){
  assert.notEqual(behaviorEvidence.profiles.find(profile=>profile.qbVersion===version)?.family,'dedicated-alt-disabled',`${version}: native-capable boundary changed`);
}
assert.ok(nativeCapableLocaleRoutes>0&&mandatoryBridgeLocaleRoutes>0,'stable evidence must retain both native-capable and mandatory-bridge routes');

console.log(`Native Settings stable routing evidence passed: 65 releases, ${nativeCapableLocaleRoutes} native-capable locale routes, ${mandatoryBridgeLocaleRoutes} mandatory exact-TS bridge routes, 11 Alternative WebUI gap releases.`);
