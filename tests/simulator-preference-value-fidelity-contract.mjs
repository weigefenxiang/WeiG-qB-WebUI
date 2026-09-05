import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {createPreferenceRuntime} from '../simulator/preferences/runtime.js';
import {buildPreferenceDescriptors} from '../simulator/preferences/descriptors.js';
import {reconcileWorldProfile} from '../simulator/core/world-profile.js';
import {PreferenceProvenance} from '../simulator/preferences/types.js';

const upstreamDescriptors=[
  {key:'bool_key',type:'boolean',readType:'boolean',writeType:'boolean',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,source:'UPSTREAM_GETTER_SETTER',sourceConfidence:'HIGH'},
  {key:'number_key',type:'number',readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,source:'UPSTREAM_GETTER_SETTER',sourceConfidence:'HIGH'},
  {key:'string_key',type:'string',readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,source:'UPSTREAM_GETTER_SETTER',sourceConfidence:'HIGH'},
  {key:'array_key',type:'array',readType:'array',writeType:'array',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,source:'UPSTREAM_GETTER_SETTER',sourceConfidence:'HIGH'},
  {key:'object_key',type:'object',readType:'object',writeType:'object',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,source:'UPSTREAM_GETTER_SETTER',sourceConfidence:'HIGH'},
  {key:'opaque_read_number_write',type:'number',readType:null,writeType:'number',typeAgreement:'READ_UNRESOLVED',writable:true,getterPresent:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
  {key:'enum_key',type:'string',readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,upstreamFallbackValue:'Safe',upstreamFallbackExpression:'Mode::Safe',upstreamFallbackConfidence:'MEDIUM'}
];
const profile={
  qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',protocolGeneration:'qb5',stable:true,
  preferenceKeys:upstreamDescriptors.map(item=>item.key),preferenceDescriptors:upstreamDescriptors,apiActions:[]
};

{
  const world={
    profile,
    preferences:{
      bool_key:'true',number_key:'42',string_key:99,array_key:{bad:true},object_key:['bad'],
      opaque_read_number_write:'opaque-current-value',off_surface:'preserve-me'
    },
    globalDownloadLimit:0,globalUploadLimit:0,torrents:[]
  };
  const runtime=createPreferenceRuntime(world);
  const surface=runtime.read();
  assert.equal(surface.bool_key,false);
  assert.equal(surface.number_key,0);
  assert.equal(surface.string_key,'');
  assert.deepEqual(surface.array_key,[]);
  assert.deepEqual(surface.object_key,{});
  assert.equal(surface.opaque_read_number_write,'opaque-current-value','writeType must never rewrite an unresolved getter representation');
  assert.equal(surface.enum_key,'Safe','source-backed enum fallback should beat a fabricated empty string');
  assert.equal(runtime.descriptors().find(item=>item.key==='enum_key').provenance,PreferenceProvenance.UPSTREAM_FALLBACK);
  assert.deepEqual(runtime.coverage().sanitizedWorldKeys,['array_key','bool_key','number_key','object_key','string_key']);
  assert.equal(world.preferences.off_surface,'preserve-me','migration must not destroy off-surface values that may belong to another qB profile');
  assert.equal(world.preferences.opaque_read_number_write,'opaque-current-value','unresolved getter values must survive write-schema migration');
  for(const key of ['array_key','bool_key','number_key','object_key','string_key'])assert.ok(!Object.prototype.hasOwnProperty.call(world.preferences,key),`${key}: stale wrong-typed persisted value must be removed`);
}

{
  const descriptors=buildPreferenceDescriptors({},['disk_cache_ttl','inherited_good','inherited_bad','fallback_enum'],{
    profileDescriptors:[
      {key:'disk_cache_ttl',readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true},
      {key:'inherited_good',readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true},
      {key:'inherited_bad',readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true},
      {key:'fallback_enum',readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,upstreamFallbackValue:'None'}
    ],
    inheritedPreferences:{inherited_good:41,inherited_bad:'41'}
  });
  const byKey=new Map(descriptors.map(item=>[item.key,item]));
  assert.equal(byKey.get('disk_cache_ttl').value,'','a known default with a type that conflicts with upstream read schema must be rejected rather than leaked');
  assert.ok(byKey.get('disk_cache_ttl').rejectedValueSources.includes('KNOWN_DEFAULT'));
  assert.equal(byKey.get('inherited_good').value,41,'same-read-type inherited values may be reused');
  assert.equal(byKey.get('inherited_good').provenance,'INHERITED');
  assert.equal(byKey.get('inherited_bad').value,0,'wrong-read-type inheritance must fall back to a typed safe placeholder');
  assert.ok(byKey.get('inherited_bad').rejectedValueSources.includes('INHERITED'));
  assert.equal(byKey.get('fallback_enum').value,'None');
  assert.equal(byKey.get('fallback_enum').exactValue,false,'setter fallback is source-backed but is not a claimed startup default');
}

{
  const catalog=[profile];
  const world={
    profile:{...profile,preferenceDescriptors:profile.preferenceDescriptors.map(item=>({...item}))},
    preferences:{number_key:'100',bool_key:true,opaque_read_number_write:'opaque',off_surface:'keep'},globalDownloadLimit:0,globalUploadLimit:0,torrents:[]
  };
  const result=reconcileWorldProfile(world,catalog,'5.2.3');
  assert.equal(result.changed,true,'same-profile worlds with wrong persisted read types must still be repaired');
  assert.deepEqual(result.sanitizedPreferenceKeys,['number_key']);
  assert.equal(world.preferences.bool_key,true);
  assert.equal(world.preferences.opaque_read_number_write,'opaque','unresolved read schema must not be sanitized from writeType');
  assert.equal(world.preferences.off_surface,'keep');
}

{
  const oldProfile={...profile,preferenceDescriptors:profile.preferenceDescriptors.map(item=>item.key==='number_key'?{...item,readType:'number',writeType:'number',type:'number'}:{...item})};
  const newProfile={...profile,sourceSha:'new-schema',preferenceDescriptors:profile.preferenceDescriptors.map(item=>item.key==='number_key'?{...item,readType:'string',writeType:'string',type:'string'}:{...item})};
  const world={profile:oldProfile,preferences:{number_key:55},globalDownloadLimit:0,globalUploadLimit:0,torrents:[]};
  const result=reconcileWorldProfile(world,[newProfile],'5.2.3');
  assert.equal(result.changed,true);
  assert.deepEqual(result.sanitizedPreferenceKeys,['number_key'],'a profile getter schema type change must invalidate the old persisted representation');
  assert.equal(createPreferenceRuntime(world).read().number_key,'','the migrated runtime must immediately expose the new upstream read type');
}

{
  const limitProfile={
    qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',protocolGeneration:'qb5',stable:true,
    preferenceKeys:['dl_limit','up_limit'],
    preferenceDescriptors:[
      {key:'dl_limit',type:'number',readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,sourceConfidence:'HIGH'},
      {key:'up_limit',type:'number',readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true,getterPresent:true,setterPresent:true,sourceConfidence:'HIGH'}
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

{
  const splitProfile={
    qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',protocolGeneration:'qb5',stable:true,
    preferenceKeys:['split'],
    preferenceDescriptors:[{key:'split',readType:null,writeType:'number',typeAgreement:'READ_UNRESOLVED',writable:true,getterPresent:true,setterPresent:true}],apiActions:[]
  };
  const world=createWorld({profile:splitProfile,count:1,seed:'preference-read-write-split',now:1700000000000});
  world.preferences.split='opaque';
  const runtime=createPreferenceRuntime(world);
  assert.equal(runtime.read().split,'opaque');
  const accepted=runtime.write({split:'12'},1700000001000);
  assert.equal(accepted.split,12,'POST normalization must use writeType even when GET representation is unresolved');
  assert.equal(world.preferences.split,12);
}

console.log('Virtual qB preference value fidelity contract passed: readType governs persisted/GET values, writeType independently governs POST normalization, enum fallbacks remain provisional, stale sessions repair safely and duplicated hard-limit state cannot remain stale.');
