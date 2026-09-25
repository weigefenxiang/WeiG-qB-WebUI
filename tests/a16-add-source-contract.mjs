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
const uiCss=read('webui/private/css/ui.css');
const indexHtml=read('webui/private/index.html');

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

const refs410=addRefsFor('4.1.0','e9ed621178af841114a045887c5ce1e6b50cb366');
for(const pair of [
  ['HttpServer','Save files to location:'],
  ['HttpServer','Cookie:'],
  ['HttpServer','Rename torrent'],
  ['AddNewTorrentDialog','Category:'],
  ['AddNewTorrentDialog','Start torrent'],
  ['AddNewTorrentDialog','Skip hash check'],
  ['AddNewTorrentDialog','Create subfolder'],
  ['TransferListWidget','Download in sequential order'],
  ['TransferListWidget','Download first and last pieces first'],
  ['HttpServer','Limit download rate'],
  ['HttpServer','Limit upload rate']
])assert(has(refs410,pair[0],pair[1]),'4.1.0 Add source inventory missing '+pair.join(': '));
for(const pair of [
  ['AddNewTorrentDialog','Torrent Management Mode:'],
  ['AddNewTorrentDialog','Tags:'],
  ['AddNewTorrentDialog','Add to top of queue'],
  ['AddNewTorrentDialog','Stop condition:'],
  ['AddNewTorrentDialog','Use another path for incomplete torrent'],
  ['AddNewTorrentDialog','Save path:']
])assert(!has(refs410,pair[0],pair[1]),'4.1.0 Add source inventory must not expose '+pair.join(': '));

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

const refs523=addRefsFor('5.2.3','0b63c3d17373f6132ea211c9dcd4241284ccdfaf');
for(const pair of [
  ['AddNewTorrentDialog','Torrent Management Mode:'],
  ['AddNewTorrentDialog','Save files to location:'],
  ['AddNewTorrentDialog','Use another path for incomplete torrent'],
  ['AddNewTorrentDialog','Save path:'],
  ['AddNewTorrentDialog','Rename torrent'],
  ['AddNewTorrentDialog','Category:'],
  ['AddNewTorrentDialog','Tags:'],
  ['AddNewTorrentDialog','Start torrent'],
  ['AddNewTorrentDialog','Stop condition:'],
  ['AddNewTorrentDialog','Add to top of queue'],
  ['AddNewTorrentDialog','Skip hash check'],
  ['AddNewTorrentDialog','Download in sequential order'],
  ['AddNewTorrentDialog','Download first and last pieces first'],
  ['AddNewTorrentDialog','Content layout:'],
  ['AddNewTorrentDialog','Limit download rate'],
  ['AddNewTorrentDialog','Limit upload rate']
])assert(has(refs523,pair[0],pair[1]),'5.2.3 Add source inventory missing '+pair.join(': '));
assert(!has(refs523,'HttpServer','Cookie:'),'5.2.3 Add source inventory must not retain legacy Cookie');

assert(i18n.includes("key.indexOf('add.copy.')!==0")&&i18n.includes('addRefs:addRefs'),'runtime Add visibility must consume only exact add.copy.* source inventory');
assert(i18n.includes('qbAddSourceHas')&&i18n.includes('qbAddSourceField:qbAddSourceField')&&i18n.includes('qbAddSourceGroup:qbAddSourceGroup'),'Add renderer source projection helpers missing');
assert(i18n.includes("var refs={save:[['Save at','AddNewTorrentDialog']],settings:[['Torrent settings','AddNewTorrentDialog']]}"),'Add group headings must be limited to real upstream Add section legends; field labels/dialog titles must not be repurposed as group headings');
assert(!i18n.includes('upgradeAddSuggestion'),'post-DOM Add suggestion upgrade must stay retired once the renderer owns canonical controls');
assert(!i18n.includes('syncAddSourceSurface'),'post-DOM Add copy/visibility repair must stay retired once the renderer owns exact source projection');
const app=read('webui/private/scripts/app.js');
assert(floating.includes('C.comboControl=function(opts)')&&controls.includes('.ui-combo__input'),'Category/Tags suggestions must use the canonical shared floating/select skin');
assert(app.includes("addCombo(settingsGroup,'add-category'")&&app.includes("addCombo(settingsGroup,'add-tags'")&&app.includes('qbAddSourceField'),'Add renderer must directly own exact source projection plus canonical Category/Tags combos');
assert(app.includes("return copy&&copy.visible?copy.text:''")&&app.includes('l.hidden=!copy'),'Add group legends without exact upstream source ownership must stay hidden instead of leaking English fallback into localized legacy dialogs');
assert(!app.includes("createElement('datalist')"),'Add renderer must not retain browser-native datalist popup ownership');
assert(!app.includes("addCheck(startGroup,'add-forced'"),'Add renderer must not create API-only forced when the exact qB Add surface has no source-owned control');
assert(app.indexOf('await app.client.add(')<app.indexOf("W.DialogRuntime.close(U.$('add-dialog'))"),'successful Add must close only after the qB add request completes');
assert(appCss.includes('.add-source-file:before')&&appCss.includes("content:'＋'")&&appCss.includes('.add-source-file:hover'),'Add Torrent File entry must expose an explicit action affordance');
assert(!indexHtml.includes('id="add-urls-label"'),'Add dialog must not render a second visible Add Torrent Links label below its source-owned title');
assert(indexHtml.includes('id="torrent-urls" rows="5" aria-label="Add torrent links"'),'Add URL textarea must keep an accessible source-copy target without duplicate visible copy');
assert(app.includes("urls=U.$('torrent-urls')")&&app.includes("urls.setAttribute('aria-label',value)"),'exact Add source copy must update the textarea accessible name after the visible duplicate label is retired');
assert(app.includes('stretch:true,onChange:function(next)')&&app.includes('ariaLabel:label,stretch:true,onInput:function()'),'Add Select/Combo geometry must opt into the canonical stretch primitive');
assert(uiCss.includes('.ui-select--stretch')&&uiCss.includes('dialog.dialog[data-dialog-mobile="compact"]'),'canonical UI CSS must own stretch controls and compact-mobile dialog geometry');
assert(/dialog\.dialog\{[^}]*overflow:visible/.test(uiCss)&&/dialog\.dialog>form\{[^}]*display:flex[^}]*overflow:visible/.test(uiCss)&&/\.dialog__body\{[^}]*overflow-y:auto/.test(uiCss),'canonical Dialog frame must keep floating menus unclipped while only the body owns scrolling');
assert(uiCss.includes('--dialog-max-height:min(720px,calc(100dvh - 72px))'),'compact mobile Dialog must keep a bounded RSS-like height with visible backdrop space');
assert(!appCss.includes('.add-option-field>.ui-select{width:100%;max-width:none}'),'Add must not restore a local Select width owner');

console.log('A17 Add Torrent contract passed: 4.1.0 / 4.6.7 / 5.2.3 exact Add source inventories drive renderer visibility, API-only forced stays hidden, canonical combos replace datalist, and successful Add closes only after the qB request.');
