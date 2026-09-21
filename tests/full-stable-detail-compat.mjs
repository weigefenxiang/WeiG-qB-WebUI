import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-detail-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen detail matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen detail matrix floor must remain qB 4.1.0');

const {W}=createCompactRuntime(catalog,{owners:['capabilities.js']});
const R=W.CapabilityRegistry;
assert.ok(R&&typeof R.hasTorrentDetailField==='function','CapabilityRegistry detail provenance owner must load');

const surfaces={
  properties:{profileKey:'torrentPropertiesFields',action:'torrentscontroller.h:propertiesAction'},
  files:{profileKey:'torrentFileFields',action:'torrentscontroller.h:filesAction'},
  trackers:{profileKey:'torrentTrackerFields',action:'torrentscontroller.h:trackersAction'},
  webseeds:{profileKey:'torrentWebSeedFields',action:'torrentscontroller.h:webseedsAction'}
};
let supportedEndpoints=0,totalFields=0;
for(const profile of catalog){
  await R.bind({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion});
  assert.equal(R.releaseIdentity()?.qbVersion,profile.qbVersion,`${profile.qbVersion}: exact detail profile bind failed`);
  assert.equal(R.releaseIdentity()?.sourceSha,profile.sourceSha,`${profile.qbVersion}: detail profile source SHA drift`);
  assert.equal(R.isCertified(),true,`${profile.qbVersion}: frozen official stable must remain certified`);
  for(const [surface,{profileKey,action}] of Object.entries(surfaces)){
    const expected=Array.isArray(profile[profileKey])?profile[profileKey]:[];
    const runtime=expected.filter(field=>R.hasTorrentDetailField(surface,field));
    assert.deepEqual(runtime,expected,`${profile.qbVersion}: ${surface} response fields diverged from source-derived compact contract`);
    assert.equal(new Set(runtime).size,runtime.length,`${profile.qbVersion}: ${surface} response field surface contains duplicates`);
    assert.equal(R.hasTorrentDetailField(surface,'__weigg_missing_field__'),false,`${profile.qbVersion}: ${surface} must fail closed for an unknown field`);
    const actionExpected=Array.isArray(profile.apiActions)&&profile.apiActions.includes(action);
    assert.equal(R.hasAction(action),actionExpected,`${profile.qbVersion}: ${surface} endpoint availability must follow exact source action ${action}`);
    if(actionExpected)supportedEndpoints++;
    totalFields+=runtime.length;
  }
}

console.log(`Frozen Torrent detail compatibility passed: ${catalog.length} official stable releases ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion}; ${supportedEndpoints}/${catalog.length*4} detail endpoint facts and ${totalFields} response-field facts are consumed exactly from source-derived profiles.`);
