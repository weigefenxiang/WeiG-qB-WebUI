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
assert.ok(!read('webui/private/scripts/settings.js').includes('instanceCheckRow()'),'Retire obsolete remote-detection interval setting');
assert.ok(ui.includes("addEventListener('weig:instance-health',updateHealth)")&&ui.includes('liveRows.forEach(paintHealth)'),'Health events must preserve row DOM, focus and context menu');
assert.ok(health.includes('reportedCount')&&health.includes("status:'unverified'"),'Historical peer reports must never become live online evidence');
assert.ok(health.includes("global.addEventListener('weig:app-ready'")&&health.includes('checkNow()'),'Current qB must reconcile after app-ready');
assert.ok(ui.includes('syncAddressHint')&&ui.includes('loopbackWarning'),'Loopback addresses require an explicit user-facing browser-device hint');
assert.ok(ui.includes('bindContextMenuTrigger')&&ui.includes('R.update(')&&ui.includes('currentSuffix'),'Reuse shared ContextMenu and registry identity for rename');
assert.ok(!ui.includes('localStorage.')&&!ui.includes('fetch('),'UI is a presentation-only consumer');
assert.ok(css.includes('var(--border)')&&css.includes('var(--selected-control-surface)'),'Sidebar color/selection must use shared theme tokens');
assert.ok(!css.includes('[data-state="reachable"]')&&!css.includes('[data-state="denied"]'),'Retire unreachable legacy status styles');
assert.ok(!health.includes('refreshShared')&&!health.includes('weig-instance-status.json')&&!health.includes('fetch('),'All collector/shared HTTP status logic must retire');
assert.ok(!health.includes('setInterval(')&&!health.includes('setMinutes('),'No legacy remote polling timer/setting');
assert.ok(ui.includes("String(historical)+'*'"),'Historical count is explicitly distinguished from live');
const saved=new Map(),registry={
  currentUrl:()=> 'https://one.example/',
  list:()=>[{name:'One',url:'https://one.example/'},{name:'Two',url:'https://two.example/'}]
};
const storage={get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>{saved.set(k,v);return true;}};
let now=Date.now();
class Time extends Date{static now(){return now;}}
const client={qbVersion:'v5.2.4',torrentCount:async()=>0};
const app={client,catalogReady:true,catalog:[],filter:'all'};
const win={WeiG:{StorageRuntime:{local:storage},InstanceRegistry:registry,AppState:app},
  location:{origin:'https://one.example'},addEventListener(){},dispatchEvent(){}};
const document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(health,{window:win,document,URL,Number,Map,Set,CustomEvent:class{},Date:Time});
const H=win.WeiG.InstanceHealth;
await H.checkNow();
assert.equal(H.get('https://one.example/').count,0,'Authoritative current zero retained');
assert.equal(H.exportReports().find(x=>x.url==='https://one.example/').count,0);
assert.equal(H.get('https://two.example/').status,'unverified');
assert.equal(H.importReports([{url:'https://two.example/',count:42,at:now}]),1);
assert.equal(H.get('https://two.example/').reportedCount,42,'Remote report carries useful count');
assert.equal(H.get('https://two.example/').count,null,'Remote report must not masquerade as live count');
assert.equal(H.get('https://two.example/').status,'unverified','Remote report must never show green');
assert.equal(H.importReports([{url:'https://other.example/',count:123,at:now}]),0,'Unregistered URL is ignored');
assert.equal(H.importReports([{url:'https://two.example/',count:99,at:now-1000}]),0,'Older reports cannot overwrite newer');
now+=1000;
const newer={url:'https://two.example/',count:0,at:now};
assert.equal(H.importReports([newer]),1,'Remote zero is a valid newer historical report');
assert.equal(H.get('https://two.example/').reportedCount,0);
const persisted=JSON.parse(saved.get('weig.instances.reports.v1'));
assert.equal(persisted.schemaVersion,1);
assert.ok(persisted.items.every(x=>Object.keys(x).sort().join(',')==='at,count,url'),'No login details/session/status in history');
const reload={WeiG:{StorageRuntime:{local:storage},InstanceRegistry:registry,AppState:app},
  location:{origin:'https://one.example'},addEventListener(){},dispatchEvent(){}};
vm.runInNewContext(health,{window:reload,document,URL,Number,Map,Set,CustomEvent:class{},Date:Time});
const restored=reload.WeiG.InstanceHealth.get('https://two.example/');
assert.equal(restored.reportedCount,0);
assert.equal(restored.status,'unverified');
now+=24*60*60000+2000;
assert.equal(reload.WeiG.InstanceHealth.get('https://two.example/').reportedCount,undefined,'24h report expires');
assert.equal(reload.WeiG.InstanceHealth.exportReports().some(x=>x.url==='https://two.example/'),false);

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
