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
assert(i18n.includes('qbAddSourceHas')&&i18n.includes("upgradeAddSuggestion('add-category',false)")&&i18n.includes("upgradeAddSuggestion('add-tags',true)"),'Add source projection/shared suggestion upgrade missing');
assert(floating.includes('C.comboControl=function(opts)')&&controls.includes('.ui-combo__input'),'Category/Tags suggestions must use the canonical shared floating/select skin');
assert(appCss.includes('.add-source-file:before')&&appCss.includes("content:'＋'")&&appCss.includes('.add-source-file:hover'),'Add Torrent File entry must expose an explicit action affordance');

console.log('A16 Add Torrent contract passed: 4.6.7 source-visible controls/copy are separated from addAction writability, native datalist popup is replaced by the shared combo primitive, and the file entry is visually promoted.');
