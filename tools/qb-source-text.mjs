const NAMED_ENTITIES=Object.freeze({
  amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',
  copy:'©',reg:'®',trade:'™',hellip:'…',ndash:'–',mdash:'—',
  lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',laquo:'«',raquo:'»',
  middot:'·',bull:'•',times:'×',divide:'÷',plusmn:'±',deg:'°'
});
const ENTITY_RE=/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi;
const QBT_TR_RE=/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/gi;
const QBT_MARKER_RE=/QBT_TR\(([\s\S]*?)\)QBT_TR(?:\[CONTEXT=([^\]]+)\])?/gi;
function scalar(code){return Number.isInteger(code)&&code>=0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff);}
function entityValue(token){
  const body=String(token||'').slice(1,-1);
  if(/^#x/i.test(body)){const code=Number.parseInt(body.slice(2),16);return scalar(code)?String.fromCodePoint(code):null;}
  if(/^#\d+$/.test(body)){const code=Number.parseInt(body.slice(1),10);return scalar(code)?String.fromCodePoint(code):null;}
  return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES,body.toLowerCase())?NAMED_ENTITIES[body.toLowerCase()]:null;
}
export function decodeQbEntityLayer(value){return String(value??'').replace(ENTITY_RE,token=>{const decoded=entityValue(token);return decoded===null?token:decoded;});}
function unwrapCdata(value){return String(value??'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');}
export function canonicalizeQbText(value,{collapseWhitespace=false,trim=false,maxEntityLayers=8}={}){
  let text=unwrapCdata(value);
  for(let layer=0;layer<maxEntityLayers;layer++){const next=unwrapCdata(decodeQbEntityLayer(text));if(next===text)break;text=next;}
  if(collapseWhitespace)text=text.replace(/\s+/g,' ');
  return trim?text.trim():text;
}
export function canonicalQbSourceText(value){return canonicalizeQbText(value,{trim:true});}
export function canonicalQbDisplayText(value){return canonicalizeQbText(value,{trim:true});}
export function canonicalQbHtmlText(value){return canonicalizeQbText(String(value??'').replace(/<[^>]*>/g,''),{collapseWhitespace:true,trim:true});}
export function canonicalQbContext(value){return canonicalQbSourceText(value);}
export function canonicalQbRef(ref){if(!ref)return null;const context=canonicalQbContext(ref.context),source=canonicalQbSourceText(ref.source);return context&&source?{context,source}:null;}
export function qbSourceRefKey(context,source){return canonicalQbContext(context)+'\u0000'+canonicalQbSourceText(source);}
export function parseQbtSourceRef(value){const match=String(value??'').match(new RegExp(QBT_TR_RE.source,'i'));if(!match)return null;return canonicalQbRef({source:canonicalQbHtmlText(match[1]),context:match[2]});}
export function extractQbtSourceRefs(value){const out=[];for(const match of String(value??'').matchAll(new RegExp(QBT_TR_RE.source,'gi'))){const ref=canonicalQbRef({source:canonicalQbHtmlText(match[1]),context:match[2]});if(ref)out.push(ref);}return out;}
export function auditQbEntityText(value){
  const raw=String(value??'');let text=unwrapCdata(raw),layers=0;ENTITY_RE.lastIndex=0;const hadEntities=ENTITY_RE.test(text);ENTITY_RE.lastIndex=0;
  for(;layers<8;layers++){const next=unwrapCdata(decodeQbEntityLayer(text));if(next===text)break;text=next;}
  ENTITY_RE.lastIndex=0;const unresolved=[...new Set(text.match(ENTITY_RE)||[])].sort();ENTITY_RE.lastIndex=0;
  return{hadEntities,layers,canonical:canonicalQbSourceText(raw),unresolved};
}
export function auditQbtSourceEntities(value){
  let markers=0,entityBearing=0,multiLayer=0;const unresolved=[];
  for(const match of String(value??'').matchAll(new RegExp(QBT_MARKER_RE.source,'gi'))){markers++;const audit=auditQbEntityText(match[1]);if(audit.hadEntities)entityBearing++;if(audit.layers>1)multiLayer++;for(const token of audit.unresolved)if(!unresolved.includes(token))unresolved.push(token);}
  unresolved.sort();return{markers,entityBearing,multiLayer,unresolved};
}
