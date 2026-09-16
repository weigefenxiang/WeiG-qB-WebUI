function escapeRe(value){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function stripOuterParens(value){let text=String(value||'').trim();for(;;){if(!(text.startsWith('(')&&text.endsWith(')')))return text;let depth=0,ok=true;for(let i=0;i<text.length;i++){if(text[i]==='(')depth++;else if(text[i]===')'){depth--;if(depth===0&&i<text.length-1){ok=false;break;}}}if(!ok||depth!==0)return text;text=text.slice(1,-1).trim();}}
function numericFactor(expression,tokenPattern,token='X'){
  let text=String(expression||'').trim();
  text=text.replace(new RegExp(`Number\\(\\s*${tokenPattern}\\s*\\)`,'g'),token)
    .replace(new RegExp(`${tokenPattern}\\s*\\.\\s*toInt\\s*\\(\\s*\\)`,'g'),token)
    .replace(new RegExp(tokenPattern,'g'),token);
  text=stripOuterParens(text).replace(/\s+/g,'');
  while(/^\(.+\)$/.test(text))text=stripOuterParens(text).replace(/\s+/g,'');
  if(!text.startsWith(token))return null;
  const rest=text.slice(token.length);if(!rest)return 1;
  let factor=1,pos=0;const re=/([*/])(-?\d+(?:\.\d+)?)/g;let match;
  while((match=re.exec(rest))){if(match.index!==pos)return null;const n=Number(match[2]);if(!Number.isFinite(n)||n===0)return null;factor=match[1]==='*'?factor*n:factor/n;pos=re.lastIndex;}
  return pos===rest.length&&Number.isFinite(factor)?factor:null;
}
function prefPattern(key){return `\\bpref\\s*\\.\\s*${escapeRe(key)}\\b`;}
function modernControlPattern(id,property='value'){return `document\\.getElementById\\(\\s*["']${escapeRe(id)}["']\\s*\\)\\s*\\.\\s*${property}`;}
function legacyControlPattern(id,property='value'){return `\\$\\(\\s*["']${escapeRe(id)}["']\\s*\\)\\s*\\.\\s*getProperty\\(\\s*["']${property}["']\\s*\\)`;}
function controlTokenPattern(id){return `(?:Number\\(\\s*)?(?:${modernControlPattern(id,'(?:value|checked)')}|${legacyControlPattern(id,'(?:value|checked)')})(?:\\s*\\))?(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?`;}
function resolveExpression(expression,tokenPattern,token,declarations){const direct=numericFactor(expression,tokenPattern,token);if(direct!==null)return direct;const name=String(expression||'').trim();if(!/^[A-Za-z_$][\w$]*$/.test(name))return null;const declared=declarations.get(name);return declared===undefined?null:numericFactor(declared,tokenPattern,token);}
function balancedBody(text,start){const open=String(text).indexOf('{',start);if(open<0)return'';let depth=0,quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i];if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return text.slice(open+1,i);}}return'';}
function assignedLiteral(segment,id){const escaped=escapeRe(id),patterns=[
  new RegExp(`${modernControlPattern(id,'value')}\\s*=\\s*["']([^"']*)["']`),
  new RegExp(`\\$\\(\\s*["']${escaped}["']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["']value["']\\s*,\\s*["']([^"']*)["']`)
];for(const re of patterns){const match=String(segment||'').match(re);if(match)return match[1];}return null;}
function switchProjection(body,id){if(!body)return null;const markers=[];for(const item of body.matchAll(/\bcase\s+([^:]+)\s*:|\bdefault\s*:/g))markers.push({pos:item.index??0,value:item[1]===undefined?null:String(item[1]).trim()});const values=[];let defaultValue=null;for(let i=0;i<markers.length;i++){const marker=markers[i],breakPos=body.indexOf('break',marker.pos),end=breakPos>=0?breakPos:body.length,segment=body.slice(marker.pos,end),literal=assignedLiteral(segment,id);if(literal===null)continue;if(marker.value===null)defaultValue=literal;else{const raw=marker.value.replace(/^['"]|['"]$/g,'');if(!values.some(row=>row[0]===raw))values.push([raw,literal]);}}return values.length||defaultValue!==null?{kind:'switch-map',values,defaultValue,safeWrite:false}:null;}
function rememberLatest(map,key,value,pos,positions){const previous=positions.get(key)??-1;if(pos>=previous){map.set(key,value);positions.set(key,pos);}}

export function createQbPreferenceValueProjector(source){
  const text=String(source||''),reads=new Map(),writes=new Map(),declarations=new Map(),switches=new Map(),readPos=new Map(),writePos=new Map();let match;
  const declarationRe=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  while((match=declarationRe.exec(text)))declarations.set(match[1],match[2]);
  const modernRead=/document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:value|checked)\s*=\s*([^;\n]+)/g;
  while((match=modernRead.exec(text)))rememberLatest(reads,match[1],match[2],match.index??0,readPos);
  const legacyRead=/\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:setProperty|set)\(\s*["'](?:value|checked)["']\s*,\s*([^;\n]+)/g;
  while((match=legacyRead.exec(text)))rememberLatest(reads,match[1],match[2],match.index??0,readPos);
  const bracketWrite=/settings\s*\[\s*["']([^"']+)["']\s*\]\s*=\s*([^;\n]+)/g;
  while((match=bracketWrite.exec(text)))rememberLatest(writes,match[1],match[2],match.index??0,writePos);
  const dotWrite=/\b(?:settings|preferences)\s*\.\s*([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  while((match=dotWrite.exec(text)))rememberLatest(writes,match[1],match[2],match.index??0,writePos);
  const setWrite=/settings\s*\.\s*set\(\s*["']([^"']+)["']\s*,\s*([^;\n]+)\)\s*;?/g;
  while((match=setWrite.exec(text)))rememberLatest(writes,match[1],match[2],match.index??0,writePos);
  const switchRe=/\bswitch\s*\(\s*(?:Number\s*\(\s*)?pref\s*\.\s*([A-Za-z_$][\w$]*)(?:\s*\))?(?:\s*\.\s*toInt\s*\(\s*\))?\s*\)/g;
  while((match=switchRe.exec(text))){const body=balancedBody(text,match.index??0);if(body)switches.set(match[1],body);}
  return function project(key,controlId){
    const pref=prefPattern(key),switchMap=switchProjection(switches.get(String(key)),controlId);if(switchMap)return switchMap;
    const read=reads.get(String(controlId)),write=writes.get(String(key));
    const readFactor=read===undefined?null:resolveExpression(read,pref,'RAW',declarations),controlPattern=controlTokenPattern(controlId),writeFactor=write===undefined?null:resolveExpression(write,controlPattern,'UI',declarations);
    if(readFactor===1&&writeFactor===1)return{kind:'identity',safeWrite:true};
    if(readFactor!==null&&writeFactor!==null&&readFactor>0&&writeFactor>0){const product=readFactor*writeFactor;if(Math.abs(product-1)<1e-12){const scale=writeFactor;if(Number.isFinite(scale)&&scale>0)return scale===1?{kind:'identity',safeWrite:true}:{kind:'scale',scale,safeWrite:true};}}
    if(readFactor!==null)return{kind:'unproven',safeWrite:false,readFactor,...(writeFactor!==null?{writeFactor}:{})};
    return{kind:'unproven',safeWrite:false};
  };
}

let cachedSource=null,cachedProjector=null;
export function extractQbPreferenceValueProjection(source,key,controlId){const text=String(source||'');if(text!==cachedSource){cachedSource=text;cachedProjector=createQbPreferenceValueProjector(text);}return cachedProjector(key,controlId);}
