import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../webui/private/scripts/instance-registry.js',import.meta.url),'utf8');

const plan=JSON.parse(fs.readFileSync(new URL('../webui/private/bootstrap-plan.json',import.meta.url),'utf8'));
const navigation=fs.readFileSync(new URL('../webui/private/scripts/navigation.js',import.meta.url),'utf8');
assert.ok(!plan.phases.some(x=>x.scripts.includes('scripts/instance-registry.js')),'Registry should be deferred, not startup-owned');
assert.ok(navigation.includes("['scripts/instance-registry.js','scripts/instance-health.js','scripts/instance-peer-bridge.js','scripts/instances-ui.js']")&&navigation.includes('loadInstances:loadInstances'),'Navigation owns ordered deferred instance modules');
function safeNavigationDocument(navigations){
  return{
    body:{appendChild(anchor){assert.equal(anchor.tagName,'A');}},
    createElement(tag){
      assert.equal(tag,'a');
      return{tagName:'A',href:'',target:'',rel:'',referrerPolicy:'',hidden:false,
        click(){
          assert.equal(this.rel,'noreferrer','cross-qB navigation must not send Referer');
          assert.equal(this.referrerPolicy,'no-referrer','cross-qB navigation must suppress Referrer by policy');
          assert.equal(this.target,'_self','cross-qB navigation must replace the entire page');
          navigations.push(this.href);
        },remove(){}
      };
    }
  };
}
const saved=new Map(),navigations=[];
const storage={get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>{saved.set(k,v);return true;}};
const location={href:'https://hub.example/public/index.html',protocol:'https:',hostname:'hub.example',assign:(v)=>navigations.push(v)};
const w={location,document:safeNavigationDocument(navigations),WeiG:{StorageRuntime:{local:storage}}};
vm.runInNewContext(source,{window:w,URL});
const I=w.WeiG.InstanceRegistry;
assert.equal(I.currentUrl(),'https://hub.example/');
for(const [href,expected] of [
  ['https://site.example/index.html','https://site.example/'],
  ['https://site.example/qb/index.html','https://site.example/qb/'],
  ['https://site.example/qb/private/index.html','https://site.example/qb/'],
  ['https://site.example/qb/public/','https://site.example/qb/']
]){
  const navigated=[],savedRoot=new Map(),browser={
    location:{href,assign:url=>navigated.push('unsafe:'+url)},
    document:safeNavigationDocument(navigated),
    WeiG:{StorageRuntime:{local:{
      get:(key,fallback)=>savedRoot.has(key)?savedRoot.get(key):fallback,
      set:(key,value)=>{savedRoot.set(key,value);return true;}
    }}}
  };
  vm.runInNewContext(source,{window:browser,URL});
  const owner=browser.WeiG.InstanceRegistry;
  assert.equal(owner.currentUrl(),expected,'Current URL must normalize the actual Alternative WebUI entry route: '+href);
  assert.equal(owner.add('This server',href).url,expected,'Saved instances must identify the same canonical server root');
  assert.equal(owner.add('This server',expected).url,expected,'Adding the canonical root must update instead of duplicating');
  assert.equal(owner.list().length,1);
  assert.equal(owner.switchTo(href),true);
  assert.deepEqual(navigated,[],'Same-origin normalized index.html must not need a session-destroying navigation');
}

