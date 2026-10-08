import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const index=read('webui/private/index.html'),runtime=read('webui/private/scripts/runtime-assets.js'),navigation=read('webui/private/scripts/navigation.js'),app=read('webui/private/scripts/app.js'),header=read('webui/private/scripts/header.js');
const plan=JSON.parse(read('webui/private/bootstrap-plan.json')),startup=['scripts/runtime-assets.js',...plan.phases.flatMap(phase=>phase.scripts)];
const routes={settings:'scripts/settings.js',rss:'scripts/rss.js',logs:'scripts/logs.js'};
for(const [route,module] of Object.entries(routes)){
  assert.equal(startup.includes(module),false,route+' module must not be in ordered initial bootstrap');
  assert.ok(navigation.includes(route+':['+"'"+module+"'"+']')||navigation.includes("'"+route+"':['"+module+"']"),route+' must be owned by the route-module map');
  assert.ok(fs.existsSync(path.join(root,'webui/private',module)),route+' module file missing');
}
assert.ok(index.includes("SEED='scripts/runtime-assets.js'")&&index.includes("PLAN='bootstrap-plan.json'"),'private bootstrap must seed RuntimeAssets then hand off to the declarative plan');
assert.ok(startup.includes('scripts/navigation.js')&&startup.includes('scripts/app.js'),'bootstrap plan must retain Navigation and App owners');
assert.ok(startup.indexOf('scripts/navigation.js')<startup.indexOf('scripts/app.js'),'route loading owner must precede App');
assert.ok(runtime.includes('scriptInflight=new Map()')&&runtime.includes('scriptLoaded=new Set()')&&runtime.includes('function loadScript(path,options)')&&runtime.includes('node.src=retryUrl(path,attempt)')&&runtime.includes('withRetry(once,options)')&&runtime.includes('node.async=false')&&runtime.includes('loadScript:loadScript'),'RuntimeAssets must own build-keyed same-page de-duplicated script transport with the shared bounded retry policy');
assert.ok(navigation.includes("namespace:'route-module'")&&navigation.includes('identity:name')&&navigation.includes('routeModules[name]=task')&&navigation.includes('delete routeModules[name]'),'Navigation must de-duplicate each route load and allow retry after failure');
assert.ok(app.includes('routeGeneration=0')&&app.includes('if(!isCurrent())return;')&&app.includes('requestedHash=String(location.hash'), 'App must reject stale route commits and stale module failures');
assert.ok(app.includes('await W.Navigation.loadRouteModule(r.name)')&&app.indexOf('await W.Navigation.loadRouteModule(r.name)')<app.indexOf("if(r.name==='torrent'"),'App must await route ownership before any route-specific caller');
const settings=read('webui/private/scripts/settings.js'),rss=read('webui/private/scripts/rss.js'),logs=read('webui/private/scripts/logs.js');
assert.ok(settings.includes('if(app&&app.preferences){controller.prefs=app.preferences;return controller.prefs;}'),'lazy Settings must hydrate from canonical AppState instead of requiring startup execution');
assert.ok(settings.includes("ensureSettingsModuleDependencies(tab)")&&settings.includes("String(tab||'')==='rss'")&&settings.includes("await W.Navigation.loadRouteModule('rss')"),'Settings RSS source actions must demand-load the canonical RSS module before rendering the RSS tab, without restoring RSS to Home bootstrap');
assert.ok(header.includes("global.addEventListener('weig:route-state',function(){setSearchOpen(false);setDrawer(false);syncSearchContext();requestAnimationFrame(syncSearchContext);});"),'Header must synchronously project route search semantics at the route-state boundary and keep one-frame reconciliation for late presentation changes');
const sharedSearch=(index.match(/<input id="search-input"[^>]*>/)||[])[0]||'';assert.ok(sharedSearch&&!sharedSearch.includes('data-i18n-placeholder'),'shared Header Search must not retain a static I18n placeholder owner that can overwrite route-context semantics after Settings/RSS/Logs render events');
assert.ok(rss.includes('W.AppState')&&rss.includes('client'),'lazy RSS must resolve the canonical current client at use time');
assert.ok(logs.includes('var app=W.AppState;if(app&&app.client)return app.client'),'lazy Logs must resolve the canonical current client at use time');
for(const source of [settings,rss,logs])assert.ok(source.includes("document.readyState==='loading'"),'route module must self-initialize correctly when injected after DOMContentLoaded');
const deferredBytes=Object.values(routes).reduce((sum,module)=>sum+fs.statSync(path.join(root,'webui/private',module)).size,0);
assert.ok(deferredBytes>140000,'route sharding must defer a material amount of route-only JavaScript from home startup');
assert.ok(runtime.includes('function prefetchScript(path,options)')&&runtime.includes("node.rel='prefetch'")&&runtime.includes('prefetchScript:prefetchScript'),'Shared RuntimeAssets must own inert script hints without pretending they are loaded modules');
assert.ok(navigation.includes('function warmRouteModules()')&&navigation.includes('loader.prefetchScript(path,')&&navigation.includes('warmRouteModules:warmRouteModules'),'Navigation must own idle route inventory prefetch rather than feature-local hints');
assert.ok(app.includes('warmRoutesAfterPagePaint()')&&app.includes('if(loaded&&!silent)warmRoutesAfterPagePaint()'),'Only a committed first Torrent page may schedule idle route prefetch');
console.log('Route-module contract passed: Settings/RSS/Logs are removed from ordered home bootstrap, loaded once through RuntimeAssets on route demand, and recover canonical AppState/client ownership when injected late.');
