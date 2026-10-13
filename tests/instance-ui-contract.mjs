import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const plan=JSON.parse(read('webui/private/bootstrap-plan.json'));
const shell=read('webui/private/index.html'),ui=read('webui/private/scripts/instances-ui.js');
const health=read('webui/private/scripts/instance-health.js'),css=read('webui/private/css/sidebar-instances.css');
assert.ok(shell.includes('id="sidebar-instances"'),'Single Sidebar placement must be below the Facet owner');
assert.ok(shell.indexOf('id="sidebar-instances"')>shell.indexOf('id="facet-controls"'));
assert.ok(plan.styles.includes('css/sidebar-instances.css'));
const nav=read('webui/private/scripts/navigation.js');
assert.ok(!plan.phases.some(x=>x.scripts.includes('scripts/instance-registry.js')||x.scripts.includes('scripts/instance-health.js')||x.scripts.includes('scripts/instances-ui.js')),'Instance feature must not regrow the bounded initial bootstrap');
assert.ok(nav.includes("['scripts/instance-registry.js','scripts/instance-health.js','scripts/instances-ui.js']")&&nav.includes('loadInstances:loadInstances'),'Navigation must load the canonical feature via RuntimeAssets after first paint');
assert.ok(nav.includes("settings:['scripts/update-check.js','scripts/bug-report.js','scripts/settings.js']"),'Settings-only UpdateCheck must be loaded with Settings instead of in startup');
assert.ok(ui.includes('R.switchTo(item.url,{transfer:true,allowDowngrade:insecure===true'),'UI must opt in to transfer and HTTPS downgrade per explicit user gesture');
assert.ok(ui.includes('W.AppState.initialized')&&ui.includes("'weig:app-ready'"),'Incoming cross-origin consent must wait for the target qB locale startup barrier');
assert.ok(ui.includes('R.previewIncoming(json)')&&ui.includes('importOffered'),'Only novel cross-origin records require consent');
assert.ok(ui.includes('R.defaultName(current)')&&ui.includes("active?tr('currentSuffix')"),'Unregistered current instances use stable host identity and current badge');
assert.ok(ui.includes('selected.delete(item.url)')&&ui.includes('R.importMissing(JSON.stringify'),'A review row can exclude an instance, committing only the selected set');
assert.ok(!ui.includes("function openInterval(")&&!ui.includes("sidebar-instances__interval"),'Instance interval must be owned only by Settings');
assert.ok(read('webui/private/scripts/settings.js').includes("instanceCheckRow()"),'Settings must own the interval row');
assert.ok(ui.includes("addEventListener('weig:instance-health',updateHealth)")&&ui.includes('liveRows.forEach(paintHealth)'),'Health events must preserve row DOM, focus and context menu');
assert.ok(health.includes('lastVerifiedAt')&&health.includes("row.status!=='online'"),'History is a bounded previous WebAPI proof, never stored as live online');
assert.ok(health.includes("global.addEventListener('weig:app-ready'")&&health.includes('inspect(url).then'),'Current qB must reconcile even when initial remote probe is in flight');
assert.ok(ui.includes('syncAddressHint')&&ui.includes('loopbackWarning'),'Loopback addresses require an explicit user-facing browser-device hint');
assert.ok(ui.includes('bindContextMenuTrigger')&&ui.includes('R.update(')&&ui.includes('currentSuffix'),'Reuse shared ContextMenu and registry identity for rename');
assert.ok(!ui.includes('localStorage.')&&!ui.includes('fetch('),'UI is a presentation-only consumer');
assert.ok(css.includes('var(--border)')&&css.includes('var(--selected-control-surface)'),'Sidebar color/selection must use shared theme tokens');
assert.ok(css.includes('var(--accent-primary)')&&!css.includes('var(--accent)'), 'Reachability dot must use a defined canonical accent token, not an undefined alias');
assert.ok(health.includes("credentials:'omit'")&&health.includes("redirect:'error'"),'Cross-Origin probes cannot send qB credentials or follow redirect');
assert.ok(!health.includes("credentials:'include'")&&health.includes("mode:'no-cors'")&&health.includes("response.type==='opaque'")&&health.includes("'reachable'"),'Opaque HTTP reachability must have a distinct non-online status and no credentials');
const saved=new Map(),observed=[],registry={
  currentUrl:()=> 'https://one.example/',
  list:()=>[{name:'Other',url:'https://two.example/'}]
};
const store={get:(key,def)=>saved.has(key)?saved.get(key):def,set:(key,value)=>{saved.set(key,value);return true;}};
const client={qbVersion:'0.0.0',torrentCount:async()=>42};
const window={
  WeiG:{StorageRuntime:{local:store},StorageKeys:{instanceProbeInterval:'weig.instances.probeMinutes'},InstanceRegistry:registry,AppState:{client}},
  location:{origin:'https://one.example'},
  addEventListener(){},dispatchEvent(){},
};
const document={readyState:'loading',visibilityState:'visible',addEventListener(){}};
let blocked=false,opaque=false;
async function fetch(url,opts){
  assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');
  observed.push(url);
  if(blocked){if(opts.mode==='no-cors'&&opaque)return{type:'opaque'};throw new TypeError('Failed to fetch');}
  return url.endsWith('/app/version')?{ok:true,status:200,text:async()=> '5.2.4'}:{ok:true,status:200,text:async()=> '67'};
}
vm.runInNewContext(health,{window,document,URL,Number,Map,CustomEvent:class{},AbortController,fetch,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},Date});
const H=window.WeiG.InstanceHealth;
assert.equal(H.minutes(),30);
assert.equal(H.setMinutes('15'),15);assert.equal(H.minutes(),15);
assert.throws(()=>H.setMinutes('1'));
assert.throws(()=>H.setMinutes('1441'));
assert.equal(H.setMinutes(0),0);
assert.equal(H.minutes(),0);
await H.checkNow();
assert.equal(H.get('https://one.example/').status,'unverified','Undetected 0.0.0 qB must not count as online');
client.qbVersion='5.2.4';
await H.checkNow();
assert.equal(H.get('https://one.example/').status,'online');
assert.equal(H.get('https://one.example/').count,42);
assert.equal(H.get('https://two.example/').status,'online');
assert.equal(H.get('https://two.example/').count,67);
assert.equal(observed.length,4,'Each check performs only one version and one count GET for remote qB');
client.torrentCount=async()=>0;
await H.checkNow();
assert.equal(H.get('https://one.example/').status,'online');
assert.equal(H.get('https://one.example/').count,0,'numeric zero from QBClient must remain a verified torrent count');
client.torrentCount=async()=>42;
await H.checkNow();
const app=window.WeiG.AppState;
app.knownTotal=0;app.knownTotalFresh=true;app.filter='all';
assert.equal(H.get('https://one.example/').count,0,'verified unfiltered total overrides earlier probe');
app.search='filtered';
assert.equal(H.get('https://one.example/').count,42,'filtered total cannot replace global total');
app.search='';app.knownTotalFresh=false;
assert.equal(H.get('https://one.example/').count,42,'stale total cannot replace verified probe');
app.catalogReady=true;app.catalog=[];
assert.equal(H.get('https://one.example/').count,0,'verified empty catalog must show 0');
app.catalogReady=false;
blocked=true;await H.checkNow();
assert.equal(H.get('https://two.example/').status,'unverified','CORS/mixed-content/network failure cannot be mislabelled offline');
assert.equal(H.get('https://two.example/').count,null);
opaque=true;await H.checkNow();
assert.equal(H.get('https://two.example/').status,'reachable','Opaque HTTP response is reachability, not qB online.');
assert.equal(H.get('https://two.example/').count,null,'Opaque response must not imply a torrent count.');
const historyKey='weig.instances.lastVerified.v1',history=JSON.parse(saved.get(historyKey));
assert.equal(history.schemaVersion,1);
assert.ok(history.items.length<=16&&history.items.some(x=>x.url==='https://one.example/'&&x.at>0));
assert.ok(history.items.every(x=>Object.keys(x).sort().join(',')==='at,url'),'Persist verified timestamp only, never Cookie/SID/count');
const reloadWindow={
  WeiG:{StorageRuntime:{local:store},StorageKeys:{instanceHealthHistory:historyKey},InstanceRegistry:registry,AppState:{client}},
  location:{origin:'https://one.example'},addEventListener(){},dispatchEvent(){}
};
vm.runInNewContext(health,{window:reloadWindow,document,URL,Number,Map,CustomEvent:class{},AbortController,fetch,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},Date});
const previous=reloadWindow.WeiG.InstanceHealth.get('https://one.example/');
assert.equal(previous.status,'unverified','Persisted history must not be projected as live online');
assert.equal(previous.count,null,'Persisted history must not carry a torrent count');
assert.ok(previous.lastVerifiedAt>0,'Show a bounded previous evidence timestamp');

