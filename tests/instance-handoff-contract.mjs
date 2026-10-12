import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TextEncoder,TextDecoder} from 'node:util';
const script=fs.readFileSync(new URL('../webui/public/instance-handoff.js',import.meta.url),'utf8');
function context(href,shared){
  const url=new URL(href),location={href:url.href,hash:url.hash},values=shared||new Map();
  const session={
    get:(key,fallback)=>values.has(key)?values.get(key):fallback,
    set:(key,value)=>{values.set(key,value);return true;},
    remove:key=>{values.delete(key);return true;}
  };
  const window={location,history:{state:null,replaceState(_state,_title,next){location.href=next;location.hash=new URL(next).hash;}},WeiG:{StorageRuntime:{session}}};
  const btoa=s=>Buffer.from(s,'binary').toString('base64'),atob=s=>Buffer.from(s,'base64').toString('binary');
  vm.runInNewContext(script,{window,URL,TextEncoder,TextDecoder,Uint8Array,btoa,atob,Date});
  return{handoff:window.WeiG.InstanceHandoff,values,location};
}
const from=context('http://source.local/');
const list=[{name:'本机 qB',url:'http://source.local/'},{name:'NAS qB',url:'http://192.168.1.73:8080/'}];
const target=from.handoff.urlFor('http://192.168.1.73:8080/',list,'http://source.local/');
assert.ok(target.startsWith('http://192.168.1.73:8080/#!weig-instances='));
assert.ok(!target.includes('password')&&!target.includes('SID='));
const dst=context(target);
assert.equal(dst.location.hash,'','incoming fragment must be removed before authenticated UI/router starts');
assert.equal(dst.handoff.peek().items.length,2);
assert.equal(dst.handoff.peek().items[0].name,'本机 qB');
assert.equal(dst.values.size,1,'entry only holds pending consent state, never writes the InstanceRegistry');
dst.handoff.consume();
assert.equal(dst.handoff.peek(),null);
const invalid=['http://user:secret@example.net/','https://host.test/?token=1','javascript:alert(1)'];
for(const url of invalid){
  assert.throws(()=>from.handoff.urlFor('https://dest.example/',[{name:'Bad',url}],'http://source.local/'));
}
const old=context('https://target.example/#!weig-instances=bad',new Map());
assert.equal(old.handoff.peek(),null);
assert.equal(old.location.hash,'','malformed handoff never lingers in URL');
assert.throws(()=>from.handoff.urlFor('https://dest.example/',Array.from({length:17},(_,i)=>({name:'qB '+i,url:'https://qb'+i+'.example/'})),'http://source.local/'));
console.log('Instance handoff contract passed: URL-fragment transport, pre-auth capture, origin-local pending consent, strict noncredential validation.');
