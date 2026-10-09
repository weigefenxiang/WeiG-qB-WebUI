import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let certified=false,allowRead=false,allowAdd=false,actionKnown=true;
const calls=[];
const W={
 util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
 I18n:{t:key=>key},
 CapabilityRegistry:{
   isCertified:()=>certified,
   allowsReadOperation:(endpoint,method)=>allowRead&&endpoint==='clientdata/load'&&method==='POST',
   allowsWriteOperation:(endpoint,method,sourceAction,body)=>allowAdd&&endpoint==='torrents/add'&&method==='POST'&&sourceAction==='torrentscontroller.h:addAction'&&body&&typeof body.keys==='function'&&[...body.keys()].every(key=>key==='urls'||key==='category'||key==='torrents'),
   sourceActionDescriptor:action=>!actionKnown?null:action==='clientdatacontroller.h:loadAction'?{sourceAction:action,parameters:['keys']}:action==='torrentscontroller.h:addAction'?{sourceAction:action,parameters:['urls','category']}:null
 }
};
const window={WeiG:W};
const fetchMock=async(url,init)=>{calls.push({url:String(url),method:init.method,body:String(init.body||''),fields:init.body&&typeof init.body.keys==='function'?[...init.body.keys()]:[]});return new Response(String(url).endsWith('/torrents/add')?'Ok.':JSON.stringify({qbt_date_format:'yyyy-MM-dd'}),{status:200});};
vm.runInNewContext(source,{window,fetch:fetchMock,URLSearchParams,FormData,Response,Blob,AbortController,setTimeout,clearTimeout,console});
const c=new W.QBClient();
await c.request('app/preferences');
assert.equal(calls.at(-1).method,'GET');
await assert.rejects(c.getClientData(['date_format']),/api.writeBlocked/,'unproven POST read blocked');
assert.equal(calls.length,1);
allowRead=true;
const result=await c.getClientData(['date_format']);
assert.equal(result.date_format,'yyyy-MM-dd','source-proven inherited POST read returns actual ClientData');
assert.equal(calls.at(-1).url,'api/v2/clientdata/load');
assert.deepEqual(JSON.parse(new URLSearchParams(calls.at(-1).body).get('keys')),['qbt_date_format']);
const count=calls.length;
await assert.rejects(c.request('clientdata/store',{method:'POST',form:{data:'{}'}}),/api.writeBlocked/);
await assert.rejects(c.request('app/setPreferences',{method:'POST',form:{json:'{}'}}),/api.writeBlocked/);
await assert.rejects(c.request('torrents/add',{method:'POST'}),/api.writeBlocked/);
await assert.rejects(c.request('future/mutation',{method:'PATCH'}),/api.writeBlocked/);
assert.equal(calls.length,count,'unknown/dangerous mutations must make zero HTTP requests');

allowAdd=true;
await assert.rejects(c.request('torrents/add',{method:'POST'}),/api.writeBlocked/,'raw POST without an operation proof is still denied');
await assert.rejects(c.request('app/setPreferences',{method:'POST',sourceAction:'torrentscontroller.h:addAction'}),/api.writeBlocked/,'proof for torrent addition cannot unlock Settings');
await c.add('magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',[],null,{});
assert.equal(calls.at(-1).url,'api/v2/torrents/add','inherited source-proven torrent addition must reach the canonical endpoint');
assert.deepEqual(calls.at(-1).fields,['urls'],'add passes only audited source action fields');
allowAdd=false;
await assert.rejects(c.add('magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',[],null,{}),/api.writeBlocked/,'changed WebAPI or unproven inherited add must fail closed');
allowRead=false;
await assert.rejects(c.getClientData(['date_format']),/api.writeBlocked/);
actionKnown=false;
await assert.rejects(c.getClientData(['date_format']),/api.actionUnproven/);
certified=true;
await c.request('app/setPreferences',{method:'POST',form:{json:'{}'},type:'void'});
assert.equal(calls.at(-1).url,'api/v2/app/setPreferences','certified write unaffected');
certified=false;
await c.request('auth/login',{method:'POST',form:{username:'test',password:'test'},type:'text'});
assert.equal(calls.at(-1).url,'api/v2/auth/login','auth before detection unaffected');
console.log('QB operation semantics PASS: inherited source-proven POST read and additive torrent operation, fail-closed unknown writes, certified/auth unaffected.');
