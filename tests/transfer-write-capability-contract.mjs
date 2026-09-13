import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [registry,capabilitySource,transferSource]=await Promise.all([
  fs.readFile(new URL('../webui/private/data/capabilities.json',import.meta.url),'utf8').then(JSON.parse),
  fs.readFile(new URL('../webui/private/scripts/capabilities.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../webui/private/scripts/transfer.js',import.meta.url),'utf8')
]);
const TOGGLE='transfercontroller.h:toggleSpeedLimitsModeAction';
const SET_DL='transfercontroller.h:setDownloadLimitAction';
const SET_UL='transfercontroller.h:setUploadLimitAction';
const SET_PREFS='appcontroller.h:setPreferencesAction';
const NORMAL=[SET_DL,SET_UL,TOGGLE];
const ALT=[SET_PREFS,TOGGLE];
assert.deepEqual(registry.features.globalSpeedLimitWrite.upstream.allActions,NORMAL,'normal rate-limit Apply must require both global setters plus speed-mode toggle');
assert.deepEqual(registry.features.altSpeedLimitWrite.upstream.allActions,ALT,'alternative rate-limit Apply must require setPreferences plus speed-mode toggle');
for(const id of ['globalSpeedLimitWrite','altSpeedLimitWrite']){
  assert.equal(registry.features[id].sourceRequired,true,`${id} must fail closed without source evidence`);
  assert.equal(registry.features[id].writeRequired,true,`${id} must require current-release write provenance`);
}
assert.match(capabilitySource,/Array\.isArray\(upstream\.allActions\).*every/s,'CapabilityRegistry must support conjunctive allActions source ownership');
assert.match(transferSource,/function limitWriteCapability\(\)/,'Transfer must own the active normal\/alternative write capability explicitly');
assert.match(transferSource,/W\.CapabilityRegistry\.decorate\(apply,limitWriteCapability\(\)\)/,'Transfer must decorate the dynamic Apply button at render time');
assert.match(transferSource,/if\(W\.CapabilityRegistry&&!W\.CapabilityRegistry\.supports\(capability\)\)/,'applyLimits must preflight the active composite capability before any write');
assert.match(transferSource,/applyButton\.id='transfer-limit-apply'/,'Transfer Apply must expose one stable runtime control owner');

let profile=null;
const releaseProfile={
  bind:async()=>profile,
  current:()=>profile,
  hasWriteProvenance(){return !!(profile&&profile.fallback!==true&&(profile.resolutionMode==='EXACT'||profile.resolutionMode==='EQUIVALENT'));},
  hasAction(action){return !!(profile&&Array.isArray(profile.apiActions)&&profile.apiActions.includes(action));},
  actionDescriptor(){return null;},supportsTorrentFilter(){return false;},hasInfoParameter(){return false;},hasTorrentInfoField(){return false;}
};
const document={addEventListener(){},querySelectorAll(){return[];},createElement(){return{children:[],classList:{contains(){return false;},toggle(){},remove(){}},dataset:{},setAttribute(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];}};},body:{appendChild(){}}};
const window={WeiG:{ReleaseProfile:releaseProfile,buildAssetUrl:x=>x,I18n:{getLocale:()=> 'en-US'}},addEventListener(){},dispatchEvent(){},requestAnimationFrame:fn=>fn()};
const context={window,document,fetch:async()=>({ok:true,json:async()=>registry}),requestAnimationFrame:fn=>fn(),console,CustomEvent:class{}};
vm.runInNewContext(capabilitySource,context,{filename:'capabilities.js'});
const R=window.WeiG.CapabilityRegistry;await R.load();
async function bind(actions,resolutionMode='EXACT',fallback=false){profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',resolutionMode,fallback,apiActions:actions,apiActionParameters:{},torrentFilters:[],torrentInfoParameters:[],torrentInfoFields:[]};await R.bind({qbVersion:'6.0.0',webApiVersion:'3.0.0'});}
await bind([SET_DL,SET_UL,TOGGLE,SET_PREFS]);
assert.equal(R.supports('globalSpeedLimitWrite'),true,'normal Apply must be enabled when every exact source action is present');
assert.equal(R.supports('altSpeedLimitWrite'),true,'alternative Apply must be enabled when every exact source action is present');
await bind([SET_DL,TOGGLE,SET_PREFS]);
assert.equal(R.supports('globalSpeedLimitWrite'),false,'normal Apply must fail closed when upload setter provenance is absent');
assert.equal(R.supports('altSpeedLimitWrite'),true,'missing normal-only setter must not disable proven alternative writes');
await bind([SET_DL,SET_UL,TOGGLE]);
assert.equal(R.supports('globalSpeedLimitWrite'),true,'normal Apply must not depend on setPreferences');
assert.equal(R.supports('altSpeedLimitWrite'),false,'alternative Apply must fail closed when setPreferences provenance is absent');
await bind([SET_DL,SET_UL,TOGGLE,SET_PREFS],'INHERITED',false);
assert.equal(R.supports('globalSpeedLimitWrite'),false,'inherited release must not expose historical normal rate writes');
assert.equal(R.supports('altSpeedLimitWrite'),false,'inherited release must not expose historical alternative rate writes');
await bind([SET_DL,SET_UL,TOGGLE,SET_PREFS],'FALLBACK',true);
assert.equal(R.supports('globalSpeedLimitWrite'),false,'fallback release must not guess normal rate writes');
assert.equal(R.supports('altSpeedLimitWrite'),false,'fallback release must not guess alternative rate writes');
console.log('Transfer write capability contract passed: normal/alternative Apply require complete source-owned action sets, dynamic UI is explicitly decorated, and inherited/fallback releases fail closed.');
