import assert from 'node:assert/strict';
import {createPreferenceRuntime} from '../simulator/preferences/runtime.js';
import {buildPreferenceDescriptors} from '../simulator/preferences/descriptors.js';
import {reconcileWorldProfile} from '../simulator/core/world-profile.js';

const upstreamDescriptors=[
  {key:'bool_key',type:'boolean',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
  {key:'number_key',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
  {key:'string_key',type:'string',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
  {key:'array_key',type:'array',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
  {key:'object_key',type:'object',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'}
];
const profile={
  qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',protocolGeneration:'qb5',stable:true,
  preferenceKeys:upstreamDescriptors.map(item=>item.key),preferenceDescriptors:upstreamDescriptors,apiActions:[]
};

{
  const world={
    profile,
    preferences:{
      bool_key:'true',number_key:'42',string_key:99,array_key:{bad:true},object_key:['bad'],off_surface:'preserve-me'
    },
    globalDownloadLimit:0,globalUploadLimit:0,torrents:[]
  };
  const runtime=createPreferenceRuntime(world);
  assert.deepEqual(runtime.read(),{bool_key:false,number_key:0,string_key:'',array_key:[],object_key:{}},'wrong persisted runtime types must be replaced only at the transport surface with type-safe placeholders');
  assert.deepEqual(runtime.coverage().sanitizedWorldKeys,['array_key','bool_key','number_key','object_key','string_key']);
  assert.equal(world.preferences.off_surface,'preserve-me','migration must not destroy off-surface values that may belong to another qB profile');
  for(const key of profile.preferenceKeys)assert.ok(!Object.prototype.hasOwnProperty.call(world.preferences,key),`${key}: stale wrong-typed persisted value must be removed`);
}

{
  const descriptors=buildPreferenceDescriptors({},['disk_cache_ttl','inherited_good','inherited_bad'],{
    profileDescriptors:[
      {key:'disk_cache_ttl',type:'string',writable:true},
      {key:'inherited_good',type:'number',writable:true},
      {key:'inherited_bad',type:'number',writable:true}
    ],
    inheritedPreferences:{inherited_good:41,inherited_bad:'41'}
  });
  const byKey=new Map(descriptors.map(item=>[item.key,item]));
  assert.equal(byKey.get('disk_cache_ttl').value,'','a known default with a type that conflicts with upstream schema must be rejected rather than leaked');
  assert.ok(byKey.get('disk_cache_ttl').rejectedValueSources.includes('KNOWN_DEFAULT'));
  assert.equal(byKey.get('inherited_good').value,41,'same-type inherited values may be reused');
  assert.equal(byKey.get('inherited_good').provenance,'INHERITED');
  assert.equal(byKey.get('inherited_bad').value,0,'wrong-type inheritance must fall back to a typed safe placeholder');
  assert.ok(byKey.get('inherited_bad').rejectedValueSources.includes('INHERITED'));
}

{
  const catalog=[profile];
  const world={
    profile:{...profile,preferenceDescriptors:profile.preferenceDescriptors.map(item=>({...item}))},
    preferences:{number_key:'100',bool_key:true,off_surface:'keep'},globalDownloadLimit:0,globalUploadLimit:0,torrents:[]
  };
  const result=reconcileWorldProfile(world,catalog,'5.2.3');
  assert.equal(result.changed,true,'same-profile worlds with wrong persisted value types must still be repaired');
  assert.deepEqual(result.sanitizedPreferenceKeys,['number_key']);
  assert.equal(world.preferences.bool_key,true);
  assert.equal(world.preferences.off_surface,'keep');
}

{
  const oldProfile={...profile,preferenceDescriptors:profile.preferenceDescriptors.map(item=>item.key==='number_key'?{...item,type:'number'}:{...item})};
  const newProfile={...profile,sourceSha:'new-schema',preferenceDescriptors:profile.preferenceDescriptors.map(item=>item.key==='number_key'?{...item,type:'string'}:{...item})};
  const world={profile:oldProfile,preferences:{number_key:55},globalDownloadLimit:0,globalUploadLimit:0,torrents:[]};
  const result=reconcileWorldProfile(world,[newProfile],'5.2.3');
  assert.equal(result.changed,true);
  assert.deepEqual(result.sanitizedPreferenceKeys,['number_key'],'a profile schema type change must invalidate the old persisted representation');
  assert.equal(createPreferenceRuntime(world).read().number_key,'','the migrated runtime must immediately expose the new upstream type');
}

{
  const limitProfile={
    qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',protocolGeneration:'qb5',stable:true,
    preferenceKeys:['dl_limit','up_limit'],
    preferenceDescriptors:[
      {key:'dl_limit',type:'number',writable:true,setterPresent:true,sourceConfidence:'HIGH'},
      {key:'up_limit',type:'number',writable:true,setterPresent:true,sourceConfidence:'HIGH'}
    ],apiActions:[]
  };
  const world={profile:limitProfile,preferences:{dl_limit:'146800640',up_limit:'10485760'},globalDownloadLimit:146800640,globalUploadLimit:10485760,torrents:[]};
  const result=reconcileWorldProfile(world,[limitProfile],'5.2.3');
  assert.deepEqual(result.sanitizedPreferenceKeys,['dl_limit','up_limit']);
  assert.equal(world.globalDownloadLimit,0,'invalid stale dl_limit must not leave a hidden scheduler hard cap behind');
  assert.equal(world.globalUploadLimit,0,'invalid stale up_limit must not leave a hidden scheduler hard cap behind');
  const runtime=createPreferenceRuntime(world);
  assert.equal(typeof runtime.read().dl_limit,'number');
  assert.equal(typeof runtime.read().up_limit,'number');
}

console.log('Virtual qB preference value fidelity contract passed: upstream types gate world/default/inherited values, stale sessions repair safely, profile type changes migrate and duplicated hard-limit state cannot remain stale.');
