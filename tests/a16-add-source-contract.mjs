import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const registry=read('webui/private/data/qb-settings-native.txt');
const i18n=read('webui/private/scripts/i18n.js');
const floating=read('webui/private/scripts/floating.js');
const controls=read('webui/private/css/controls.css');
const appCss=read('webui/private/css/app.css');

function decode(value){try{return decodeURIComponent(String(value||''));}catch{return String(value||'');}}
function addRefsFor(version,sha){
  const profileRe=new RegExp('^@@PROFILE\\t'+sha+'\\t([^\\t\\r\\n]*)\\t[^\\t\\r\\n]*\\t(b[0-9a-f]{20})\\t','m');
  const profile=profileRe.exec(registry);
  assert(profile&&decode(profile[1])===version,'missing exact Add-copy profile '+version+'@'+sha);
  const binding=profile[2],refById=new Map();
  for(const match of registry.matchAll(/^@@REF\t([0-9a-f]{24})\t([^\t\r\n]*)\t([^\t\r\n]*)\r?\n[\s\S]*?\r?\n@@END\s*$/gm))refById.set(match[1],decode(match[2])+'\u0000'+decode(match[3]));
  const refs=new Set();
  const uiRe=new RegExp('^@@UI\\t'+binding+'\\t(add\\.copy\\.[^\\t\\r\\n]*)\\t([0-9a-f]{24})\\s*$','gm');
  for(const match of registry.matchAll(uiRe)){const ref=refById.get(match[2]);if(ref)refs.add(ref);}
  return refs;
}
function has(set,context,source){return set.has(context+'\u0000'+source);}

const refs467=addRefsFor('4.6.7','839bc696d066aca34ebd994ee1673c4b2d5afd7b');
for(const pair of [
  ['AddNewTorrentDialog','Torrent Management Mode:'],
  ['HttpServer','Save files to location:'],
  ['HttpServer','Cookie:'],
  ['HttpServer','Rename torrent'],
  ['AddNewTorrentDialog','Category:'],
  ['AddNewTorrentDialog','Start torrent'],
  ['AddNewTorrentDialog','Add to top of queue'],
  ['AddNewTorrentDialog','Stop condition:'],
  ['AddNewTorrentDialog','Skip hash check'],
  ['TransferListWidget','Download in sequential order'],
  ['TransferListWidget','Download first and last pieces first'],
  ['HttpServer','Limit download rate'],
  ['HttpServer','Limit upload rate']
])assert(has(refs467,pair[0],pair[1]),'4.6.7 Add source inventory missing '+pair.join(': '));
for(const pair of [
  ['AddNewTorrentDialog','Tags:'],
  ['AddNewTorrentDialog','Use another path for incomplete torrent'],
  ['AddNewTorrentDialog','Save path:'],
  ['UpDownRatioDialog','ratio'],
  ['UpDownRatioDialog','total minutes'],
  ['UpDownRatioDialog','inactive minutes'],
  ['UpDownRatioDialog','Action when the limit is reached']
])assert(!has(refs467,pair[0],pair[1]),'4.6.7 Add source inventory must not expose '+pair.join(': '));

assert(i18n.includes("key.indexOf('add.copy.')!==0")&&i18n.includes('addRefs:addRefs'),'runtime Add visibility must consume only exact add.copy.* source inventory');
assert(i18n.includes('qbAddSourceHas')&&i18n.includes('qbAddSourceField:qbAddSourceField')&&i18n.includes('qbAddSourceGroup:qbAddSourceGroup'),'Add renderer source projection helpers missing');
assert(!i18n.includes('upgradeAddSuggestion'),'post-DOM Add suggestion upgrade must stay retired once the renderer owns canonical controls');
assert(!i18n.includes('syncAddSourceSurface'),'post-DOM Add copy/visibility repair must stay retired once the renderer owns exact source projection');
const app=read('webui/private/scripts/app.js');
assert(floating.includes('C.comboControl=function(opts)')&&controls.includes('.ui-combo__input'),'Category/Tags suggestions must use the canonical shared floating/select skin');
assert(app.includes("addCombo(settingsGroup,'add-category'")&&app.includes("addCombo(settingsGroup,'add-tags'")&&app.includes('qbAddSourceField'),'Add renderer must directly own exact source projection plus canonical Category/Tags combos');
assert(!app.includes("createElement('datalist')"),'Add renderer must not retain browser-native datalist popup ownership');
assert(app.indexOf('await app.client.add(')<app.indexOf("W.DialogRuntime.close(U.$('add-dialog'))"),'successful Add must close only after the qB add request completes');
assert(appCss.includes('.add-source-file:before')&&appCss.includes("content:'＋'")&&appCss.includes('.add-source-file:hover'),'Add Torrent File entry must expose an explicit action affordance');

console.log('A17 Add Torrent contract passed: exact source-visible copy is projected by the renderer, post-DOM repair/datalist owners are retired, canonical combo controls own Category/Tags, and successful Add closes only after the qB request.');
