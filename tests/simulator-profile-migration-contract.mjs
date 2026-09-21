import assert from 'node:assert/strict';
import {reconcileWorldProfile} from '../simulator/core/world-profile.js';
import {createPreferenceRuntime} from '../simulator/preferences/runtime.js';

const catalog=[
  {
    qbVersion:'4.6.7',webApiVersion:'2.9.3',tag:'release-4.6.7',sourceSha:'qb4-source',stable:true,
    officialWeiGSupport:true,protocolGeneration:'qb4',
    preferenceKeys:['dht','pex','disk_cache_ttl','scheduler_enabled'],
    preferenceDescriptorStats:{total:4,setterPresent:4,typed:4,highConfidence:4,unresolved:0,structured:0},
    preferenceDescriptors:[
      {key:'dht',type:'boolean',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'pex',type:'boolean',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'disk_cache_ttl',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'scheduler_enabled',type:'boolean',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'}
    ],
    apiActions:['app/preferences','app/setPreferences','torrents/pause','torrents/resume']
  },
  {
    qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',sourceSha:'qb5-source',stable:true,
    officialWeiGSupport:true,protocolGeneration:'qb5',
    preferenceKeys:[
      'scheduler_enabled','schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min','scheduler_days',
      'limit_utp_rate','checking_memory_use','disk_cache_ttl','disk_io_read_mode','file_pool_size','memory_working_set_limit'
    ],
    preferenceDescriptorStats:{total:12,setterPresent:12,typed:12,highConfidence:12,unresolved:0,structured:0},
    preferenceDescriptors:[
      {key:'scheduler_enabled',type:'boolean',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'schedule_from_hour',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'schedule_from_min',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'schedule_to_hour',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'schedule_to_min',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'scheduler_days',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'limit_utp_rate',type:'boolean',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'checking_memory_use',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'disk_cache_ttl',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'disk_io_read_mode',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'file_pool_size',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'},
      {key:'memory_working_set_limit',type:'number',writable:true,setterPresent:true,source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'}
    ],
    apiActions:['app/preferences','app/setPreferences','torrents/start','torrents/stop']
  }
];

{
  const preferences={scheduler_enabled:true,schedule_from_hour:9,limit_utp_rate:true};
  const torrents=[{hash:'keep-me',name:'Persisted Torrent'}];
  const world={
    profile:{
      qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',sourceSha:null,stable:true,
      officialWeiGSupport:true,protocolGeneration:'qb5',
      preferenceKeys:['scheduler_enabled','schedule_from_hour','limit_utp_rate'],
      apiActions:['app/preferences','app/setPreferences']
    },
    preferences,
    torrents
  };
  const result=reconcileWorldProfile(world,catalog);
  assert.equal(result.changed,true,'persisted worlds with stale profile metadata must be migrated');
  assert.equal(world.profile.sourceSha,'qb5-source','migration must refresh upstream source truth');
  assert.deepEqual(world.profile.preferenceKeys,catalog[1].preferenceKeys,'migration must refresh the complete version preference surface');
  assert.deepEqual(world.profile.preferenceDescriptors,catalog[1].preferenceDescriptors,'migration must refresh source-derived preference descriptors');
  assert.deepEqual(world.profile.preferenceDescriptorStats,catalog[1].preferenceDescriptorStats,'migration must retain machine-readable descriptor coverage stats');
  assert.deepEqual(world.profile.apiActions,catalog[1].apiActions,'migration must refresh the complete version API surface');
  assert.equal(world.preferences,preferences,'migration must preserve persisted user preferences');
  assert.equal(world.torrents,torrents,'migration must preserve the existing Torrent world');

  const runtime=createPreferenceRuntime(world);
  const exposed=runtime.read();
  assert.deepEqual(Object.keys(exposed),catalog[1].preferenceKeys,'migrated runtime must expose every preference key for the selected qB version');
  assert.equal(exposed.scheduler_enabled,true,'persisted preference values must win over generated defaults');
  assert.equal(exposed.schedule_from_hour,9,'persisted numeric preferences must survive migration');
  assert.equal(exposed.disk_cache_ttl,60,'newly discovered known preferences must receive safe simulator defaults');
  assert.equal(exposed.checking_memory_use,32,'newly discovered advanced preferences must become immediately visible');
  const scheduleDescriptor=runtime.descriptors().find(item=>item.key==='schedule_from_hour');
  assert.equal(scheduleDescriptor.schemaSource,'UPSTREAM_SETTER','migrated worlds must immediately expose catalog parser provenance');
  assert.equal(scheduleDescriptor.sourceConfidence,'HIGH');
}

{
  const exact=catalog[1];
  const world={
    profile:{
      qbVersion:exact.qbVersion,webApiVersion:exact.webApiVersion,tag:exact.tag,sourceSha:exact.sourceSha,stable:true,
      officialWeiGSupport:true,protocolGeneration:exact.protocolGeneration,
      preferenceKeys:[...exact.preferenceKeys],
      apiActions:[...exact.apiActions]
    },
    preferences:{scheduler_enabled:false},torrents:[]
  };
  const result=reconcileWorldProfile(world,catalog);
  assert.equal(result.changed,true,'descriptor-only catalog improvements must migrate already-current IndexedDB worlds');
  assert.deepEqual(world.profile.preferenceDescriptors,exact.preferenceDescriptors);
}

{
  const world={
    profile:{qbVersion:'4.6.7',webApiVersion:'2.9.3',tag:'release-4.6.7',preferenceKeys:['dht'],apiActions:['app/preferences']},
    preferences:{dht:true},torrents:[]
  };
  const result=reconcileWorldProfile(world,catalog);
  assert.equal(result.changed,true);
  assert.equal(world.profile.qbVersion,'4.6.7','API requests without a qb query must retain the persisted qB version instead of jumping to the newest release');
  assert.deepEqual(world.profile.preferenceKeys,catalog[0].preferenceKeys,'qB4 worlds must migrate against their own exact release profile');
  assert.deepEqual(world.profile.preferenceDescriptors,catalog[0].preferenceDescriptors,'qB4 worlds must receive their own source-derived descriptor generation');
}

{
  const world={profile:{qbVersion:'4.5.5',preferenceKeys:['dht']},preferences:{dht:true},torrents:[]};
  const before=world.profile;
  const result=reconcileWorldProfile(world,catalog);
  assert.equal(result.changed,false,'a catalog that does not contain the exact persisted release must not silently migrate it to another version');
  assert.equal(world.profile,before);
}

console.log('Virtual qB persisted-profile migration contract passed: stale IndexedDB worlds refresh exact release keys, API actions and preference descriptors without losing torrents/user settings or crossing qB versions.');
