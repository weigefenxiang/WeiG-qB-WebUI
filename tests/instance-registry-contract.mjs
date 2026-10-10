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
for(const bad of ['javascript:alert(1)','https://user:pw@x.example/','https://x.example/?secret=1','https://x.example/#token','http://unsafe.example/','https://hub.example:8443/','https://hub.example/qb2/','https://nas.example/api/v2/app/version']){
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
assert.deepEqual(portableData.items.map(x=>x.name),['NAS renamed','VPS']);
const otherSaved=new Map(),otherWindow={location:{href:'https://vps.example/private/index.html',assign(){}},document:safeNavigationDocument([]),WeiG:{StorageRuntime:{local:{get:(k,d)=>otherSaved.has(k)?otherSaved.get(k):d,set:(k,v)=>{otherSaved.set(k,v);return true;}}}}};
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
assert.deepEqual(navigations,['https://nas.example/'],'switching must navigate with no Referrer in the current tab; never reuse qB Cookies or client state');
assert.ok(I.remove('https://vps.example/'));
assert.equal(I.list().length,1);
assert.ok(!source.includes('password:')&&!source.includes('token:'),'instance registry must only persist names and safe URLs, never credentials');
console.log('Instance registry contract passed: origin-local storage, URL validation, full-navigation isolation and header ownership.');
