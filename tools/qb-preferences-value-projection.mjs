function escapeRe(value){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function stripOuterParens(value){let text=String(value||'').trim();for(;;){if(!(text.startsWith('(')&&text.endsWith(')')))return text;let depth=0,ok=true;for(let i=0;i<text.length;i++){if(text[i]==='(')depth++;else if(text[i]===')'){depth--;if(depth===0&&i<text.length-1){ok=false;break;}}}if(!ok||depth!==0)return text;text=text.slice(1,-1).trim();}}
function factorRest(value){
  const text=String(value||'').replace(/\s+/g,'');if(!text)return 1;
  let factor=1,pos=0;const re=/([*/])(-?\d+(?:\.\d+)?)/g;let match;
  while((match=re.exec(text))){if(match.index!==pos)return null;const n=Number(match[2]);if(!Number.isFinite(n)||n===0)return null;factor=match[1]==='*'?factor*n:factor/n;pos=re.lastIndex;}
  return pos===text.length&&Number.isFinite(factor)?factor:null;
}
function anchoredFactor(expression,tokenRegexes){
  const text=stripOuterParens(String(expression||'').trim());
  for(const re of tokenRegexes){const match=re.exec(text);if(match)return factorRest(text.slice(match[0].length));}
  return null;
}
function preferenceNumericFactor(expression,key){
  const escaped=escapeRe(key);
  return anchoredFactor(expression,[
    new RegExp(`^Number\\(\\s*pref\\s*\\.\\s*${escaped}\\s*\\)`),
    new RegExp(`^pref\\s*\\.\\s*${escaped}\\s*\\.\\s*toInt\\s*\\(\\s*\\)`),
    new RegExp(`^pref\\s*\\.\\s*${escaped}\\b`)
  ]);
}
function modernControlPattern(id,property='value'){return `document\\.getElementById\\(\\s*["']${escapeRe(id)}["']\\s*\\)\\s*\\.\\s*${property}`;}
function dollarControlPattern(id,property='value'){return `\\$\\(\\s*["']${escapeRe(id)}["']\\s*\\)\\s*\\.\\s*${property}`;}
function legacyControlPattern(id,property='value'){return `\\$\\(\\s*["']${escapeRe(id)}["']\\s*\\)\\s*\\.\\s*getProperty\\(\\s*["']${property}["']\\s*\\)`;}
function selectedControlPattern(id){const escaped=escapeRe(id);return '(?:document\\.getElementById\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*(?:selectedOptions\\s*\\[\\s*0\\s*\\]|getSelected\\(\\s*\\)\\s*\\[\\s*0\\s*\\])\\s*\\.\\s*value|\\$\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*getSelected\\(\\s*\\)\\s*\\[\\s*0\\s*\\]\\s*\\.\\s*value)';}
function controlNumericFactor(expression,id){
  const modern=modernControlPattern(id,'(?:value|checked)'),dollar=dollarControlPattern(id,'(?:value|checked)'),legacy=legacyControlPattern(id,'(?:value|checked)'),selected=selectedControlPattern(id);
  return anchoredFactor(expression,[
    new RegExp(`^Number\\(\\s*(?:${modern}|${dollar}|${legacy}|${selected})(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?\\s*\\)`),
    new RegExp(`^(?:${modern}|${dollar}|${legacy}|${selected})(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?`)
  ]);
}
function resolveExpression(expression,factor,declarations){const direct=factor(expression);if(direct!==null)return direct;const name=String(expression||'').trim();if(!/^[A-Za-z_$][\w$]*$/.test(name))return null;const declared=declarations.get(name);return declared===undefined?null:factor(declared);}
function balancedBody(text,start){const open=String(text).indexOf('{',start);if(open<0)return'';let depth=0,quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i];if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return text.slice(open+1,i);}}return'';}
function assignedLiteral(segment,id){const escaped=escapeRe(id),patterns=[
  new RegExp(`${modernControlPattern(id,'value')}\\s*=\\s*["']([^"']*)["']`),
  new RegExp(`\\$\\(\\s*["']${escaped}["']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["']value["']\\s*,\\s*["']([^"']*)["']`)
];for(const re of patterns){const match=String(segment||'').match(re);if(match)return match[1];}return null;}
function switchProjection(body,id){if(!body)return null;const markers=[];for(const item of body.matchAll(/\bcase\s+([^:]+)\s*:|\bdefault\s*:/g))markers.push({pos:item.index??0,value:item[1]===undefined?null:String(item[1]).trim()});const values=[];let defaultValue=null;for(let i=0;i<markers.length;i++){const marker=markers[i],breakPos=body.indexOf('break',marker.pos),end=breakPos>=0?breakPos:body.length,segment=body.slice(marker.pos,end),literal=assignedLiteral(segment,id);if(literal===null)continue;if(marker.value===null)defaultValue=literal;else{const raw=marker.value.replace(/^['"]|['"]$/g,'');if(!values.some(row=>row[0]===raw))values.push([raw,literal]);}}return values.length||defaultValue!==null?{kind:'switch-map',values,defaultValue,safeWrite:false}:null;}
function selectOptionValues(source,id){const escaped=escapeRe(id),match=String(source||'').match(new RegExp('<select\\b[^>]*\\bid\\s*=\\s*(["\\\'])'+escaped+'\\1[^>]*>([\\s\\S]*?)<\\/select>','i'));if(!match)return[];const out=[];for(const option of match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)){const attrs=option[1]||'',valueMatch=attrs.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);out.push(String(valueMatch?valueMatch[1]??valueMatch[2]??valueMatch[3]:'').trim());}return out;}
function selectedIndexExpression(source,id){const escaped=escapeRe(id),patterns=[
  new RegExp('document\\.getElementById\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*getChildren\\(\\s*["\\\']option["\\\']\\s*\\)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*selected\\s*=\\s*true'),
  new RegExp('\\$\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*getChildren\\(\\s*["\\\']option["\\\']\\s*\\)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*selected\\s*=\\s*true'),
  new RegExp('document\\.getElementById\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*options\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*selected\\s*=\\s*true')
];for(const re of patterns){const match=String(source||'').match(re);if(match)return String(match[1]||'').trim();}return null;}
function switchBodyForIndex(source,key,indexVariable,declarations){if(!indexVariable)return null;for(const match of String(source||'').matchAll(/\bswitch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g)){const factor=resolveExpression(match[1],value=>preferenceNumericFactor(value,key),declarations);if(factor!==1)continue;const body=balancedBody(source,match.index??0);if(body&&new RegExp('\\b'+escapeRe(indexVariable)+'\\s*=').test(body))return body;}return null;}
function switchIndexMap(body,variable,options,declarations){if(!body||!variable||!options.length)return null;const markers=[];for(const item of body.matchAll(/\bcase\s+([^:]+)\s*:|\bdefault\s*:/g))markers.push({pos:item.index??0,value:item[1]===undefined?null:String(item[1]).trim()});const values=[];for(let i=0;i<markers.length;i++){const marker=markers[i];if(marker.value===null)continue;const breakPos=body.indexOf('break',marker.pos),end=breakPos>=0?breakPos:body.length,segment=body.slice(marker.pos,end),assign=segment.match(new RegExp('\\b'+escapeRe(variable)+'\\s*=\\s*(\\d+)\\b'));if(!assign)continue;const index=Number(assign[1]),raw=marker.value.replace(/^['"]|['"]$/g,''),display=options[index];if(display===undefined)return null;values.push([raw,display]);}const initial=numericLiteral(declarations.get(variable));if(initial!==null&&Number.isInteger(initial)&&initial>=0&&initial<options.length&&!values.some(row=>String(row[0])===String(options[initial])))values.push([String(options[initial]),String(options[initial])]);return values.length?values:null;}
function selectedOptionIdentity(source,key,id,declarations,directSwitchBody){const options=selectOptionValues(source,id),indexExpression=selectedIndexExpression(source,id);if(!options.length||!indexExpression)return false;const direct=resolveExpression(indexExpression,value=>preferenceNumericFactor(value,key),declarations);if(direct===1&&options.every((value,index)=>String(value)===String(index)))return true;if(!/^[A-Za-z_$][\w$]*$/.test(indexExpression))return false;const switchBody=directSwitchBody||switchBodyForIndex(source,key,indexExpression,declarations),rows=switchIndexMap(switchBody,indexExpression,options,declarations);if(!rows||!rows.length)return false;return rows.every(row=>String(row[0])===String(row[1]))&&new Set(rows.map(row=>String(row[0]))).size===new Set(options.map(String)).size;}

function rememberLatest(map,key,value,pos,positions){const previous=positions.get(key)??-1;if(pos>=previous){map.set(key,value);positions.set(key,pos);}}
function numericLiteral(value){const text=stripOuterParens(String(value??'').trim());return/^-?\d+(?:\.\d+)?$/.test(text)?Number(text):null;}
function assignedExpression(segment,id,property='value'){
  const escaped=escapeRe(id),patterns=[
    new RegExp(modernControlPattern(id,property)+'\\s*=\\s*([^;\\n]+)'),
    new RegExp('\\$\\(\\s*["\']'+escaped+'["\']\\s*\\)\\s*\\.\\s*'+escapeRe(property)+'\\s*=\\s*([^;\\n]+)'),
    new RegExp('\\$\\(\\s*["\']'+escaped+'["\']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["\']'+escapeRe(property)+'["\']\\s*,\\s*([^;\\n\\)]+(?:\\)[^;\\n\\)]*)?)\\s*\\)')
  ];
  for(const re of patterns){const match=String(segment||'').match(re);if(match)return String(match[1]||'').trim();}
  return null;
}
function checkedControl(segment,expected){
  const bool=expected?'true':'false',patterns=[
    new RegExp('document\\.getElementById\\(\\s*["\']([^"\']+)["\']\\s*\\)\\s*\\.\\s*checked\\s*=\\s*'+bool+'\\b'),
    new RegExp('\\$\\(\\s*["\']([^"\']+)["\']\\s*\\)\\s*\\.\\s*checked\\s*=\\s*'+bool+'\\b'),
    new RegExp('\\$\\(\\s*["\']([^"\']+)["\']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["\']checked["\']\\s*,\\s*'+bool+'\\s*\\)')
  ];
  for(const re of patterns){const match=String(segment||'').match(re);if(match)return String(match[1]||'');}
  return null;
}
function emptyStringValue(value){const text=stripOuterParens(String(value??'').trim());return text==='""'||text==="''"?'':null;}
function directControlValue(value,id){
  const text=stripOuterParens(String(value||'').trim());
  return new RegExp('^'+modernControlPattern(id,'value')+'$').test(text)
    ||new RegExp('^'+dollarControlPattern(id,'value')+'$').test(text)
    ||new RegExp('^'+legacyControlPattern(id,'value')+'$').test(text)
    ||new RegExp('^'+selectedControlPattern(id)+'$').test(text);
}
function presenceGateProjection(source,key,controlId){
  const text=String(source||''),escapedKey=escapeRe(key);
  const readRe=new RegExp('if\\s*\\(\\s*pref\\s*\\.\\s*'+escapedKey+'\\s*!={1,2}\\s*(?:""|\'\')\\s*\\)\\s*\\{([\\s\\S]*?)\\}\\s*else\\s*\\{([\\s\\S]*?)\\}','g');
  let readGate=null;
  for(const match of text.matchAll(readRe)){
    const on=match[1]||'',off=match[2]||'',onGate=checkedControl(on,true),offGate=checkedControl(off,false);
    if(!onGate||onGate!==offGate)continue;
    const onValue=stripOuterParens(String(assignedExpression(on,controlId)||'').trim()),offValue=assignedExpression(off,controlId);
    if(onValue!==('pref.'+key)||emptyStringValue(offValue)!=='')continue;
    readGate=onGate;break;
  }
  if(!readGate)return null;
  const gate=escapeRe(readGate),modern='document\\.getElementById\\(\\s*["\']'+gate+'["\']\\s*\\)\\s*\\.\\s*checked',dollar='\\$\\(\\s*["\']'+gate+'["\']\\s*\\)\\s*\\.\\s*(?:checked|getProperty\\(\\s*["\']checked["\']\\s*\\))',gateAccess='(?:'+modern+'|'+dollar+')';
  const bracketAssignment='settings\\s*\\[\\s*["\']'+escapedKey+'["\']\\s*\\]\\s*=\\s*([^;\\n]+)\\s*;';
  const bracketWrite=new RegExp('if\\s*\\(\\s*'+gateAccess+'\\s*\\)\\s*(?:\\{\\s*)?'+bracketAssignment+'\\s*(?:\\}\\s*)?else\\s*(?:\\{\\s*)?'+bracketAssignment,'g');
  for(const match of text.matchAll(bracketWrite)){if(directControlValue(match[1],controlId)&&emptyStringValue(match[2])==='')return{kind:'presence-gate',gateControlId:readGate,disabledValue:'',enabledWhen:{kind:'non-empty'},safeWrite:true};}
  const setAssignment='settings\\s*\\.\\s*set\\(\\s*["\']'+escapedKey+'["\']\\s*,\\s*([\\s\\S]*?)\\)\\s*;';
  const setWrite=new RegExp('if\\s*\\(\\s*'+gateAccess+'\\s*\\)\\s*(?:\\{\\s*)?'+setAssignment+'\\s*(?:\\}\\s*)?else\\s*(?:\\{\\s*)?'+setAssignment,'g');
  for(const match of text.matchAll(setWrite)){if(directControlValue(match[1],controlId)&&emptyStringValue(match[2])==='')return{kind:'presence-gate',gateControlId:readGate,disabledValue:'',enabledWhen:{kind:'non-empty'},safeWrite:true};}
  return null;
}
function sentinelGateProjection(source,key,controlId,writes,declarations){
  const text=String(source||''),writeExpression=String(writes.get(String(key))??'').trim();
  if(!/^[A-Za-z_$][\w$]*$/.test(writeExpression))return null;
  const disabledValue=numericLiteral(declarations.get(writeExpression));if(disabledValue===null)return null;
  let readVar=null,readFactor=null;
  for(const match of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)){
    const factor=preferenceNumericFactor(match[2],key);
    if(factor!==null&&factor>0){readVar=String(match[1]);readFactor=factor;break;}
  }
  if(!readVar||!Number.isFinite(readFactor)||readFactor<=0)return null;
  const readRe=new RegExp('if\\s*\\(\\s*'+escapeRe(readVar)+'\\s*<=\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)\\s*\\{([\\s\\S]*?)\\}\\s*else\\s*\\{([\\s\\S]*?)\\}','g');
  let readMatch=null;
  for(const match of text.matchAll(readRe)){
    const off=match[2]||'',on=match[3]||'',offGate=checkedControl(off,false),onGate=checkedControl(on,true);
    if(!offGate||offGate!==onGate)continue;
    const fallbackExpression=assignedExpression(off,controlId),fallback=fallbackExpression===null?null:numericLiteral(fallbackExpression),onValue=assignedExpression(on,controlId);
    if(String(onValue||'').trim()!==readVar)continue;
    const uiThreshold=Number(match[1]),rawThreshold=uiThreshold/readFactor;
    if(!Number.isFinite(rawThreshold))continue;
    readMatch={rawThreshold,gateControlId:offGate,defaultValue:fallback};break;
  }
  if(!readMatch)return null;
  const gate=escapeRe(readMatch.gateControlId),modern='document\\.getElementById\\(\\s*["\']'+gate+'["\']\\s*\\)\\s*\\.\\s*checked',dollar='\\$\\(\\s*["\']'+gate+'["\']\\s*\\)\\s*\\.\\s*checked',legacy='\\$\\(\\s*["\']'+gate+'["\']\\s*\\)\\s*\\.\\s*getProperty\\(\\s*["\']checked["\']\\s*\\)';
  const writeIf=new RegExp('if\\s*\\(\\s*(?:'+modern+'|'+dollar+'|'+legacy+')\\s*\\)\\s*\\{([\\s\\S]*?)\\}','g');
  let writeFactor=null;
  for(const match of text.matchAll(writeIf)){
    const body=match[1]||'',assignment=body.match(new RegExp('\\b'+escapeRe(writeExpression)+'\\s*=\\s*([^;\\n]+)'));
    if(!assignment)continue;writeFactor=controlNumericFactor(assignment[1],controlId);if(writeFactor!==null)break;
  }
  if(writeFactor===null||writeFactor<=0||Math.abs((readFactor*writeFactor)-1)>1e-12||disabledValue>readMatch.rawThreshold)return null;
  if(readMatch.defaultValue!==null&&readMatch.defaultValue<=readMatch.rawThreshold*readFactor)return null;
  return{kind:'sentinel-gate',gateControlId:readMatch.gateControlId,disabledValue,defaultValue:readMatch.defaultValue,enabledWhen:{kind:'gt',value:readMatch.rawThreshold},safeWrite:true,...(writeFactor===1?{}:{scale:writeFactor})};
}

export function createQbPreferenceValueProjector(source){
  const text=String(source||''),reads=new Map(),writes=new Map(),declarations=new Map(),switches=new Map(),readPos=new Map(),writePos=new Map();let match;
  const declarationRe=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  while((match=declarationRe.exec(text)))declarations.set(match[1],match[2]);
  const modernRead=/document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:value|checked)\s*=\s*([^;\n]+)/g;
  while((match=modernRead.exec(text)))rememberLatest(reads,match[1],match[2],match.index??0,readPos);
  const dollarRead=/\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:value|checked)\s*=\s*([^;\n]+)/g;
  while((match=dollarRead.exec(text)))rememberLatest(reads,match[1],match[2],match.index??0,readPos);
  const legacyRead=/\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:setProperty|set)\(\s*["'](?:value|checked)["']\s*,\s*([^;\n]+)\)\s*;?/g;
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
    const presence=presenceGateProjection(text,key,controlId);if(presence)return presence;
    const sentinel=sentinelGateProjection(text,key,controlId,writes,declarations);if(sentinel)return sentinel;
    const read=reads.get(String(controlId)),write=writes.get(String(key));
    const readFactor=read===undefined?null:resolveExpression(read,value=>preferenceNumericFactor(value,key),declarations),writeFactor=write===undefined?null:resolveExpression(write,value=>controlNumericFactor(value,controlId),declarations);
    if(writeFactor===1&&selectedOptionIdentity(text,key,controlId,declarations,switches.get(String(key))))return{kind:'identity',safeWrite:true};
    const switchMap=switchProjection(switches.get(String(key)),controlId);if(switchMap)return switchMap;
    if(readFactor===1&&writeFactor===1)return{kind:'identity',safeWrite:true};
    if(readFactor!==null&&writeFactor!==null&&readFactor>0&&writeFactor>0){const product=readFactor*writeFactor;if(Math.abs(product-1)<1e-12){const scale=writeFactor;if(Number.isFinite(scale)&&scale>0)return scale===1?{kind:'identity',safeWrite:true}:{kind:'scale',scale,safeWrite:true};}}
    if(readFactor!==null)return{kind:'unproven',safeWrite:false,readFactor,...(writeFactor!==null?{writeFactor}:{})};
    if(writeFactor!==null)return{kind:'unproven',safeWrite:false,writeFactor};
    return{kind:'unproven',safeWrite:false};
  };
}

let cachedSource=null,cachedProjector=null;
export function extractQbPreferenceValueProjection(source,key,controlId){const text=String(source||'');if(text!==cachedSource){cachedSource=text;cachedProjector=createQbPreferenceValueProjector(text);}return cachedProjector(key,controlId);}
