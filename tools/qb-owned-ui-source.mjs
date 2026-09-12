#!/usr/bin/env node

function decodeHtml(value){
  return String(value||'')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'")
    .replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(Number.parseInt(n,16)))
    .replace(/&amp;/g,'&')
    .replace(/<[^>]*>/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function qbtTr(value){
  const match=String(value||'').match(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/i);
  if(!match)return null;
  const source=decodeHtml(match[1]),context=String(match[2]||'').trim();
  return source&&context?{source,context}:null;
}

function add(out,key,ref){if(key&&ref&&ref.source&&ref.context)out[key]={source:String(ref.source),context:String(ref.context)};}

function itemRef(markup,id){
  const escaped=String(id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const hit=String(markup||'').match(new RegExp(`<li\\b[^>]*\\bid=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/li>`,'i'));
  return hit?qbtTr(hit[1]):null;
}

function exactRef(markup,source,context='OptionsDialog'){
  const escaped=String(source).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const escapedContext=String(context).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=String(markup||'').match(new RegExp(`QBT_TR\\(${escaped}\\)QBT_TR\\[CONTEXT=${escapedContext}\\]`));
  return match?{source,context}:null;
}

export function extractQbOwnedUiFacts({preferencesSource='',toolbarSource='',filtersSource=''}={}){
  const out={};
  const toolbar=toolbarSource||preferencesSource;
  const tabs={
    'settings.tab.downloads':'PrefDownloadsLink',
    'settings.tab.connection':'PrefConnectionLink',
    'settings.tab.speed':'PrefSpeedLink',
    'settings.tab.bittorrent':'PrefBittorrentLink',
    'settings.tab.webui':'PrefWebUILink',
    'settings.tab.advanced':'PrefAdvancedLink'
  };
  for(const [key,id] of Object.entries(tabs))add(out,key,itemRef(toolbar,id));

  add(out,'transfer.rate.global',exactRef(preferencesSource,'Global Rate Limits'));
  add(out,'transfer.rate.alternative',exactRef(preferencesSource,'Alternative Rate Limits'));

  const filters=['all','downloading','seeding','completed','resumed','paused','running','stopped','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'];
  for(const name of filters)add(out,`filter.${name}`,itemRef(filtersSource,`${name}_filter`));
  return out;
}

export function translationSourcesForQbOwnedUi(ui){
  const out=[];
  for(const ref of Object.values(ui||{}))if(ref?.source&&!out.includes(ref.source))out.push(ref.source);
  return out;
}

export function translationContextsForQbOwnedUi(ui){
  const out=[];
  for(const ref of Object.values(ui||{}))if(ref?.context&&!out.includes(ref.context))out.push(ref.context);
  return out;
}
