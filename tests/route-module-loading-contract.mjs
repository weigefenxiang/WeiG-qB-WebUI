import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const index=read('webui/private/index.html'),runtime=read('webui/private/scripts/runtime-assets.js'),navigation=read('webui/private/scripts/navigation.js'),app=read('webui/private/scripts/app.js');
const match=index.match(/var scripts=(\[[^;]+\]);/);assert.ok(match,'private bootstrap scripts array missing');const startup=JSON.parse(match[1]);
const routes={settings:'scripts/settings.js',rss:'scripts/rss.js',logs:'scripts/logs.js'};
for(const [route,module] of Object.entries(routes)){
  assert.equal(startup.includes(module),false,route+' module must not be in ordered initial bootstrap');
  assert.ok(navigation.includes(route+':['+"'"+module+"'"+']')||navigation.includes("'"+route+"':['"+module+"']"),route+' must be owned by the route-module map');
  assert.ok(fs.existsSync(path.join(root,'webui/private',module)),route+' module file missing');
}
assert.ok(startup.includes('scripts/runtime-assets.js')&&startup.includes('scripts/navigation.js')&&startup.includes('scripts/app.js'),'startup must retain RuntimeAssets -> Navigation -> App owners');
assert.ok(startup.indexOf('scripts/runtime-assets.js')<startup.indexOf('scripts/navigation.js')&&startup.indexOf('scripts/navigation.js')<startup.indexOf('scripts/app.js'),'route loading owners must precede App');
assert.ok(runtime.includes('scriptInflight=new Map()')&&runtime.includes('scriptLoaded=new Set()')&&runtime.includes('function loadScript(path,options)')&&runtime.includes('node.src=assetUrl(path)')&&runtime.includes('node.async=false')&&runtime.includes('loadScript:loadScript'),'RuntimeAssets must own build-keyed same-page de-duplicated script transport');
assert.ok(navigation.includes("namespace:'route-module'")&&navigation.includes('identity:name')&&navigation.includes('routeModules[name]=task')&&navigation.includes('delete routeModules[name]'),'Navigation must de-duplicate each route load and allow retry after failure');
assert.ok(app.includes('await W.Navigation.loadRouteModule(r.name)')&&app.indexOf('await W.Navigation.loadRouteModule(r.name)')<app.indexOf("if(r.name==='torrent'"),'App must await route ownership before any route-specific caller');
const settings=read('webui/private/scripts/settings.js'),rss=read('webui/private/scripts/rss.js'),logs=read('webui/private/scripts/logs.js');
assert.ok(settings.includes('if(app&&app.preferences){controller.prefs=app.preferences;return controller.prefs;}'),'lazy Settings must hydrate from canonical AppState instead of requiring startup execution');
assert.ok(rss.includes('W.AppState')&&rss.includes('client'),'lazy RSS must resolve the canonical current client at use time');
assert.ok(logs.includes('var app=W.AppState;if(app&&app.client)return app.client'),'lazy Logs must resolve the canonical current client at use time');
for(const source of [settings,rss,logs])assert.ok(source.includes("document.readyState==='loading'"),'route module must self-initialize correctly when injected after DOMContentLoaded');
const deferredBytes=Object.values(routes).reduce((sum,module)=>sum+fs.statSync(path.join(root,'webui/private',module)).size,0);
assert.ok(deferredBytes>140000,'A62.5 must defer a material amount of route-only JavaScript from home startup');
console.log('A62.5 route-module contract passed: Settings/RSS/Logs are removed from ordered home bootstrap, loaded once through RuntimeAssets on route demand, and recover canonical AppState/client ownership when injected late.');
