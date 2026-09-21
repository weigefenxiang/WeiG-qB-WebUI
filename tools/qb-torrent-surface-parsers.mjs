function extractFunctionBody(source,signature,label){
  const text=String(source||''),start=text.search(signature);
  if(start<0)throw new Error(`${label}: missing expected function`);
  const open=text.indexOf('{',start);if(open<0)throw new Error(`${label}: missing function body`);
  let depth=0,inString=false,quote='',escape=false;
  for(let i=open;i<text.length;i++){
    const ch=text[i];
    if(inString){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)inString=false;continue;}
    if(ch==='"'||ch==="'"){inString=true;quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return text.slice(open+1,i);
  }
  throw new Error(`${label}: unterminated function body`);
}
function literals(text){return [...String(text||'').matchAll(/(?:u|QLatin1String\s*\(|QStringLiteral\s*\()?\s*"([A-Za-z0-9_]+)"(?:_s)?\s*\)?/g)].map(m=>m[1]);}
function unique(values){return [...new Set(values.filter(Boolean))];}
export function canonicalTorrentFilters(values){return unique((values||[]).map(value=>value==='paused'?'stopped':value==='resumed'?'running':String(value)));}
export function extractTorrentFilters({torrentFilterSource='',torrentsControllerSource=''}={},context='qB source'){
  let names=[];
  try{const body=extractFunctionBody(torrentFilterSource,/\bTorrentFilter::setTypeByName\s*\(/,`${context}: TorrentFilter::setTypeByName`);names=literals(body);}catch(_legacy){}
  if(!names.length){try{const body=extractFunctionBody(torrentsControllerSource,/\bparseTorrentStatus\s*\(/,`${context}: parseTorrentStatus`);names=literals(body);}catch(_modern){}}
  const known=new Set(['downloading','seeding','completed','paused','resumed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored']);
  names=unique(names.filter(name=>known.has(name)));
  if(!names.length)throw new Error(`${context}: unable to extract Torrent filter surface`);
  return ['all',...names.filter(name=>name!=='all')];
}
export function extractTorrentInfoParameters(source,context='qB source'){
  let body;try{body=extractFunctionBody(source,/\bTorrentsController::infoAction\s*\(/,`${context}: TorrentsController::infoAction`);}catch(_error){throw new Error(`${context}: missing TorrentsController::infoAction`);}
  const found=[];
  const direct=/params\s*\(\s*\)\s*\[([^\]]+)\]/g;for(const match of body.matchAll(direct)){const value=literals(match[1])[0];if(value)found.push(value);}
  const optional=/\bgetOptional[A-Za-z0-9_]*\s*\(\s*params\s*\(\s*\)\s*,\s*([^,\)]+(?:\([^\)]*\))?)/g;for(const match of body.matchAll(optional)){const value=literals(match[1])[0];if(value)found.push(value);}
  const valueCall=/params\s*\(\s*\)\s*\.\s*(?:value|contains)\s*\(([^\)]+)\)/g;for(const match of body.matchAll(valueCall)){const value=literals(match[1])[0];if(value)found.push(value);}
  const out=unique(found).sort();if(!out.includes('filter'))throw new Error(`${context}: torrents/info parameter extraction did not find filter`);return out;
}
