import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const index=read('webui/private/index.html'),plan=JSON.parse(read('webui/private/bootstrap-plan.json')),app=read('webui/private/scripts/app.js'),brand=read('webui/private/scripts/brand.js');
assert.ok(index.includes('data-weig-bootstrap="pending"'),'private shell must start behind the bootstrap gate');
assert.equal(plan.schemaVersion,1);assert.equal(plan.styleConcurrency,4);assert.equal(plan.maxAttempts,3);
assert.ok(!index.includes('var styles=[')&&!index.includes('var scripts=['),'index must not retain a second startup asset inventory');
for(const token of ["SEED='scripts/runtime-assets.js'","PLAN='bootstrap-plan.json'","seedRuntime","executePlanFile(PLAN)","asset-load-failed:","__WEIG_GIT_SHA__"])assert.ok(index.includes(token),'bootstrap seed contract missing '+token);
for(const retired of ['function loadStyles','function loadScripts','STYLE_CONCURRENCY'])assert.equal(index.includes(retired),false,'retired general bootstrap loader leaked back into index: '+retired);
const startup=plan.phases.flatMap(phase=>phase.scripts),unique=new Set(startup);
assert.equal(startup.length,40);assert.equal(unique.size,startup.length,'bootstrap plan script inventory must be unique');
for(const deferred of ['scripts/settings.js','scripts/rss.js','scripts/logs.js'])assert.equal(unique.has(deferred),false,'route-only module leaked into startup plan: '+deferred);
assert.equal(unique.has('scripts/runtime-assets.js'),false,'RuntimeAssets seed must not duplicate itself inside its own plan');
assert.ok(plan.phases.at(-1).name==='application'&&plan.phases.at(-1).scripts.length===1&&plan.phases.at(-1).scripts[0]==='scripts/app.js','App must be the final dependency phase');
const phaseOf=name=>plan.phases.findIndex(phase=>phase.scripts.includes(name));
assert.ok(phaseOf('scripts/core.js')<phaseOf('scripts/dialog-runtime.js'));assert.ok(phaseOf('scripts/select-geometry.js')<phaseOf('scripts/floating.js'));assert.ok(phaseOf('scripts/torrent-action-editor.js')<phaseOf('scripts/selection.js'));assert.ok(phaseOf('scripts/layout.js')<phaseOf('scripts/column-configurator.js'));assert.ok(phaseOf('scripts/column-configurator.js')<phaseOf('scripts/ui.js'));assert.ok(phaseOf('scripts/navigation.js')<phaseOf('scripts/app.js'));
assert.ok(!startup.some(path=>path.includes('../public/')),'bootstrap plan must remain inside the qB Alternative WebUI URL namespace');
assert.ok(!index.includes('qbVersion')&&!index.includes('webApiVersion'),'bootstrap transport must remain qB-version independent');
assert.ok(app.includes("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();"),'App must initialize after late dependency-plan injection');
assert.ok(brand.includes('setTimeout(normalizeHeader,0)')&&brand.includes('old.replaceWith(cluster)')&&brand.includes("b.addEventListener('click'")&&brand.includes('goHome();'),'Brand must own normalized home activation');

const marker='<script id="weig-private-bootstrap">',start=index.indexOf(marker),end=index.indexOf('</script>',start),bootstrap=index.slice(start+marker.length,end);
function harness(alwaysFail){
  const events=[],attempts=new Map(),nodes=new Map();
  for(const id of ['weig-bootstrap-status','weig-bootstrap-title','weig-bootstrap-copy','weig-bootstrap-retry'])nodes.set(id,{id,hidden:false,textContent:'',onclick:null});
  const runtime={executePlanFile(file){events.push(['plan',file]);return Promise.resolve({});}};
  const document={documentElement:{dataset:{}},head:{appendChild(node){const p=node.dataset.weigBootstrapSeed;events.push(['append',p]);const count=(attempts.get(p)||0)+1;attempts.set(p,count);queueMicrotask(()=>{if(alwaysFail||count===1){node.onerror&&node.onerror();}else{window.WeiG={RuntimeAssets:runtime};node.onload&&node.onload();}});}},createElement(){return{dataset:{},remove(){events.push(['remove']);}};},getElementById(id){return nodes.get(id)||null;}};
  const location={href:'https://example.test/index.html?handoff=x',reload(){events.push(['reload']);}},timer=fn=>{queueMicrotask(fn);return 1;};
  const window={document,location,URL,Promise,setTimeout:timer,console,WeiG:{}};window.window=window;
  const context=vm.createContext({window,document,location,URL,Promise,setTimeout:timer,console,queueMicrotask});vm.runInContext(bootstrap,context,{filename:'private-bootstrap.js'});
  return{events,attempts,document,nodes};
}
async function settle(run){for(let i=0;i<100;i++){await Promise.resolve();const state=run.document.documentElement.dataset.weigBootstrap;if(state==='ready'||state==='failed')return state;}throw new Error('bootstrap seed harness did not settle');}
const recovered=harness(false);assert.equal(await settle(recovered),'ready');assert.equal(recovered.attempts.get('scripts/runtime-assets.js'),2,'RuntimeAssets seed must bounded-retry after a transient load failure');assert.ok(recovered.events.some(e=>e[0]==='plan'&&e[1]==='bootstrap-plan.json'),'successful seed must hand off to the canonical plan owner');
const failed=harness(true);assert.equal(await settle(failed),'failed');assert.equal(failed.attempts.get('scripts/runtime-assets.js'),3,'permanent seed failure must stop after MAX_ATTEMPTS');assert.equal(failed.events.some(e=>e[0]==='plan'),false,'failed seed must never start a partial bootstrap plan');assert.equal(failed.nodes.get('weig-bootstrap-retry').hidden,false,'failed seed must expose retry UI');
console.log('Private bootstrap contract passed: index owns only the RuntimeAssets seed and failure shell; RuntimeAssets owns the declarative startup plan, dependency phases and asset transport.');
