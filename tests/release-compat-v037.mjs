import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const matrix=JSON.parse(fs.readFileSync(path.join(here,'fixtures/qb-compat-matrix.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');

class TestFormData {
  constructor(){this.entries=[];}
  append(name,value,filename){this.entries.push({name,value,filename});}
}

const sandbox={
  console,
  URLSearchParams,
  FormData:TestFormData,
  Blob,
  fetch:async()=>{throw new Error('Unexpected fetch');},
  window:{
    WeiG:{
      util:{
        form(obj){
          const p=new URLSearchParams();
          for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));
          return p.toString();
        }
      },
      I18n:{getLocale:()=> 'en'}
    }
  }
};
sandbox.window.window=sandbox.window;
vm.runInNewContext(source,sandbox,{filename:'qb-client.js'});
const Client=sandbox.window.WeiG.QBClient;

async function detect(fixture){
  const c=new Client();
  c.request=async p=>{
    if(p==='app/version')return fixture.qbVersion==='master'?'v5.3.0alpha1':fixture.qbVersion.includes('synthetic')?'v6.0.0':`v${fixture.qbVersion}`;
    if(p==='app/webapiVersion')return fixture.webApiVersion.replace('-synthetic','');
    throw new Error(`Unexpected detect endpoint ${p}`);
  };
  await c.detect();
  return c;
}

function capture(client){
  const calls=[];
  client.request=async(path,options={})=>{calls.push({path,options});return null;};
  return calls;
}

function extractLoginClassifier(file){
  const text=fs.readFileSync(file,'utf8');
  const match=text.match(/function classifyLogin\(x\)\{[\s\S]*?return'unexpected';\}/);
  assert.ok(match,`${path.relative(root,file)} must expose the login response classifier`);
  return vm.runInNewContext(`(${match[0]})`);
}

for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html']){
  const file=path.join(root,rel);
  assert.ok(fs.statSync(file).isFile(),`required Alternate WebUI entry point missing: ${rel}`);
}

for(const rel of ['webui/public/index.html','webui/public/login.html']){
  const classify=extractLoginClassifier(path.join(root,rel));
  assert.equal(classify({status:200,ok:true,text:'Ok.'}),'ok',`${rel}: legacy 200/Ok login`);
  assert.equal(classify({status:204,ok:true,text:''}),'ok',`${rel}: modern 204 login`);
  assert.equal(classify({status:200,ok:true,text:'Fails.'}),'bad',`${rel}: legacy bad credentials`);
  assert.equal(classify({status:401,ok:false,text:'Unauthorized'}),'bad',`${rel}: modern bad credentials`);
  assert.equal(classify({status:403,ok:false,text:'Forbidden'}),'banned',`${rel}: temporary ban`);
}

let realCount=0;
for(const fixture of matrix.fixtures){
  const c=await detect(fixture);
  const api=fixture.webApiVersion.replace('-synthetic','');
  const tag=`qB ${fixture.qbVersion} / WebAPI ${fixture.webApiVersion}`;
  if(fixture.realRelease)realCount++;

  if(/^4\./.test(fixture.qbVersion)){
    assert.equal(c.major,4,`${tag}: major`);
    assert.equal(c.capabilities.legacy4,true,`${tag}: legacy4`);
    assert.equal(c.capabilities.modern5,false,`${tag}: modern5`);
    assert.equal(c.capabilities.certified,true,`${tag}: certified`);
  }
  if(/^5\./.test(fixture.qbVersion)||fixture.qbVersion==='master'){
    assert.equal(c.capabilities.modern5,true,`${tag}: modern5`);
    assert.equal(c.capabilities.certified,true,`${tag}: certified`);
  }
  if(fixture.role==='forward-major-sentinel'){
    assert.equal(c.major,6,`${tag}: forward-major detection`);
    assert.equal(c.capabilities.certified,false,`${tag}: sentinel must not be certified`);
  }

  if(fixture.capabilities?.logs!==undefined)assert.equal(c.capabilities.logs,fixture.capabilities.logs,`${tag}: logs capability mismatch`);
  if(fixture.capabilities?.exactPrivateFlag!==undefined)assert.equal(c.capabilities.privateFlag,fixture.capabilities.exactPrivateFlag,`${tag}: private capability mismatch`);
  if(fixture.capabilities?.structuredAdd!==undefined)assert.equal(c.capabilities.structuredTorrentAdd,fixture.capabilities.structuredAdd,`${tag}: structured add mismatch`);

  if(fixture.realRelease){
    const actionCalls=capture(c);
    await c.resume('abc');
    await c.pause('abc');
    if(c.major>=5){
      assert.equal(actionCalls[0].path,'torrents/start',`${tag}: resume bridge`);
      assert.equal(actionCalls[1].path,'torrents/stop',`${tag}: pause bridge`);
    }else{
      assert.equal(actionCalls[0].path,'torrents/resume',`${tag}: resume bridge`);
      assert.equal(actionCalls[1].path,'torrents/pause',`${tag}: pause bridge`);
    }

    const filterCalls=capture(c);
    await c.getTorrents({filter:c.major>=5?'paused':'stopped'});
    assert.match(filterCalls[0].path,c.major>=5?/filter=stopped/:/filter=paused/,`${tag}: stopped/paused vocabulary bridge`);

    const editCalls=capture(c);
    await c.editTracker('hash','https://old.invalid/announce','https://new.invalid/announce');
    const form=editCalls[0].options.form;
    if(c.capabilities.trackerEditUrl){
      assert.equal(form.url,'https://old.invalid/announce',`${tag}: modern editTracker parameter`);
      assert.equal('origUrl' in form,false,`${tag}: legacy editTracker parameter leaked`);
    }else{
      assert.equal(form.origUrl,'https://old.invalid/announce',`${tag}: legacy editTracker parameter`);
      assert.equal('url' in form,false,`${tag}: modern editTracker parameter leaked`);
    }
  }

  const expectedTags=(()=>{
    const [a,b,c0]=api.split('.').map(x=>Number.parseInt(x,10)||0);
    return a>2||(a===2&&(b>3||(b===3&&c0>=0)));
  })();
  if(fixture.realRelease)assert.equal(c.capabilities.tags,expectedTags,`${tag}: tag capability threshold`);
}

assert.ok(realCount>=10,'release compatibility gate must cover at least 10 real qBittorrent releases');
assert.ok(matrix.releaseGate.length>=10,'release gate must retain broad 4.x/5.x coverage');
console.log(`Release compatibility gate passed: ${realCount} real qBittorrent releases + ${matrix.fixtures.length-realCount} upstream/sentinel nodes; legacy/modern auth, action, filter, tracker, capability and Alternate WebUI entry contracts verified.`);
