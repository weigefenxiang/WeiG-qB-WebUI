import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalogIdentity,assertCatalogIdentity} from '../tools/qb-catalog-identity.mjs';

const load=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const frozen=load('tests/fixtures/qb-release-catalog.lkg.json');
const locale=load('tools/data/qb-locale-lkg.json');
const torrent=load('webui/private/data/torrent-compat.json');
const capabilities=load('webui/private/data/capabilities.json');
assertCatalogIdentity(torrent.catalogIdentity,catalogIdentity(frozen),'Torrent source materialization');
const actions=load('webui/private/data/source-actions.json');
assertCatalogIdentity(actions.catalogIdentity,torrent.catalogIdentity,'Torrent/Action exact Frozen source identity');
assertCatalogIdentity(torrent.catalogIdentity,capabilities.catalogIdentity,'Single Frozen registry identity');
assert.equal(locale.profileCount,frozen.length);
assert.equal(locale.profiles.length,frozen.length);
const releases=frozen.map(row=>row.qbVersion);
function fact(name,version){
  const changes=torrent.sourceFacts?.[name];
  assert.ok(Array.isArray(changes)&&changes.length,'Missing source fact '+name);
  const end=releases.indexOf(version);assert.ok(end>=0,'Unknown exact release '+version);
  let value=null,prior=-1;
  for(const row of changes){
    const index=releases.indexOf(row.from);
    assert.ok(index>=0&&index>prior,'Non-canonical source order in '+name);
    prior=index;
    if(index<=end)value=row.value;
  }
  return value;
}
for(const version of ['4.1.0','5.2.3','5.2.4']){
  const source=frozen.find(p=>p.qbVersion===version);
  const provenance=locale.profiles.find(p=>p.qbVersion===version);
  assert.ok(source&&provenance&&source.sourceSha===provenance.sourceSha,'Exact qB source identity mismatch at '+version);
  const locales=fact('webuiLocales',version),expected=locale.localeSets[provenance.localeSet];
  assert.ok(Array.isArray(locales)&&locales.length&&Array.isArray(expected),'Missing source-supported Locale inventory at '+version);
  assert.deepEqual(locales.map(x=>String(typeof x==='string'?x:x.value)),expected,version+' Locale inventory differs from Frozen source evidence');
  const statistics=fact('statisticsUi',version);
  assert.ok(statistics?.title?.source&&statistics.title.context==='MainWindow',version+' native Statistics copy missing');
  assert.ok(Array.isArray(statistics.groups)&&statistics.groups.length===3,version+' native Statistics groups missing');
  assert.equal(statistics.groups.reduce((sum,g)=>sum+(g.fields||[]).length,0),12,version+' source Statistics field count changed');
  const visible=fact('torrentVisibleFilters',version);
  assert.ok(Array.isArray(visible)&&visible.length>=8&&visible.every(row=>row.name&&row.translation?.source&&row.translation?.context),version+' source-owned Status filters missing');
}
const old=fact('torrentVisibleFilters','4.1.0').map(x=>x.name);
assert.ok(old.includes('paused')&&old.includes('resumed'),'4.1.0 must preserve native status names');
const current=fact('torrentVisibleFilters','5.2.3').map(x=>x.name);
assert.ok(current.includes('stopped')&&current.includes('running'),'5.2.3 must preserve native status names');
assert.deepEqual(fact('facetSpecialRows','5.2.3')?.tag?.untagged,{source:'Untagged',context:'TagFilterModel'},'Native 5.2.3 Untagged source/context was lost');
assert.ok(!fact('facetSpecialRows','4.1.0')?.tag?.untagged,'4.1.0 must not invent unsupported Tag source');
console.log('Native source regression PASS: 66-profile Frozen identity, qB4/qB5 Statistics, Status, Untagged and Locale inventories.');
