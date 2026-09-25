import assert from 'node:assert/strict';
import {reconcileWorldProfile} from '../simulator/core/world-profile.js';
import {CURRENT_WORLD_SCHEMA_VERSION,VIRTUAL_PT_CATEGORIES,createWorld,logs,listTorrents} from '../simulator/core/engine.js';
import {upgradeWorldSchema} from '../simulator/core/world-schema.js';
import {TORRENT_NAME_POOL,TORRENT_NAME_POOL_PROVENANCE} from '../simulator/data/torrent-name-pool.js';
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

{
  const fresh=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:200,seed:'world-schema-current',now:1700000000000});
  assert.equal(fresh.schemaVersion,CURRENT_WORLD_SCHEMA_VERSION,'new worlds must carry the current simulator schema version');
}

{
  const legacy=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:500,seed:'world-schema-legacy',now:1700000000000});
  legacy.schemaVersion=1;
  const legacySynthetic=legacy.torrents[0];
  legacySynthetic.name='Open Archive · Collection 2026';
  legacySynthetic.contentPath='/downloads/archive/Open Archive · Collection 2026';
  const customName=legacy.torrents[1];
  customName.name='User Custom Torrent Name';
  legacy.logs=legacy.logs.filter(item=>[1,2].includes(Number(item.type)));
  const privateTargets=legacy.torrents.filter(t=>t.private===true).slice(0,12);
  assert.ok(privateTargets.length,'legacy migration fixture needs private torrents');
  privateTargets.forEach(t=>{t.category='Private';});
  legacy.categories={...legacy.categories,Private:{name:'Private',savePath:'/downloads/private'}};
  VIRTUAL_PT_CATEGORIES.forEach(name=>{delete legacy.categories[name];});

  const beforePublic=legacy.torrents.find(t=>t.private!==true);
  const beforePublicCategory=beforePublic.category;
  const result=upgradeWorldSchema(legacy,1700000005000);
  assert.equal(result.changed,true,'persisted pre-realism worlds must run the schema migration');
  assert.equal(result.from,1);
  assert.equal(result.to,CURRENT_WORLD_SCHEMA_VERSION);
  assert.ok(result.namesRemapped>=1,'legacy synthetic torrent names must migrate to the real-name snapshot');
  assert.notEqual(legacySynthetic.name,'Open Archive · Collection 2026');
  assert.ok(TORRENT_NAME_POOL.includes(legacySynthetic.name),'migrated synthetic name must come from the checked-in real-name pool');
  assert.equal(customName.name,'User Custom Torrent Name','world migration must preserve user/custom names');
  assert.ok(result.privateRemapped>=privateTargets.length,'legacy Private torrents must be remapped into PT categories');
  assert.deepEqual(new Set(logs(legacy,-1).map(item=>Number(item.type))),new Set([1,2,4,8]),'legacy worlds must gain missing Warning/Critical log levels');
  for(const name of VIRTUAL_PT_CATEGORIES)assert.ok(legacy.categories[name],`migrated world must expose PT category ${name}`);
  for(const t of privateTargets)assert.ok(VIRTUAL_PT_CATEGORIES.includes(t.category),`private torrent must migrate away from legacy Private category: ${t.category}`);
  assert.equal(beforePublic.category,beforePublicCategory,'world migration must not rewrite unrelated public categories');
  const views=listTorrents(legacy,{limit:5000,now:1700000005000});
  assert.ok(views.filter(row=>row.private===true).every(row=>!row.category||VIRTUAL_PT_CATEGORIES.includes(row.category)),'qB5 private rows must project migrated PT categories');
  const second=upgradeWorldSchema(legacy,1700000010000);
  assert.equal(second.changed,false,'world schema migration must be idempotent once current');
}

{
  assert.equal(TORRENT_NAME_POOL.length,1000,'checked-in real torrent-name snapshot must contain exactly 1000 names');
  assert.equal(TORRENT_NAME_POOL_PROVENANCE.retained,1000);
  assert.equal(TORRENT_NAME_POOL_PROVENANCE.ascii,900);
  assert.equal(TORRENT_NAME_POOL_PROVENANCE.nonAscii,100);
  assert.equal(new Set(TORRENT_NAME_POOL.map(name=>name.normalize('NFKC').toLocaleLowerCase())).size,1000,'real name snapshot must remain unique after NFKC/case folding');
  assert.ok(TORRENT_NAME_POOL.every(name=>!/(?:magnet:\?|urn:btih|https?:\/\/|www\.)/i.test(name)),'name snapshot must not retain network/download identifiers');
}
console.log('Virtual qB persisted-profile/schema migration contract passed: stale IndexedDB worlds refresh source profiles, four log levels, PT categories and legacy synthetic names while preserving user/custom names.');