assert.deepEqual(Array.from(I.list()),[]);
I.add('NAS','https://nas.example/private/index.html');
I.add('VPS','https://vps.example/');
assert.equal(I.list().length,2);
assert.equal(I.list()[0].url,'https://nas.example/');
I.add('NAS renamed','https://nas.example/');
assert.equal(I.list().length,2,'updating an instance must not duplicate its identity');
assert.equal(I.list()[0].name,'NAS renamed');
I.add('Remote','https://shared.example:8080/');
assert.throws(()=>I.add('Remote port','https://shared.example:9090/'),/different ports/,'saved instances must be mutually cookie-isolated even when neither is the current origin');
assert.throws(()=>I.add('Remote path','https://shared.example:8080/qb2/'),/different paths/,'saved instances must not use unverified path-based routing');
assert.equal(I.list().length,3,'rejected conflicting instances must leave the saved registry intact');
const untrusted=JSON.parse(saved.get('weig.instances.v1'));
untrusted.items.push({name:'Remote collision',url:'https://shared.example:9090/'});
saved.set('weig.instances.v1',JSON.stringify(untrusted));
assert.deepEqual(Array.from(I.list(),x=>x.name),['NAS renamed','VPS','Remote'],'older saved conflicting entries must be excluded without persisting a mutation');
assert.equal(JSON.parse(saved.get('weig.instances.v1')).items.length,4,'a read must not silently rewrite persisted user data');
const compromised=saved.get('weig.instances.v1');
assert.throws(()=>I.add('Would drop old entries','https://fresh.example/'),/refusing to overwrite/,'new writes must not silently discard rejected historical entries');
assert.throws(()=>I.remove('https://shared.example:8080/'),/refusing to overwrite/,'removing a safe entry must not wipe unrelated rejected records');
assert.throws(()=>I.importList(JSON.stringify({schemaVersion:1,items:[{name:'Another',url:'https://other.example/'}]})),/refusing to overwrite/,'import must not mutate an unsafe historical snapshot');
assert.equal(saved.get('weig.instances.v1'),compromised,'blocked mutations must preserve raw storage bytes');
saved.set('weig.instances.v1',JSON.stringify({schemaVersion:1,items:Array.from(I.list())}));
I.remove('https://shared.example:8080/');
assert.equal(I.add('HTTP LAN','http://lan.example/').url,'http://lan.example/');
assert.throws(()=>I.switchTo('http://lan.example/'),/explicit confirmation/);
assert.ok(I.remove('http://lan.example/'));
for(const bad of ['javascript:alert(1)','https://user:pw@x.example/','https://x.example/?secret=1','https://x.example/#token','https://hub.example:8443/','https://hub.example/qb2/','https://nas.example/api/v2/app/version']){
  assert.throws(()=>I.add('bad',bad),'unsafe instance address must fail: '+bad);
}
for(const raw of ['{unparseable',JSON.stringify({schemaVersion:2,items:[{name:'Future',url:'https://future.example/'}]}),JSON.stringify({schemaVersion:1,items:[{name:'Existing',url:'https://good.example/',secret:'do-not-erase'}]})]){
  const old=saved.get('weig.instances.v1');
  saved.set('weig.instances.v1',raw);
  assert.equal(I.list().length,raw.startsWith('{unparseable')?0:raw.includes('schemaVersion":2')?0:0,'a malformed/future saved snapshot must never be mistaken for authorized writable state');
  assert.throws(()=>I.add('New','https://new.example/'),/refusing to overwrite/);
  assert.equal(saved.get('weig.instances.v1'),raw,'future or damaged schema must survive rejected mutation byte-for-byte');
  saved.set('weig.instances.v1',old);
}
const portable=I.exportList();
const portableData=JSON.parse(portable);
assert.equal(portableData.schemaVersion,1);
assert.ok(source.includes('items:load(true)}'),'Export must fail closed rather than silently backing up an empty list if persistent storage is damaged');
assert.deepEqual(portableData.items.map(x=>x.name),['NAS renamed','VPS']);
const otherSaved=new Map(),otherWindow={location:{href:'https://vps.example/private/index.html',assign(){}},document:safeNavigationDocument([]),WeiG:{StorageRuntime:{local:{get:(k,d)=>otherSaved.has(k)?otherSaved.get(k):d,set:(k,v)=>{otherSaved.set(k,v);return true;}}}}};
vm.runInNewContext(source,{window:otherWindow,URL});
const other=otherWindow.WeiG.InstanceRegistry;
// An unregistered current URL is a real missing name, not an implicit saved record.
const ownSaved=new Map(),ownWindow={location:{href:'https://vps.example/private/index.html'},document:safeNavigationDocument([]),WeiG:{StorageRuntime:{local:{
  get:(k,d)=>ownSaved.has(k)?ownSaved.get(k):d,set:(k,v)=>{ownSaved.set(k,v);return true;}
}}}};
vm.runInNewContext(source,{window:ownWindow,URL});
const ownRegistry=ownWindow.WeiG.InstanceRegistry;
assert.equal(ownRegistry.defaultName('https://vps.example/'),'vps.example');
assert.equal(ownRegistry.previewIncoming(portable).pending.length,2,'Own unsaved URL must not be marked existing');
const ownChoice=JSON.stringify({schemaVersion:1,items:[{name:'520',url:'https://vps.example/'}]});
assert.equal(ownRegistry.importMissing(ownChoice).added,1,'First approved transfer must save current nickname');
assert.equal(ownRegistry.list().find(item=>item.url==='https://vps.example/').name,'520');
assert.equal(ownRegistry.previewIncoming(portable).pending.length,1,'Saved current nickname is no longer pending');
assert.equal(ownRegistry.importMissing(ownChoice).added,0,'Repeat must not reimport current nickname');
assert.equal(ownRegistry.list().find(item=>item.url==='https://vps.example/').name,'520','Local nickname wins over foreign proposal');
const first=other.importList(portable);
assert.equal(first.added,2,'portable nonsecret list should initialize a different origin without accessing Cookies');
assert.equal(other.list().length,2);
assert.equal(other.importList(portable).updated,2,'reimport must update known entries without duplicating them');
const previousBytes=otherSaved.get('weig.instances.v1');
assert.equal(other.previewIncoming(portable).pending.length,0,'Existing entries must not trigger another import dialog');
assert.equal(other.importMissing(portable).added,0);
assert.equal(otherSaved.get('weig.instances.v1'),previousBytes,'No change must avoid storage writes');
const proposal=JSON.stringify({schemaVersion:1,items:[
  {name:'Another name for VPS',url:'https://vps.example/'},
  {name:'New 1',url:'https://fresh.example/'},
  {name:'New 2',url:'https://fresh2.example/'}
]});
assert.equal(other.previewIncoming(proposal).pending.length,2);
assert.equal(other.previewIncoming(proposal).items.length,3,'Preview must include existing rows alongside new rows');
const selected=JSON.stringify({schemaVersion:1,items:[{name:'New 2',url:'https://fresh2.example/'}]});
assert.equal(other.importMissing(selected).added,1,'Only selected new rows are imported');
assert.equal(other.list().some(item=>item.url==='https://fresh.example/'),false,'Excluded URL must never be saved');
other.update('https://fresh2.example/','My nickname','https://fresh2.example/');
assert.equal(other.importMissing(selected).added,0);
assert.equal(other.list().find(item=>item.url==='https://fresh2.example/').name,'My nickname','Existing name is never overwritten by a handoff');
const snapshot=other.exportList();
for(const invalid of [
  '{bad json',JSON.stringify({schemaVersion:2,items:[]}),
  JSON.stringify({schemaVersion:1,items:[{name:'Bad',url:'https://bad.example/',password:'hidden'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'A',url:'https://a.example/'},{name:'B',url:'https://a.example/'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'A',url:'https://remote.example:8080/'},{name:'B',url:'https://remote.example:9090/'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'A',url:'https://remote.example/qb1/'},{name:'B',url:'https://remote.example/qb2/'}]}),
  'x'.repeat(32769)
]){
  assert.throws(()=>other.importList(invalid),'invalid imported registry must be rejected atomically');
  assert.equal(other.exportList(),snapshot,'invalid registry must not mutate stored instances');
}
I.switchTo('https://nas.example/');
assert.deepEqual(navigations,['https://nas.example/'],'switching must navigate with no Referrer in the current tab; never reuse qB Cookies or client state');
assert.ok(I.remove('https://vps.example/'));
assert.equal(I.list().length,1);
assert.ok(!source.includes('password:')&&!source.includes('token:'),'instance registry must only persist names and safe URLs, never credentials');
const beforeEdit=I.list().length;
const edited=I.update('https://nas.example/','NAS moved','https://nas-moved.example/');
assert.equal(edited.url,'https://nas-moved.example/');
assert.equal(I.list().length,beforeEdit,'Atomic editing must not add a second record');
assert.throws(()=>I.update('https://nas.example/','Old','https://again.example/'),/no longer exists/);
console.log('Instance registry contract passed: origin-local storage, URL validation, full-navigation isolation and header ownership.');

assert.ok(source.includes("options.transfer===true"),'Only explicit navigation can request a nonsecret list handoff');
