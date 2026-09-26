import assert from 'node:assert/strict';
import fs from 'node:fs';

const file=process.argv[2];
if(!file)throw new Error('Usage: node tests/full-stable-torrent-menu-source-contract.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'exact stable catalog must be a non-empty array');

let provenProfiles=0,provenActions=0;
for(const profile of catalog){
  const version=String(profile?.qbVersion||'unknown');
  assert.ok(Object.prototype.hasOwnProperty.call(profile||{},'torrentContextMenu'),version+': exact source profile lost torrentContextMenu fact');
  assert.ok(Array.isArray(profile.torrentContextMenu)&&profile.torrentContextMenu.length>0,version+': Torrent context menu source inventory is empty');
  const ids=new Set();
  for(const item of profile.torrentContextMenu){
    const id=String(item?.id||'');
    assert.ok(id,version+': Torrent context-menu item is missing an id');
    assert.ok(!ids.has(id),version+': duplicate Torrent context-menu id '+id);
    ids.add(id);
    if(item?.sourceAction||item?.endpoint){
      assert.ok(item.sourceAction&&item.endpoint,version+': partially proven Torrent action '+id+' must not expose only one of sourceAction/endpoint');
      provenActions++;
    }
  }
  if(profile.torrentContextMenu.some(item=>item?.sourceAction&&item?.endpoint))provenProfiles++;
}
assert.ok(provenProfiles>0,'no stable profile exposes a source-proven Torrent action endpoint');
assert.ok(provenActions>0,'exact source catalog contains no source-proven Torrent action');
console.log('Full stable Torrent menu source contract passed: '+catalog.length+' profiles, '+provenProfiles+' with proven endpoints, '+provenActions+' proven action facts.');
