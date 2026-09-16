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
function declarationExpression(text,name){const escaped=escapeRe(name),re=new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=\\s*([^;\\n]+)`,'g');let match,last=null;while((match=re.exec(text)))last=match[1];return last;}
function resolveExpression(text,expression,tokenPattern,token){const direct=numericFactor(expression,tokenPattern,token);if(direct!==null)return direct;const name=String(expression||'').trim();if(!/^[A-Za-z_$][\w$]*$/.test(name))return null;const declared=declarationExpression(text,name);return declared===null?null:numericFactor(declared,tokenPattern,token);}
function readExpression(text,id){
  const modern=new RegExp(`${modernControlPattern(id,'(?:value|checked)')}\\s*=\\s*([^;\\n]+)`,'g');let match,last=null;while((match=modern.exec(text)))last=match[1];if(last!==null)return last;
  const legacy=new RegExp(`\\$\\(\\s*["']${escapeRe(id)}["']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["'](?:value|checked)["']\\s*,\\s*([^;\\n]+)`,'g');while((match=legacy.exec(text)))last=match[1];return last;
}
function writeExpression(text,key){
  const escaped=escapeRe(key),patterns=[
    new RegExp(`settings\\s*\\[\\s*["']${escaped}["']\\s*\\]\\s*=\\s*([^;\\n]+)`,'g'),
    new RegExp(`\\b(?:settings|preferences)\\s*\\.\\s*${escaped}\\s*=\\s*([^;\\n]+)`,'g'),
    new RegExp(`settings\\s*\\.\\s*set\\(\\s*["']${escaped}["']\\s*,\\s*([^;\\n]+)\\)\\s*;?`,'g')
  ];
  let best=null,bestPos=-1;for(const re of patterns){let match;while((match=re.exec(text)))if((match.index??0)>=bestPos){best=match[1];bestPos=match.index??0;}}
  return best;
}
function controlTokenPattern(id){return `(?:Number\\(\\s*)?(?:${modernControlPattern(id,'value')}|${legacyControlPattern(id,'value')})(?:\\s*\\))?(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?`;}
function balancedBody(text,start){const open=String(text).indexOf('{',start);if(open<0)return'';let depth=0,quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i];if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return text.slice(open+1,i);}}return'';}
function assignedLiteral(segment,id){const escaped=escapeRe(id),patterns=[
  new RegExp(`${modernControlPattern(id,'value')}\\s*=\\s*["']([^"']*)["']`),
  new RegExp(`\\$\\(\\s*["']${escaped}["']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["']value["']\\s*,\\s*["']([^"']*)["']`)
];for(const re of patterns){const match=String(segment||'').match(re);if(match)return match[1];}return null;}
function switchProjection(text,key,id){const re=new RegExp(`\\bswitch\\s*\\(\\s*(?:Number\\s*\\(\\s*)?pref\\s*\\.\\s*${escapeRe(key)}(?:\\s*\\))?(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?\\s*\\)`,'g');let match;while((match=re.exec(text))){const body=balancedBody(text,match.index??0);if(!body)continue;const markers=[];for(const item of body.matchAll(/\bcase\s+([^:]+)\s*:|\bdefault\s*:/g))markers.push({pos:item.index??0,value:item[1]===undefined?null:String(item[1]).trim()});const values=[];let defaultValue=null;for(let i=0;i<markers.length;i++){const marker=markers[i],end=body.indexOf('break',marker.pos)>=0?body.indexOf('break',marker.pos):body.length,segment=body.slice(marker.pos,end),literal=assignedLiteral(segment,id);if(literal===null)continue;if(marker.value===null)defaultValue=literal;else{const raw=marker.value.replace(/^['"]|['"]$/g,'');if(!values.some(row=>row[0]===raw))values.push([raw,literal]);}}
    if(values.length||defaultValue!==null)return{kind:'switch-map',values,defaultValue,safeWrite:false};
  }
  return null;
}

export function extractQbPreferenceValueProjection(source,key,controlId){
  const text=String(source||''),pref=prefPattern(key),read=readExpression(text,controlId),write=writeExpression(text,key),switchMap=switchProjection(text,key,controlId);
  if(switchMap)return switchMap;
  const readFactor=read===null?null:resolveExpression(text,read,pref,'RAW');
  const controlPattern=controlTokenPattern(controlId),writeFactor=write===null?null:resolveExpression(text,write,controlPattern,'UI');
  if(readFactor===1&&writeFactor===1)return{kind:'identity',safeWrite:true};
  if(readFactor!==null&&writeFactor!==null&&readFactor>0&&writeFactor>0){const product=readFactor*writeFactor;if(Math.abs(product-1)<1e-12){const scale=writeFactor;if(Number.isFinite(scale)&&scale>0)return scale===1?{kind:'identity',safeWrite:true}:{kind:'scale',scale,safeWrite:true};}}
  if(readFactor!==null)return{kind:'unproven',safeWrite:false,readFactor,...(writeFactor!==null?{writeFactor}:{})};
  return{kind:'unproven',safeWrite:false};
}