const coreI18n=read('webui/private/scripts/i18n.js');
const enMatch=coreI18n.match(/\bvar EN=(\{[^\n]+\});/);
assert.ok(enMatch,'Canonical English WeiG dictionary must be present');
const english=JSON.parse(enMatch[1]),instanceKeys=Object.keys(english).filter(k=>k.startsWith('instances.')).sort();
assert.equal(instanceKeys.length,28,'The instance feature must have one complete semantic English dictionary');
const placeholders=s=>[...String(s).matchAll(/\{([a-z]+)\}/g)].map(m=>m[1]).sort();
for(const locale of ['de','es','fr','ja','ko','pt','ru','zh-CN','zh-TW']){
  const file=JSON.parse(read('webui/private/data/weig-i18n/'+locale+'.json'));
  assert.equal(file.locale,locale);
  for(const key of instanceKeys){
    assert.ok(typeof file.messages[key]==='string'&&file.messages[key].trim(),'Missing '+locale+'/'+key);
    assert.deepEqual(placeholders(file.messages[key]),placeholders(english[key]),'I18n placeholder mismatch '+locale+'/'+key);
  }
}
const hk=JSON.parse(read('webui/private/data/weig-i18n/zh-HK.json'));
assert.ok(Object.keys(hk.messages).filter(key=>key.startsWith('instances.')).length<instanceKeys.length,
  'Hong Kong copy remains a sparse override of zh-TW');
console.log('A76 Instance Sidebar, bounded Health and semantic locale coverage contract passed.');
