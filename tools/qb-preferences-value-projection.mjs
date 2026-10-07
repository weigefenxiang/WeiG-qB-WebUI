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
function selectedControlPattern(id){const escaped=escapeRe(id),selectedValue="(?:\\.\\s*value|\\.\\s*getProperty\\(\\s*[\"']value[\"']\\s*\\))";return "(?:document\\.getElementById\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*selectedOptions\\s*\\[\\s*0\\s*\\]\\s*\\.\\s*value|document\\.getElementById\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*getSelected\\(\\s*\\)\\s*\\[\\s*0\\s*\\]"+selectedValue+"|\\$\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*getSelected\\(\\s*\\)\\s*\\[\\s*0\\s*\\]"+selectedValue+")";}
function controlNumericFactor(expression,id){
  const modern=modernControlPattern(id,'(?:value|checked)'),dollar=dollarControlPattern(id,'(?:value|checked)'),legacy=legacyControlPattern(id,'(?:value|checked)'),selected=selectedControlPattern(id);
  return anchoredFactor(expression,[
    new RegExp(`^Number\\(\\s*(?:${modern}|${dollar}|${legacy}|${selected})(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?\\s*\\)`),
    new RegExp(`^(?:${modern}|${dollar}|${legacy}|${selected})(?:\\s*\\.\\s*toInt\\s*\\(\\s*\\))?`)
  ]);
}
function resolveExpression(expression,factor,declarations){const direct=factor(expression);if(direct!==null)return direct;const name=String(expression||'').trim();if(!/^[A-Za-z_$][\w$]*$/.test(name))return null;const declared=declarations.get(name);return declared===undefined?null:factor(declared);}
function balancedBody(text,start){const open=String(text).indexOf('{',start);if(open<0)return'';let depth=0,quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i];if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return text.slice(open+1,i);}}return'';}
function numericPresentationFunctions(source){
  const text=String(source||''),out=new Set(),patterns=[
    /\b(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:function\s*)?\(\s*([A-Za-z_$][\w$]*)\s*\)\s*(?:=>\s*)?\{/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/g
  ];
  for(const pattern of patterns)for(const match of text.matchAll(pattern)){
    const name=String(match[1]||''),param=String(match[2]||''),body=balancedBody(text,match.index??0);if(!name||!param||!body)continue;
    const declaration=new RegExp('(?:\\b(?:let|const|var)\\s+)?([A-Za-z_$][\\w$]*)\\s*=\\s*'+escapeRe(param)+'\\.toString\\(\\s*\\)\\s*;?').exec(body);
    const value=String(declaration?.[1]||'');if(!value)continue;const v=escapeRe(value);
    if(!new RegExp('\\b'+v+'\\.length\\s*={2,3}\\s*1\\b').test(body))continue;
    if(!(body.includes("'0' + "+value)||body.includes('"0" + '+value)||body.includes('`0${'+value+'}`')))continue;
    if(!new RegExp('return\\s+'+v+'\\s*;').test(body))continue;
    out.add(name);
  }
  return out;
}
function preferencePresentationFactor(expression,key,presentationFunctions){
  const direct=preferenceNumericFactor(expression,key);if(direct!==null)return direct;
  const text=stripOuterParens(String(expression||'').trim()),match=text.match(/^([A-Za-z_$][\w$]*)\s*\(\s*([\s\S]+)\s*\)$/);if(!match||!presentationFunctions.has(match[1]))return null;
  return preferenceNumericFactor(match[2],key)===1?1:null;
}
function controlStringCoercion(expression,id,declarations,seen=new Set()){
  const text=stripOuterParens(String(expression||'').trim()),patterns=[modernControlPattern(id,'value'),dollarControlPattern(id,'value'),legacyControlPattern(id,'value')];
  if(patterns.some(pattern=>new RegExp('^'+pattern+'\\s*\\.\\s*toString\\(\\s*\\)$').test(text)))return true;
  if(!/^[A-Za-z_$][\w$]*$/.test(text)||seen.has(text))return false;
  const declared=declarations.get(text);if(declared===undefined)return false;const next=new Set(seen);next.add(text);return controlStringCoercion(declared,id,declarations,next);
}
function assignedLiteral(segment,id){const escaped=escapeRe(id),patterns=[
  new RegExp(`${modernControlPattern(id,'value')}\\s*=\\s*["']([^"']*)["']`),
  new RegExp(`\\$\\(\\s*["']${escaped}["']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["']value["']\\s*,\\s*["']([^"']*)["']`)
];for(const re of patterns){const match=String(segment||'').match(re);if(match)return match[1];}return null;}
function switchProjection(body,id){if(!body)return null;const markers=[];for(const item of body.matchAll(/\bcase\s+([^:]+)\s*:|\bdefault\s*:/g))markers.push({pos:item.index??0,value:item[1]===undefined?null:String(item[1]).trim()});const values=[];let defaultValue=null;for(let i=0;i<markers.length;i++){const marker=markers[i],breakPos=body.indexOf('break',marker.pos),end=breakPos>=0?breakPos:body.length,segment=body.slice(marker.pos,end),literal=assignedLiteral(segment,id);if(literal===null)continue;if(marker.value===null)defaultValue=literal;else{const raw=marker.value.replace(/^['"]|['"]$/g,'');if(!values.some(row=>row[0]===raw))values.push([raw,literal]);}}return values.length||defaultValue!==null?{kind:'switch-map',values,defaultValue,safeWrite:false}:null;}
function selectOptionValues(source,id){const escaped=escapeRe(id),match=String(source||'').match(new RegExp('<select\\b[^>]*\\bid\\s*=\\s*(["\\\'])'+escaped+'\\1[^>]*>([\\s\\S]*?)<\\/select>','i'));if(!match)return[];const out=[];for(const option of match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)){const attrs=option[1]||'',valueMatch=attrs.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);out.push(String(valueMatch?valueMatch[1]??valueMatch[2]??valueMatch[3]:'').trim());}return out;}
function selectedIndexExpression(source,id){const escaped=escapeRe(id),patterns=[
  new RegExp("document\\.getElementById\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*getChildren\\(\\s*[\"']option[\"']\\s*\\)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*selected\\s*=\\s*true"),
  new RegExp("\\$\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*getChildren\\(\\s*[\"']option[\"']\\s*\\)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*selected\\s*=\\s*true"),
  new RegExp("document\\.getElementById\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*options\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*selected\\s*=\\s*true"),
  new RegExp("document\\.getElementById\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*getChildren\\(\\s*[\"']option[\"']\\s*\\)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*setAttribute\\(\\s*[\"']selected[\"']\\s*,\\s*[\"'][^\"']*[\"']\\s*\\)"),
  new RegExp("\\$\\(\\s*[\"']"+escaped+"[\"']\\s*\\)\\s*\\.\\s*getChildren\\(\\s*[\"']option[\"']\\s*\\)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\.\\s*setAttribute\\(\\s*[\"']selected[\"']\\s*,\\s*[\"'][^\"']*[\"']\\s*\\)")
];for(const re of patterns){const match=String(source||"").match(re);if(match)return String(match[1]||"").trim();}return null;}
function switchBodyForIndex(source,key,indexVariable,declarations){if(!indexVariable)return null;for(const match of String(source||'').matchAll(/\bswitch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g)){const factor=resolveExpression(match[1],value=>preferenceNumericFactor(value,key),declarations);if(factor!==1)continue;const body=balancedBody(source,match.index??0);if(body&&new RegExp('\\b'+escapeRe(indexVariable)+'\\s*=').test(body))return body;}return null;}
function switchIndexMap(body,variable,options,declarations){if(!body||!variable||!options.length)return null;const markers=[];for(const item of body.matchAll(/\bcase\s+([^:]+)\s*:|\bdefault\s*:/g))markers.push({pos:item.index??0,value:item[1]===undefined?null:String(item[1]).trim()});const values=[];for(let i=0;i<markers.length;i++){const marker=markers[i];if(marker.value===null)continue;const breakPos=body.indexOf('break',marker.pos),end=breakPos>=0?breakPos:body.length,segment=body.slice(marker.pos,end),assign=segment.match(new RegExp('\\b'+escapeRe(variable)+'\\s*=\\s*(\\d+)\\b'));if(!assign)continue;const index=Number(assign[1]),raw=marker.value.replace(/^['"]|['"]$/g,''),display=options[index];if(display===undefined)return null;values.push([raw,display]);}const initial=numericLiteral(declarations.get(variable));if(initial!==null&&Number.isInteger(initial)&&initial>=0&&initial<options.length&&!values.some(row=>String(row[0])===String(options[initial])))values.push([String(options[initial]),String(options[initial])]);return values.length?values:null;}
function selectedOptionIdentity(source,key,id,declarations,directSwitchBody){const options=selectOptionValues(source,id),indexExpression=selectedIndexExpression(source,id);if(!options.length||!indexExpression)return false;const direct=resolveExpression(indexExpression,value=>preferenceNumericFactor(value,key),declarations);if(direct===1&&options.every((value,index)=>String(value)===String(index)))return true;if(!/^[A-Za-z_$][\w$]*$/.test(indexExpression))return false;const switchBody=directSwitchBody||switchBodyForIndex(source,key,indexExpression,declarations),rows=switchIndexMap(switchBody,indexExpression,options,declarations);if(!rows||!rows.length)return false;return rows.every(row=>String(row[0])===String(row[1]))&&new Set(rows.map(row=>String(row[0]))).size===new Set(options.map(String)).size;}
function balancedBlock(text,start){
  const source=String(text||''),open=source.indexOf('{',start);if(open<0)return null;let depth=0,quote='',escape=false,lineComment=false,blockComment=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i],next=source[i+1]||'';
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return{body:source.slice(open+1,i),open,close:i};}
  }
  return null;
}
function numericAssignment(segment,name){
  const match=String(segment||'').match(new RegExp('\\b'+escapeRe(name)+'\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\b'));
  return match?Number(match[1]):null;
}
function controlValueVariables(declarations,controlId){
  const out=[];for(const [name,expression] of declarations)if(directControlValue(expression,controlId))out.push(String(name));return out;
}
function equalityBranch(source,variable,value){
  const re=new RegExp('\\bif\\s*\\(\\s*'+escapeRe(variable)+'\\s*={2,3}\\s*["\\\']'+escapeRe(value)+'["\\\']\\s*\\)','g');
  const match=re.exec(String(source||''));return match?balancedBlock(source,match.index??0):null;
}
function checkboxBranch(block,targetName){
  const body=String(block?.body||''),patterns=[
    /if\s*\(\s*(!)?document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*checked\s*\)/g,
    /if\s*\(\s*(!)?\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*checked\s*\)/g,
    /if\s*\(\s*(!)?\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*getProperty\(\s*["']checked["']\s*\)\s*\)/g
  ];
  for(const pattern of patterns)for(const match of body.matchAll(pattern)){
    const yes=balancedBlock(body,match.index??0);if(!yes)continue;
    let cursor=yes.close+1;while(/\s/.test(body[cursor]||''))cursor++;
    if(body.slice(cursor,cursor+4)!=='else')continue;cursor+=4;while(/\s/.test(body[cursor]||''))cursor++;
    const no=balancedBlock(body,cursor);if(!no)continue;
    const yesRaw=numericAssignment(yes.body,targetName),noRaw=numericAssignment(no.body,targetName);if(yesRaw===null||noRaw===null)continue;
    return{controlId:String(match[2]||''),yesRaw,noRaw,checkedWhenYes:!match[1]};
  }
  return null;
}
function checkboxReadPreference(source,controlId){
  const escaped=escapeRe(controlId),patterns=[
    new RegExp('document\\.getElementById\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*checked\\s*=\\s*pref\\s*\\.\\s*([A-Za-z_$][\\w$]*)'),
    new RegExp('\\$\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*checked\\s*=\\s*pref\\s*\\.\\s*([A-Za-z_$][\\w$]*)'),
    new RegExp('\\$\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*(?:setProperty|set)\\(\\s*["\\\']checked["\\\']\\s*,\\s*pref\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\)')
  ];
  for(const re of patterns){const match=String(source||'').match(re);if(match)return String(match[1]||'');}
  return null;
}
function compoundSwitchProjection(source,key,controlId,switchMap,writes,declarations){
  if(!switchMap||switchMap.kind!=='switch-map')return null;
  const target=String(writes.get(String(key))??'').trim();if(!/^[A-Za-z_$][\w$]*$/.test(target))return null;
  const initialRaw=numericLiteral(declarations.get(target));if(initialRaw===null)return null;
  const displayVariables=controlValueVariables(declarations,controlId);if(!displayVariables.length)return null;
  const options=selectOptionValues(source,controlId);if(!options.length||!options.includes(String(switchMap.defaultValue??'')))return null;
  const groups=new Map();for(const row of switchMap.values||[]){const raw=Number(row?.[0]),display=String(row?.[1]??'');if(!Number.isFinite(raw)||!display)return null;const list=groups.get(display)||[];list.push(raw);groups.set(display,list);}
  if(![...groups.values()].some(list=>list.length>1))return null;
  if((switchMap.values||[]).some(row=>Number(row?.[0])===initialRaw))return null;
  const expectedRaw=new Set((switchMap.values||[]).map(row=>Number(row?.[0])));
  for(const displayVariable of [...displayVariables].reverse()){
    const cases=[{value:String(switchMap.defaultValue),raw:initialRaw}],explicitRaw=new Set(),auxIds=new Set();let valid=true;
    for(const value of options){
      if(value===String(switchMap.defaultValue))continue;
      const raws=groups.get(value)||[];if(!raws.length){valid=false;break;}
      const branch=equalityBranch(source,displayVariable,value);if(!branch){valid=false;break;}
      if(raws.length===1){
        const raw=numericAssignment(branch.body,target);if(raw===null||raw!==raws[0]){valid=false;break;}
        cases.push({value,raw});explicitRaw.add(raw);continue;
      }
      if(raws.length!==2){valid=false;break;}
      const pair=checkboxBranch(branch,target);if(!pair){valid=false;break;}
      const pairSet=new Set([pair.yesRaw,pair.noRaw]);if(raws.some(raw=>!pairSet.has(raw))||pairSet.size!==2){valid=false;break;}
      auxIds.add(pair.controlId);
      cases.push({value,aux:pair.checkedWhenYes,raw:pair.yesRaw},{value,aux:!pair.checkedWhenYes,raw:pair.noRaw});
      explicitRaw.add(pair.yesRaw);explicitRaw.add(pair.noRaw);
    }
    if(!valid||auxIds.size!==1)continue;
    if(expectedRaw.size!==explicitRaw.size||[...expectedRaw].some(raw=>!explicitRaw.has(raw)))continue;
    const coveredValues=new Set(cases.map(item=>String(item.value)));if(coveredValues.size!==new Set(options.map(String)).size||options.some(value=>!coveredValues.has(String(value))))continue;
    const auxiliaryControlId=[...auxIds][0],auxiliaryPreferenceKey=checkboxReadPreference(source,auxiliaryControlId);if(!auxiliaryPreferenceKey)continue;
    return{kind:'compound-switch-map',values:switchMap.values,defaultValue:switchMap.defaultValue,auxiliary:{controlId:auxiliaryControlId,preferenceKey:auxiliaryPreferenceKey,semantic:'checkbox'},writeCases:cases,safeWrite:true};
  }
  return null;
}

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
function directControlChecked(value,id){
  const text=stripOuterParens(String(value||'').trim());
  return new RegExp("^"+modernControlPattern(id,'checked')+"$").test(text)
    ||new RegExp("^"+dollarControlPattern(id,'checked')+"$").test(text)
    ||new RegExp("^"+legacyControlPattern(id,'checked')+"$").test(text);
}
function checkboxControlForPreference(source,key){
  const text=String(source||''),patterns=[
    /document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*checked\s*=\s*pref\s*\.\s*([A-Za-z_$][\w$]*)/g,
    /\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*checked\s*=\s*pref\s*\.\s*([A-Za-z_$][\w$]*)/g,
    /\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:setProperty|set)\(\s*["']checked["']\s*,\s*pref\s*\.\s*([A-Za-z_$][\w$]*)\s*\)/g
  ];
  for(const re of patterns)for(const match of text.matchAll(re))if(String(match[2]||'')===String(key||''))return String(match[1]||'');
  return null;
}
function booleanSelectProjection(source,key,controlId,read,write){
  const options=selectOptionValues(source,controlId);if(options.length!==2||new Set(options).size!==2||!options.includes('true')||!options.includes('false'))return null;
  const readText=stripOuterParens(String(read||'').trim()),readMatch=readText.match(/^pref\s*\.\s*([A-Za-z_$][\w$]*)$/);if(!readMatch||readMatch[1]!==String(key))return null;
  const writeText=stripOuterParens(String(write||'').trim()),access="(?:"+[modernControlPattern(controlId,'value'),dollarControlPattern(controlId,'value'),legacyControlPattern(controlId,'value'),selectedControlPattern(controlId)].join("|")+")";
  if(!new RegExp("^(?:"+access+"\\s*={2,3}\\s*[\"']true[\"']|[\"']true[\"']\\s*={2,3}\\s*"+access+")$").test(writeText))return null;
  return{kind:'boolean-select',trueValue:'true',falseValue:'false',safeWrite:true};
}
function directCheckedControlId(expression){
  const text=stripOuterParens(String(expression||'').trim()),patterns=[
    /^document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*checked$/,
    /^\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*checked$/,
    /^\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*getProperty\(\s*["']checked["']\s*\)$/
  ];
  for(const pattern of patterns){const match=text.match(pattern);if(match)return String(match[1]||'');}
  return null;
}
function sourceIdentifierKey(value){return String(value||'').replace(/[^A-Za-z0-9]+/g,'').toLowerCase();}
function uniqueDeclarationAlias(declarations,name){
  name=String(name||'');if(declarations.has(name))return name;
  const target=sourceIdentifierKey(name),matches=[...declarations.keys()].filter(item=>target&&sourceIdentifierKey(item)===target);
  return matches.length===1?matches[0]:null;
}
function sourceControlAliases(source,id){
  const target=sourceIdentifierKey(id),out=new Set([String(id||'')]),text=String(source||''),patterns=[
    /document\.getElementById\(\s*["']([^"']+)["']\s*\)/g,
    /\$\(\s*["']([^"']+)["']\s*\)/g
  ];
  for(const pattern of patterns)for(const match of text.matchAll(pattern)){const value=String(match[1]||'');if(target&&sourceIdentifierKey(value)===target)out.add(value);}
  return [...out].filter(Boolean);
}
function controlNumericFactorAliases(expression,source,id){
  const values=[];for(const alias of sourceControlAliases(source,id)){const factor=controlNumericFactor(expression,alias);if(factor!==null&&!values.includes(factor))values.push(factor);}
  return values.length===1?values[0]:null;
}
function branchAfter(text,start){
  let cursor=start;while(/\s/.test(text[cursor]||''))cursor++;
  if(text[cursor]==='{'){const block=balancedBlock(text,cursor);return block?{body:block.body,end:block.close+1}:null;}
  const end=text.indexOf(';',cursor);return end<0?null:{body:text.slice(cursor,end+1),end:end+1};
}
function controlValueAssignments(segment){
  const text=String(segment||''),out=[],patterns=[
    /document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*value\s*=\s*([^;\n]+)/g,
    /\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*value\s*=\s*([^;\n]+)/g,
    /\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:setProperty|set)\(\s*["']value["']\s*,\s*([^;\n]+)\)\s*;?/g
  ];
  for(const pattern of patterns)for(const match of text.matchAll(pattern))out.push({controlId:String(match[1]||''),expression:String(match[2]||'').trim()});
  return out;
}
function preferenceIdentityKey(expression){
  const text=stripOuterParens(String(expression||'').trim()),match=text.match(/^(?:Number\(\s*)?pref\s*\.\s*([A-Za-z_$][\w$]*)(?:\s*\.\s*toInt\s*\(\s*\))?(?:\s*\))?$/);
  return match?String(match[1]||''):null;
}
function preferenceSentinelPresentations(source,reads){
  const text=String(source||''),candidates=new Map();
  const add=(key,gatePreferenceKey,defaultValue)=>{
    key=String(key||'');gatePreferenceKey=String(gatePreferenceKey||'');defaultValue=Number(defaultValue);
    if(!key||!gatePreferenceKey||!Number.isFinite(defaultValue))return;
    const list=candidates.get(key)||[];
    if(!list.some(item=>item.gatePreferenceKey===gatePreferenceKey&&item.defaultValue===defaultValue))list.push({gatePreferenceKey,defaultValue});
    candidates.set(key,list);
  };
  for(const expression of reads.values()){
    const readText=stripOuterParens(String(expression||'').trim()),ternary=readText.match(/^pref\s*\.\s*([A-Za-z_$][\w$]*)\s*\?\s*(?:Number\(\s*)?pref\s*\.\s*([A-Za-z_$][\w$]*)(?:\s*\.\s*toInt\s*\(\s*\))?(?:\s*\))?\s*:\s*(-?\d+(?:\.\d+)?)$/);
    if(ternary)add(ternary[2],ternary[1],ternary[3]);
  }
  const ifRe=/\bif\s*\(\s*pref\s*\.\s*([A-Za-z_$][\w$]*)\s*\)/g;
  for(const match of text.matchAll(ifRe)){
    const yes=branchAfter(text,(match.index??0)+match[0].length);if(!yes)continue;
    let cursor=yes.end;while(/\s/.test(text[cursor]||''))cursor++;if(text.slice(cursor,cursor+4)!=='else')continue;
    const no=branchAfter(text,cursor+4);if(!no)continue;
    const yesAssignments=controlValueAssignments(yes.body),noAssignments=controlValueAssignments(no.body);
    for(const on of yesAssignments){
      const key=preferenceIdentityKey(on.expression);if(!key)continue;
      const off=noAssignments.find(item=>item.controlId===on.controlId),fallback=off?numericLiteral(off.expression):null;
      if(fallback!==null)add(key,match[1],fallback);
    }
  }
  const out=new Map();for(const [key,list] of candidates)if(list.length===1)out.set(key,list[0]);return out;
}
function preferenceSentinelGateProjection(source,key,controlId,read,writes,declarations,presentations){
  const text=String(source||''),writeExpression=String(writes.get(String(key))??'').trim();if(!/^[A-Za-z_$][\w$]*$/.test(writeExpression))return null;
  const writeVariable=uniqueDeclarationAlias(declarations,writeExpression);if(!writeVariable)return null;
  const disabledValue=numericLiteral(declarations.get(writeVariable));if(disabledValue===null)return null;
  const presentation=presentations&&presentations.get(String(key));if(!presentation)return null;
  const gatePreferenceKey=presentation.gatePreferenceKey,defaultValue=presentation.defaultValue,gateWrite=writes.get(gatePreferenceKey);
  const gateControlId=directCheckedControlId(gateWrite)||checkboxControlForPreference(text,gatePreferenceKey);if(!gateControlId)return null;
  if(gateWrite===undefined||!directControlChecked(gateWrite,gateControlId))return null;
  let writeFactor=null,matchedGateAlias=null;
  for(const gateAlias of sourceControlAliases(text,gateControlId)){
    const modern=modernControlPattern(gateAlias,'checked'),dollar=dollarControlPattern(gateAlias,'checked'),legacy=legacyControlPattern(gateAlias,'checked');
    const writeIf=new RegExp("if\\s*\\(\\s*(?:"+modern+"|"+dollar+"|"+legacy+")\\s*\\)\\s*\\{([\\s\\S]*?)\\}","g");
    for(const match of text.matchAll(writeIf)){
      const body=match[1]||'',assignment=body.match(new RegExp("\\b"+escapeRe(writeVariable)+"\\s*=\\s*([^;\\n]+)"));if(!assignment)continue;
      const factor=controlNumericFactorAliases(assignment[1],text,controlId);if(factor===null)continue;
      if(writeFactor!==null&&writeFactor!==factor)return null;writeFactor=factor;matchedGateAlias=gateAlias;
    }
  }
  if(writeFactor!==1||!matchedGateAlias)return null;
  return{kind:'sentinel-gate',gateControlId,gatePreferenceKey,disabledValue,defaultValue,enabledWhen:{kind:'preference-truthy',key:gatePreferenceKey},safeWrite:true};
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
  const text=String(source||''),reads=new Map(),writes=new Map(),declarations=new Map(),switches=new Map(),readPos=new Map(),writePos=new Map(),presentationFunctions=numericPresentationFunctions(text);let match;
  const declarationRe=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  while((match=declarationRe.exec(text)))declarations.set(match[1],match[2]);
  const modernRead=/document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:value|checked)\s*=(?!=)\s*([^;\n]+)/g;
  while((match=modernRead.exec(text)))rememberLatest(reads,match[1],match[2],match.index??0,readPos);
  const dollarRead=/\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:value|checked)\s*=(?!=)\s*([^;\n]+)/g;
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
  const preferenceSentinels=preferenceSentinelPresentations(text,reads);
  return function project(key,controlId){
    const presence=presenceGateProjection(text,key,controlId);if(presence)return presence;
    const sentinel=sentinelGateProjection(text,key,controlId,writes,declarations);if(sentinel)return sentinel;
    const read=reads.get(String(controlId)),write=writes.get(String(key));
    const preferenceSentinel=preferenceSentinelGateProjection(text,key,controlId,read,writes,declarations,preferenceSentinels);if(preferenceSentinel)return preferenceSentinel;
    const booleanSelect=booleanSelectProjection(text,key,controlId,read,write);if(booleanSelect)return booleanSelect;
    const readFactor=read===undefined?null:resolveExpression(read,value=>preferencePresentationFactor(value,key,presentationFunctions),declarations),writeFactor=write===undefined?null:resolveExpression(write,value=>controlNumericFactor(value,controlId),declarations),stringWriteIdentity=write!==undefined&&controlStringCoercion(write,controlId,declarations);
    if(writeFactor===1&&selectedOptionIdentity(text,key,controlId,declarations,switches.get(String(key))))return{kind:'identity',safeWrite:true};
    if(readFactor===1&&stringWriteIdentity)return{kind:'unproven',safeWrite:false,readFactor:1,writeFactor:1,writeIdentity:'string'};
    const switchMap=switchProjection(switches.get(String(key)),controlId);if(switchMap){const compound=compoundSwitchProjection(text,key,controlId,switchMap,writes,declarations);if(compound)return compound;return switchMap;}
    if(readFactor===1&&writeFactor===1)return{kind:'identity',safeWrite:true};
    if(readFactor!==null&&writeFactor!==null&&readFactor>0&&writeFactor>0){const product=readFactor*writeFactor;if(Math.abs(product-1)<1e-12){const scale=writeFactor;if(Number.isFinite(scale)&&scale>0)return scale===1?{kind:'identity',safeWrite:true}:{kind:'scale',scale,safeWrite:true};}}
    if(readFactor!==null)return{kind:'unproven',safeWrite:false,readFactor,...(writeFactor!==null?{writeFactor}:{})};
    if(writeFactor!==null)return{kind:'unproven',safeWrite:false,writeFactor};
    return{kind:'unproven',safeWrite:false};
  };
}

let cachedSource=null,cachedProjector=null;
export function extractQbPreferenceValueProjection(source,key,controlId){const text=String(source||'');if(text!==cachedSource){cachedSource=text;cachedProjector=createQbPreferenceValueProjector(text);}return cachedProjector(key,controlId);}
