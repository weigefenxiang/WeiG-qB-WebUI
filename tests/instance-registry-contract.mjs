import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../webui/private/scripts/instance-registry.js',import.meta.url),'utf8');
const head=fs.readFileSync(new URL('../webui/private/scripts/header.js',import.meta.url),'utf8');
const headerCss=fs.readFileSync(new URL('../webui/private/css/header.css',import.meta.url),'utf8');
assert.ok(headerCss.includes('@media(max-width:479px){#instances-btn{display:none!important}}'),'Narrow Header must hide the duplicate Instances action to preserve viewport geometry');
assert.ok(head.includes("nav.appendChild(mobileLink(instanceCopy('title','Instances')"),'A narrow Header may hide the button only while the single mobile Drawer entry remains available');

const plan=JSON.parse(fs.readFileSync(new URL('../webui/private/bootstrap-plan.json',import.meta.url),'utf8'));
assert.ok(plan.phases.some(x=>x.name==='shared-ui'&&x.scripts.includes('scripts/instance-registry.js')),'one instance registry must load before the Header owner');
assert.ok(head.includes('function installInstancesButton()')&&head.includes('function openInstances()')&&head.includes('D.create({className:'),'Header must consume the canonical DialogRuntime and InstanceRegistry');
assert.ok(head.includes('registry.exportList()')&&head.includes('registry.importList(paste.value)')&&head.includes('W.Clipboard.copyText'),'Header must expose the portable instance list through the canonical registry and clipboard owner');
const saved=new Map(),navigations=[];
const storage={get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>{saved.set(k,v);return true;}};
const location={href:'https://hub.example/public/index.html',protocol:'https:',hostname:'hub.example',assign:(v)=>navigations.push(v)};
const w={location,WeiG:{StorageRuntime:{local:storage}}};
vm.runInNewContext(source,{window:w,URL});
const I=w.WeiG.InstanceRegistry;
assert.equal(I.currentUrl(),'https://hub.example/');
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
I.remove('https://shared.example:8080/');
for(const bad of ['javascript:alert(1)','https://user:pw@x.example/','https://x.example/?secret=1','https://x.example/#token','http://unsafe.example/','https://hub.example:8443/','https://hub.example/qb2/','https://nas.example/api/v2/app/version']){
  assert.throws(()=>I.add('bad',bad),'unsafe instance address must fail: '+bad);
}
const portable=I.exportList();
const portableData=JSON.parse(portable);
assert.equal(portableData.schemaVersion,1);
assert.deepEqual(portableData.items.map(x=>x.name),['NAS renamed','VPS']);
const otherSaved=new Map(),otherWindow={location:{href:'https://vps.example/private/index.html',assign(){}},WeiG:{StorageRuntime:{local:{get:(k,d)=>otherSaved.has(k)?otherSaved.get(k):d,set:(k,v)=>{otherSaved.set(k,v);return true;}}}}};
vm.runInNewContext(source,{window:otherWindow,URL});
const other=otherWindow.WeiG.InstanceRegistry;
const first=other.importList(portable);
assert.equal(first.added,2,'portable nonsecret list should initialize a different origin without accessing Cookies');
assert.equal(other.list().length,2);
assert.equal(other.importList(portable).updated,2,'reimport must update known entries without duplicating them');
const snapshot=other.exportList();
for(const invalid of [
  '{bad json',JSON.stringify({schemaVersion:2,items:[]}),
  JSON.stringify({schemaVersion:1,items:[{name:'Bad',url:'https://bad.example/',password:'hidden'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'Bad',url:'http://downgrade.example/'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'A',url:'https://a.example/'},{name:'B',url:'https://a.example/'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'A',url:'https://remote.example:8080/'},{name:'B',url:'https://remote.example:9090/'}]}),
  JSON.stringify({schemaVersion:1,items:[{name:'A',url:'https://remote.example/qb1/'},{name:'B',url:'https://remote.example/qb2/'}]}),
  'x'.repeat(32769)
]){
  assert.throws(()=>other.importList(invalid),'invalid imported registry must be rejected atomically');
  assert.equal(other.exportList(),snapshot,'invalid registry must not mutate stored instances');
}
I.switchTo('https://nas.example/');
assert.deepEqual(navigations,['https://nas.example/'],'switching must navigate the full document, never reuse existing qB Cookies/client state');
assert.ok(I.remove('https://vps.example/'));
assert.equal(I.list().length,1);
assert.ok(!source.includes('password:')&&!source.includes('token:'),'instance registry must only persist names and safe URLs, never credentials');
console.log('Instance registry contract passed: origin-local storage, URL validation, full-navigation isolation and header ownership.');
