#!/usr/bin/env node
import crypto from 'node:crypto';
import {extractTorrentTableColumns} from './qb-torrent-fields-parser.mjs';
import {canonicalQbHtmlText,extractQbtSourceRefs,parseQbtSourceRef,qbSourceRefKey} from './qb-source-text.mjs';
import {extractTrackerFilterFacts} from './qb-tracker-filter-source.mjs';

function decodeHtml(value){return canonicalQbHtmlText(value);}
function qbtTr(value){return parseQbtSourceRef(value);}
function add(out,key,ref){if(key&&ref&&ref.source&&ref.context)out[key]={source:String(ref.source),context:String(ref.context)};}
function itemRef(markup,id){const escaped=String(id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const hit=String(markup||'').match(new RegExp(`<li\\b[^>]*\\bid=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/li>`,'i'));return hit?qbtTr(hit[1]):null;}
function exactRef(markup,source,context='OptionsDialog'){const escaped=String(source).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),escapedContext=String(context).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=String(markup||'').match(new RegExp(`QBT_TR\\(${escaped}\\)QBT_TR\\[CONTEXT=${escapedContext}\\]`));return match?{source,context}:null;}
function settingsTabIdentity(linkId){const match=String(linkId||'').match(/^Pref(.+?)Link$/i);if(!match)return null;const tab=String(match[1]||'').replace(/[^A-Za-z0-9]+/g,'').toLowerCase();return tab||null;}
export function settingsTabRefs(markup){
  const out=[],seen=new Set();
  for(const match of String(markup||'').matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)){
    const id=(String(match[1]||'').match(/\bid\s*=\s*["']([^"']+)["']/i)||[])[1],tab=settingsTabIdentity(id);
    if(!tab||seen.has(tab))continue;
    const ref=qbtTr(match[2]);
    if(!ref||!ref.source||!ref.context)continue;
    seen.add(tab);out.push({tab,key:`settings.tab.${tab}`,id,ref});
  }
  return out;
}
function ownedRefId(ref){return crypto.createHash('sha256').update(qbSourceRefKey(ref.context,ref.source)).digest('hex').slice(0,16);}
function addSourceFamily(out,prefix,markup){
  const seen=new Set();
  for(const ref of extractQbtSourceRefs(markup||'')){
    const identity=qbSourceRefKey(ref.context,ref.source);if(seen.has(identity))continue;seen.add(identity);add(out,`${prefix}.${ownedRefId(ref)}`,ref);
  }
}
function firstSourceRef(markups,candidates){
  const pools=(markups||[]).map(markup=>extractQbtSourceRefs(markup||''));
  for(const source of candidates||[])for(const refs of pools){const hit=refs.find(ref=>String(ref.source)===String(source));if(hit)return hit;}
  return null;
}
function addTorrentOwnedUiFacts(out,{addTorrentSource='',downloadSource='',indexSource=''}={}){
  addSourceFamily(out,'add.copy',addTorrentSource);
  if(downloadSource!==addTorrentSource)addSourceFamily(out,'add.copy',downloadSource);
  const fileRef=firstSourceRef([indexSource],['Add Torrent File...','&Add Torrent File...']);
  if(fileRef)add(out,'add.files',fileRef);
  add(out,'add.title',firstSourceRef([addTorrentSource,downloadSource],['Add torrent','Add Torrent','Add Torrent Links','Download Torrents from their URLs or Magnet links']));
  add(out,'add.links',firstSourceRef([downloadSource,indexSource],['Add torrent links','Add Torrent Links','Add Torrent Link...','&Add Torrent Link...','URLs','Download Torrents from their URLs or Magnet links']));
  add(out,'add.submit',firstSourceRef([addTorrentSource,downloadSource],['Add Torrent','Download']));
}
function torrentStatusRefs(source){
  const text=String(source||''),start=Math.max(text.indexOf("this.columns['status'].updateTd"),text.indexOf('this.columns["status"].updateTd'));
  const endCandidates=start>=0?[text.indexOf('// priority',start+1),text.indexOf('this.columns["priority"].updateTd',start+1),text.indexOf("this.columns['priority'].updateTd",start+1)].filter(index=>index>start):[];
  const block=start>=0?text.slice(start,endCandidates.length?Math.min(...endCandidates):undefined):text,out={};
  const group=/((?:\s*case\s+["'][^"']+["']\s*:\s*)+)\s*status\s*=\s*["']QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]["']\s*;/g;
  for(const match of block.matchAll(group)){
    const ref={source:decodeHtml(match[2]),context:String(match[3]||'').trim()};
    for(const state of match[1].matchAll(/case\s+["']([^"']+)["']/g))if(state[1]&&!out[state[1]])out[state[1]]=ref;
  }
  return out;
}

export function extractQbOwnedUiFacts({preferencesSource='',toolbarSource='',filtersSource='',dynamicTableSource='',clientSource='',addTorrentSource='',downloadSource='',indexSource=''}={}){
  const out={},toolbar=toolbarSource||preferencesSource;
  for(const item of settingsTabRefs(toolbar))add(out,item.key,item.ref);
  add(out,'transfer.rate.global',exactRef(preferencesSource,'Global Rate Limits'));
  add(out,'transfer.rate.alternative',exactRef(preferencesSource,'Alternative Rate Limits'));
  add(out,'sidebar.status',exactRef(filtersSource,'Status','TransferListFiltersWidget'));
  add(out,'sidebar.categories',exactRef(filtersSource,'Categories','TransferListFiltersWidget'));
  add(out,'sidebar.tags',exactRef(filtersSource,'Tags','TransferListFiltersWidget'));
  add(out,'sidebar.trackers',exactRef(filtersSource,'Trackers','TransferListFiltersWidget'));
  add(out,'route.rss',firstSourceRef([indexSource],['RSS','RSS Reader']));
  add(out,'route.logs',firstSourceRef([indexSource],['Execution Log','Log']));
  add(out,'route.settings',firstSourceRef([indexSource],['Options','&Options...','Options...','&Options']));
  const filters=['all','downloading','seeding','completed','resumed','paused','running','stopped','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'];
  for(const name of filters)add(out,`filter.${name}`,itemRef(filtersSource,`${name}_filter`));
  for(const item of extractTrackerFilterFacts(clientSource))add(out,`tracker.filter.${item.id}`,item.copy);
  addTorrentOwnedUiFacts(out,{addTorrentSource,downloadSource,indexSource});
  if(dynamicTableSource){
    for(const column of extractTorrentTableColumns(dynamicTableSource,'qB dynamicTable owned UI'))if(column.translation)add(out,`column.${column.key}`,column.translation);
    const states=torrentStatusRefs(dynamicTableSource);
    for(const [state,ref] of Object.entries(states))add(out,`state.${state}`,ref);
    if(!out['filter.moving']&&states.moving)add(out,'filter.moving',states.moving);
  }
  return out;
}
export function translationSourcesForQbOwnedUi(ui){const out=[];for(const ref of Object.values(ui||{}))if(ref?.source&&!out.includes(ref.source))out.push(ref.source);return out;}
export function translationContextsForQbOwnedUi(ui){const out=[];for(const ref of Object.values(ui||{}))if(ref?.context&&!out.includes(ref.context))out.push(ref.context);return out;}
