import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8'),assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const index=read('webui/private/index.html'),app=read('webui/private/scripts/app.js'),brand=read('webui/private/scripts/brand.js'),design=read('DESIGN.md');
assert(index.includes('data-weigg-bootstrap="pending"'),'private shell must start behind the bootstrap gate');
assert(!index.includes('<link rel="stylesheet" href="css/'),'private CSS must not return to an eager request burst');
assert(!index.includes('<script src="scripts/')&&!index.includes('<script src="session-contract.js'),'private JS must not return to an eager request burst');
const marker='<script id="weigg-private-bootstrap">',start=index.indexOf(marker),end=index.indexOf('</script>',start);assert(start>=0&&end>start,'private bootstrap owner missing');const bootstrap=index.slice(start+marker.length,end);
for(const token of ["STYLE_CONCURRENCY=2,MAX_ATTEMPTS=3","loadWithRetry","loadStyles","loadScripts","asset-load-failed:","__WEIGG_GIT_SHA__"])assert(bootstrap.includes(token),'bootstrap contract missing '+token);
assert(bootstrap.indexOf('"scripts/dialog-runtime.js"')>bootstrap.indexOf('"scripts/core.js"')&&bootstrap.indexOf('"scripts/dialog-runtime.js"')<bootstrap.indexOf('"scripts/capabilities.js"'),'DialogRuntime must load after Core and before dialog consumers');
assert(bootstrap.indexOf('"scripts/action-registry.js"')<bootstrap.indexOf('"scripts/settings.js"'),'ActionRegistry must load before Settings source-action binding');
assert(bootstrap.indexOf('"scripts/column-configurator.js"')>bootstrap.indexOf('"scripts/layout.js"')&&bootstrap.indexOf('"scripts/column-configurator.js"')<bootstrap.indexOf('"scripts/ui.js"'),'ColumnConfigurator must load after SharedColumns persistence and before Detail callers');
assert(bootstrap.indexOf('"scripts/floating.js"')<bootstrap.indexOf('"scripts/spatial.js"'),'floating Select owner must load before spatial consumer');
assert(bootstrap.indexOf('"scripts/logs.js"')<bootstrap.indexOf('"scripts/app.js"'),'app startup must run after the full module surface is present');
assert(bootstrap.includes('"scripts/rss.js"')&&bootstrap.indexOf('"scripts/rss.js"')<bootstrap.indexOf('"scripts/app.js"'),'RSSWorkspace/RSSRules must load before App can route into RSS');
assert(!bootstrap.includes('qbVersion')&&!bootstrap.includes('webApiVersion'),'bootstrap transport must remain qB-version independent');
assert(app.includes("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();"),'app must initialize when loaded after DOMContentLoaded');
assert(bootstrap.indexOf('"scripts/brand.js"')<bootstrap.indexOf('"scripts/app.js"'),'Brand owner must load before App without retaining a transient shell binding');
assert(brand.includes('setTimeout(normalizeHeader,0)')&&brand.includes('old.replaceWith(cluster)')&&brand.includes("b.addEventListener('click'")&&brand.includes('goHome();'),'Brand must own normalized home activation after replacing the transient header button');
assert(!app.includes("U.$('brand-btn').onclick"),'App must not bind the transient brand shell after Brand normalization');
assert(design.includes('PRIVATE-BOOTSTRAP — ordered initial asset transport is one owner')&&design.includes('A permanently failed prerequisite stops later script execution'),'DESIGN must record the durable bootstrap owner and fail-closed transport rule');

function harness(alwaysFail){
  const events=[],attempts=new Map(),nodes=new Map();
  for(const id of ['weigg-bootstrap-status','weigg-bootstrap-title','weigg-bootstrap-copy','weigg-bootstrap-retry'])nodes.set(id,{id,hidden:false,textContent:'',onclick:null});
  const document={documentElement:{dataset:{}},head:{appendChild(node){const p=node.dataset.weiggBootstrapAsset;events.push(['append',node.tagName,p]);const count=(attempts.get(p)||0)+1;attempts.set(p,count);queueMicrotask(()=>{if(p==='scripts/floating.js'&&(alwaysFail||count===1))node.onerror&&node.onerror();else node.onload&&node.onload();});}},createElement(tag){return{tagName:String(tag).toUpperCase(),dataset:{},remove(){events.push(['remove',this.dataset.weiggBootstrapAsset]);}};},getElementById(id){return nodes.get(id)||null;}};
  const location={href:'https://example.test/index.html?handoff=x',reload(){events.push(['reload']);}},timer=(fn)=>{queueMicrotask(fn);return 1;},window={document,location,URL,Promise,setTimeout:timer,console};window.window=window;
  const context=vm.createContext({window,document,location,URL,Promise,setTimeout:timer,console,queueMicrotask});vm.runInContext(bootstrap,context,{filename:'private-bootstrap.js'});
  return{events,attempts,document,nodes};
}
async function settle(run){for(let i=0;i<800;i++){await Promise.resolve();const state=run.document.documentElement.dataset.weiggBootstrap;if(state==='ready'||state==='failed')return state;}throw new Error('bootstrap harness did not settle');}
const recovered=harness(false);assert(await settle(recovered)==='ready','one transient prerequisite failure must recover');assert(recovered.attempts.get('scripts/floating.js')===2,'transient prerequisite must retry exactly once before success');
const recoveredScripts=recovered.events.filter(e=>e[0]==='append'&&e[1]==='SCRIPT').map(e=>e[2]),firstSpatial=recoveredScripts.indexOf('scripts/spatial.js'),lastFloating=recoveredScripts.lastIndexOf('scripts/floating.js');assert(lastFloating>=0&&firstSpatial>lastFloating,'dependent script executed before prerequisite retry completed');
const failed=harness(true);assert(await settle(failed)==='failed','permanent prerequisite failure must fail closed');assert(!failed.events.some(e=>e[0]==='append'&&e[2]==='scripts/spatial.js'),'permanent prerequisite failure must stop dependent execution');assert(failed.nodes.get('weigg-bootstrap-retry').hidden===false,'failed bootstrap must expose a retry action');
console.log('Private bootstrap contract passed: bounded static-asset concurrency/retry preserves dependency order, recovers a transient failure, and fails closed without a partial-module black screen.');
