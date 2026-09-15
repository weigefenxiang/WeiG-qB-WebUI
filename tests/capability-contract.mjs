import fs from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../webui/private/',import.meta.url);
const read=rel=>fs.readFile(new URL(rel,root),'utf8');
const source=await read('scripts/capabilities.js');
const settingsSource=await read('scripts/settings-schema.js');
const core=JSON.parse(await read('data/capabilities.json'));
function assert(ok,msg){if(!ok)throw new Error(msg);}
assert(core.schemaVersion===2&&core.features&&Array.isArray(core.releases),'capabilities.json must be the compact core contract');
assert(!JSON.stringify(core).includes('profilePath'),'compact core must not retain runtime profile routing');
assert(core.schemaVersion===2&&core.features&&Array.isArray(core.releases)&&core.releases.length===65,'compact core must cover 65 stable releases');
assert(core.releases[0].qbVersion==='4.1.0'&&core.releases.at(-1).qbVersion==='5.2.3','stable release floor/latest drift');
assert(core.features.renameFile.upstream.action==='torrentscontroller.h:renameFileAction','renameFile source action lost');
assert(core.features.renameFolder.upstream.action==='torrentscontroller.h:renameFolderAction','renameFolder source action lost');
assert(core.features.trackerEditUrl.upstream.actionParameter.parameter==='url','trackerEditUrl parameter proof lost');
const document={addEventListener(){},querySelectorAll(){return[];},createElement(){return{classList:{add(){},remove(){},toggle(){}},dataset:{},setAttribute(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];}};},body:{appendChild(){}}};
const window={document,addEventListener(){},dispatchEvent(){},requestAnimationFrame:fn=>fn(),WeiG:{buildAssetUrl:x=>x,util:{parseScalar:x=>x},I18n:{getLocale:()=> 'en-US'}}};window.window=window;
const fetch=async path=>{const rel=String(path).replace(/^.*?data\//,'data/');const text=await read(rel);return{ok:true,status:200,json:async()=>JSON.parse(text),text:async()=>text};};
const context={window,document,fetch,console,CustomEvent:class{},requestAnimationFrame:fn=>fn()};
vm.runInNewContext(settingsSource,context,{filename:'settings-schema.js'});
vm.runInNewContext(source,context,{filename:'capabilities.js'});
const C=window.WeiG.CapabilityRegistry,S=window.WeiG.SettingsSchema;
assert(!source.includes('ReleaseProfile'),'CapabilityRegistry must not depend on ReleaseProfile runtime');
assert(C.compareVersions('4.9.3','5.0.0')<0&&C.matchRange('4.9.3',{gte:'4.2.0',lt:'5.0.0'}),'version rule helpers drifted');
for(const [qb,api,mode,cert] of [['4.1.0','2.0.0','EXACT',true],['5.2.3','2.15.1','EXACT',true],['5.2.3+custom','2.15.1','EQUIVALENT',true],['5.2.4','2.15.1','INHERITED',false],['6.0.0','3.0.0','FALLBACK',false]]){
 const client={qbVersion:qb,webApiVersion:api,capabilities:{}};await C.bind(client);const r=C.releaseIdentity();
 assert(r.resolutionMode===mode&&r.certified===cert,`${qb}: resolution ${JSON.stringify(r)} expected ${mode}/${cert}`);
 if(mode==='INHERITED'||mode==='FALLBACK')assert(!C.hasWriteProvenance(),`${qb}: non-certified release must fail closed for writes`);
}
await C.bind({qbVersion:'5.2.3',webApiVersion:'2.15.1',capabilities:{}});
assert(C.supports('privateFilter')&&C.supports('tagFacet')&&C.supports('settingsWrite'),'latest exact read/write capabilities missing');
assert(C.hasAction('torrentscontroller.h:renameFileAction'),'renameFile action missing');
const rename=C.sourceActionDescriptor('torrentscontroller.h:renameFileAction');
assert(rename&&rename.parameters.includes('oldPath')&&rename.parameters.includes('newPath'),'renameFile exact parameter contract missing');
assert(S.isWritable('locale','en-US'),'latest exact Settings locale must be writable');
await C.bind({qbVersion:'5.2.4',webApiVersion:'2.15.1',capabilities:{}});
assert(C.supports('contentPath')&&!C.supports('settingsWrite'),'inherited release must retain proven reads but fail closed writes');
assert(!S.isWritable('locale','en-US'),'inherited Settings write must fail closed');
console.log('Capability compact-contract test passed.');
