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
assert.ok(nav.includes("settings:['scripts/update-check.js','scripts/settings.js']"),'Settings-only UpdateCheck must be loaded with Settings instead of in startup');
assert.ok(ui.includes('R.switchTo(item.url,{transfer:true,allowDowngrade:insecure===true'),'UI must opt in to transfer and HTTPS downgrade per explicit user gesture');
assert.ok(ui.includes('R.importList(json)')&&ui.includes('importOffered'),'Untrusted URL handoff must require user confirmation');
assert.ok(!ui.includes('localStorage.')&&!ui.includes('fetch('),'UI is a presentation-only consumer');
assert.ok(css.includes('var(--border)')&&css.includes('var(--selected-control-surface)'),'Sidebar color/selection must use shared theme tokens');
assert.ok(health.includes("credentials:'omit'")&&health.includes("redirect:'error'"),'Cross-Origin probes cannot send qB credentials or follow redirect');
assert.ok(!health.includes("credentials:'include'")&&!health.includes("'no-cors'"),'Opaque cross-origin responses are not considered online');
const saved=new Map(),observed=[],registry={
  currentUrl:()=> 'https://one.example/',
  list:()=>[{name:'Other',url:'https://two.example/'}]
};
const store={get:(key,def)=>saved.has(key)?saved.get(key):def,set:(key,value)=>{saved.set(key,value);return true;}};
const client={qbVersion:'5.2.4',torrentCount:async()=>42};
const window={
  WeiG:{StorageRuntime:{local:store},StorageKeys:{instanceProbeInterval:'weig.instances.probeMinutes'},InstanceRegistry:registry,AppState:{client}},
  location:{origin:'https://one.example'},
  addEventListener(){},dispatchEvent(){},
};
const document={readyState:'loading',visibilityState:'visible',addEventListener(){}};
let blocked=false;
async function fetch(url,opts){
  assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');
  observed.push(url);
  if(blocked)throw new TypeError('Failed to fetch');
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
assert.equal(H.get('https://one.example/').status,'online');
assert.equal(H.get('https://one.example/').count,42);
assert.equal(H.get('https://two.example/').status,'online');
assert.equal(H.get('https://two.example/').count,67);
assert.equal(observed.length,2,'Remote one-version + one-count GET only');
blocked=true;await H.checkNow();
assert.equal(H.get('https://two.example/').status,'unverified','CORS/mixed-content/network failure cannot be mislabelled offline');
assert.equal(H.get('https://two.example/').count,null);

const coreI18n=read('webui/private/scripts/i18n.js');
const enMatch=coreI18n.match(/\bvar EN=(\{[^\n]+\});/);
assert.ok(enMatch,'Canonical English WeiG dictionary must be present');
const english=JSON.parse(enMatch[1]),instanceKeys=Object.keys(english).filter(k=>k.startsWith('instances.')).sort();
assert.equal(instanceKeys.length,29,'The instance feature must have one complete semantic English dictionary');
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
