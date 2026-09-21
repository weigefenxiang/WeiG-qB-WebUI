import {parseQbtSourceRef} from './qb-source-text.mjs';

function qbtTr(value){return parseQbtSourceRef(value);}
function prefRefs(statement,wanted){const out=[];for(const match of String(statement||'').matchAll(/\bpref\s*\.\s*([A-Za-z_$][\w$]*)/g)){const key=String(match[1]||'');if((!wanted.size||wanted.has(key))&&!out.includes(key))out.push(key);}return out;}
function controlTitles(markup){
  const text=String(markup||''),out=new Map(),labelsById=new Map(),legendsById=new Map();
  for(const match of text.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)){
    const attrs=match[1]||'',ref=qbtTr(match[2]);if(!ref)continue;
    const controlId=(attrs.match(/\bfor\s*=\s*["']([^"']+)["']/i)||[])[1],labelId=(attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)||[])[1];
    if(controlId&&!out.has(controlId))out.set(controlId,ref);
    if(labelId&&!labelsById.has(labelId))labelsById.set(labelId,ref);
  }
  for(const match of text.matchAll(/<legend\b([^>]*)>([\s\S]*?)<\/legend>/gi)){
    const id=((match[1]||'').match(/\bid\s*=\s*["']([^"']+)["']/i)||[])[1],ref=qbtTr(match[2]);
    if(id&&ref&&!legendsById.has(id))legendsById.set(id,ref);
  }
  for(const match of text.matchAll(/<(?:input|select|textarea|table)\b([^>]*)>/gi)){
    const attrs=match[1]||'',pair=attrs.match(/\bid\s*=\s*["']([^"']+)["'][^>]*\baria-labelledby\s*=\s*["']([^"']+)["']/i),id=pair?.[1];
    if(!id||out.has(id))continue;
    for(const labelId of String(pair[2]||'').split(/\s+/)){const ref=labelsById.get(labelId)||legendsById.get(labelId);if(ref){out.set(id,ref);break;}}
  }
  for(const match of text.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>\s*<(?:input|select|textarea|table)\b([^>]*)>/gi)){
    const id=((match[2]||'').match(/\bid\s*=\s*["']([^"']+)["']/i)||[])[1];if(!id||out.has(id))continue;const ref=qbtTr(match[1]);if(ref)out.set(id,ref);
  }
  return out;
}
function balancedBody(text,start){
  const open=String(text).indexOf('{',start);if(open<0)return'';let depth=0,quote='',lineComment=false,blockComment=false,escape=false;
  for(let i=open;i<text.length;i++){
    const ch=text[i],next=text[i+1]||'';
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return text.slice(open+1,i);}
  }
  return'';
}
function controlIds(statement){const out=[];for(const match of String(statement||'').matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)|\$\(\s*["']([^"']+)["']\s*\)/g)){const id=match[1]||match[2];if(id&&!out.includes(id))out.push(id);}return out;}

function escapeRegex(value){return String(value||'').replace(/[|\\{}()[\]^$+*?.-]/g,'\\$&');}
function namedFunctions(source){
  const text=String(source||''),out=[],seen=new Set(),patterns=[
    /(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:\(([^)]*)\)\s*=>|function\s*\(([^)]*)\))\s*\{/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g
  ];
  for(const pattern of patterns){for(const match of text.matchAll(pattern)){const start=match.index??0;if(seen.has(start))continue;const body=balancedBody(text,start);if(!body)continue;seen.add(start);out.push({name:String(match[1]||''),params:String(match[2]??match[3]??''),body,start});}}
  return out.sort((a,b)=>a.start-b.start);
}
function structuredTables(source){
  const text=String(source||''),titles=new Map(),stack=[],token=/<fieldset\b[^>]*>|<\/fieldset>|<legend\b[^>]*>([\s\S]*?)<\/legend>|<table\b([^>]*)>/gi;let match;
  while((match=token.exec(text))){
    const raw=String(match[0]||'').toLowerCase();
    if(raw.startsWith('<fieldset')){stack.push({title:null});continue;}
    if(raw.startsWith('</fieldset')){stack.pop();continue;}
    if(raw.startsWith('<legend')){if(stack.length&&!stack[stack.length-1].title)stack[stack.length-1].title=qbtTr(match[1]);continue;}
    const attrs=match[2]||'',id=(attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)||[])[1];if(id&&stack.length&&stack[stack.length-1].title)titles.set(id,stack[stack.length-1].title);
  }
  const out=new Map();
  for(const table of text.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)){
    const attrs=table[1]||'',id=(attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)||[])[1];if(!id)continue;
    const columns=[];for(const th of String(table[2]||'').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)){const ref=qbtTr(th[1]);if(ref)columns.push(ref);}
    const title=titles.get(id)||null;if(title&&columns.length)out.set(id,{id,title,columns});
  }
  return out;
}
function dynamicTableOptions(body){
  const out=[],seen=new Set();
  for(const match of String(body||'').matchAll(/<option\b[^>]*\bvalue\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/option>/gi)){
    const id=String(match[1]||'');if(!id||seen.has(id))continue;const label=qbtTr(match[2]);if(!label)continue;seen.add(id);out.push({id,label});
  }
  return out;
}
function structuredModeSpec(saveBody,producer,table){
  const options=dynamicTableOptions(producer?.body);if(options.length<2)return null;
  const mapped=new Map(),custom=new Set(),body=String(saveBody||'');
  for(const option of options){
    const id=escapeRegex(option.id),caseMatch=body.match(new RegExp('case\\s+["\\\']'+id+'["\\\']\\s*:[\\s\\S]{0,220}?\\b[A-Za-z_$][\\w$]*\\s*=\\s*([^;]+);','i'));
    if(caseMatch){const value=literalValue(caseMatch[1]);if(value===undefined)custom.add(option.id);else mapped.set(option.id,value);continue;}
    const ifMatch=body.match(new RegExp('if\\s*\\(\\s*[A-Za-z_$][\\w$]*\\s*={2,3}\\s*["\\\']'+id+'["\\\']\\s*\\)\\s*(?:\\{\\s*)?\\b[A-Za-z_$][\\w$]*\\s*=\\s*([^;]+);','i'));
    if(ifMatch){const value=literalValue(ifMatch[1]);if(value===undefined)custom.add(option.id);else mapped.set(option.id,value);}
  }
  for(const ternary of body.matchAll(/\b[A-Za-z_$][\w$]*\s*=\s*\(\s*[A-Za-z_$][\w$]*\s*={2,3}\s*["']([^"']+)["']\s*\)\s*\?\s*([^:;]+)\s*:\s*([^;]+);/g)){
    const id=String(ternary[1]||''),yes=literalValue(ternary[2]),no=literalValue(ternary[3]);if(yes!==undefined)mapped.set(id,yes);
    if(no!==undefined){const candidates=options.map(item=>item.id).filter(value=>value!==id&&!custom.has(value)&&!mapped.has(value));if(candidates.length===1)mapped.set(candidates[0],no);}
  }
  const unresolved=options.map(item=>item.id).filter(id=>!mapped.has(id)&&!custom.has(id));if(unresolved.length===1)custom.add(unresolved[0]);
  if(options.some(item=>!mapped.has(item.id)&&!custom.has(item.id)))return null;
  const defaultValues=[];for(const match of String(producer?.params||'').matchAll(/(?:^|,)\s*[A-Za-z_$][\w$]*\s*=\s*["']([^"']*)["']/g))defaultValues.push(String(match[1]||''));
  const defaultMode=defaultValues.find(value=>options.some(item=>item.id===value))||options.find(item=>!custom.has(item.id))?.id||options[0].id;
  return{kind:'keyed-map',columns:table.columns,modes:options.map(item=>({id:item.id,label:item.label,...(custom.has(item.id)?{custom:true}:{value:mapped.get(item.id)})})),defaultMode};
}
function structuredReturnFacts(source,wanted){
  const text=String(source||''),tables=structuredTables(text),functions=namedFunctions(text),byName=new Map(functions.map(item=>[item.name,item])),out=[];
  const assignments=[
    ...text.matchAll(/settings\s*\[\s*["']([^"']+)["']\s*\]\s*=\s*([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;?/g),
    ...text.matchAll(/\bsettings\s*\.\s*([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;?/g),
    ...text.matchAll(/\bsettings\s*\.\s*set\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\)\s*;?/g)
  ];
  for(const match of assignments){
    const key=String(match[1]||''),fn=byName.get(String(match[2]||''));if(!key||!fn||(wanted.size&&!wanted.has(key)))continue;
    const ids=controlIds(fn.body).filter(id=>tables.has(id));if(ids.length!==1)continue;const table=tables.get(ids[0]);
    const aliases=[];for(const aliasMatch of text.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+HtmlTable\s*\(\s*\$\(\s*["']([^"']+)["']\s*\)\s*\)/g))if(String(aliasMatch[2]||'')===table.id)aliases.push(String(aliasMatch[1]||''));
    const producer=functions.find(item=>{
      if(item.name===fn.name||!/<option\b/i.test(item.body))return false;
      if(controlIds(item.body).includes(table.id))return true;
      return aliases.some(alias=>new RegExp('\\b'+escapeRegex(alias)+'\\s*\\.\\s*(?:push|adopt|append)\\s*\\(').test(item.body));
    });if(!producer)continue;
    const loadProof=new RegExp('pref\\s*\\.\\s*'+escapeRegex(key)+'[\\s\\S]{0,2400}?\\b'+escapeRegex(producer.name)+'\\s*\\(').test(text);if(!loadProof)continue;
    const structured=structuredModeSpec(fn.body,producer,table);if(!structured)continue;out.push({key,controlId:table.id,title:table.title,evidence:'semantic-structured-return',structured});
  }
  return out;
}


function stripOuterParens(value){
  let text=String(value||'').trim(),changed=true;
  while(changed&&text.startsWith('(')&&text.endsWith(')')){
    changed=false;let depth=0,quote='',escape=false,balanced=true;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}
      if(ch==='"'||ch==="'"){quote=ch;continue;}
      if(ch==='(')depth++;else if(ch===')'){depth--;if(depth===0&&i<text.length-1){balanced=false;break;}}
    }
    if(balanced&&depth===0){text=text.slice(1,-1).trim();changed=true;}
  }
  return text;
}
function splitTopLevel(value,operator){
  const text=String(value||''),out=[];let depth=0,quote='',escape=false,start=0;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='(')depth++;else if(ch===')')depth=Math.max(0,depth-1);
    if(depth===0&&text.startsWith(operator,i)){out.push(text.slice(start,i));start=i+operator.length;i+=operator.length-1;}
  }
  if(out.length)out.push(text.slice(start));
  return out;
}
function rawAll(kind,items){
  const flat=[];for(const item of items||[]){if(!item)return null;if(item.kind===kind)flat.push(...item.items);else flat.push(item);}
  if(!flat.length)return null;if(flat.length===1)return flat[0];return{kind,items:flat};
}
function negateRaw(item){
  if(!item)return null;
  if(item.kind==='true')return{kind:'false'};if(item.kind==='false')return{kind:'true'};
  if(item.kind==='controlTruthy')return{kind:'controlFalsy',controlId:item.controlId};
  if(item.kind==='controlFalsy')return{kind:'controlTruthy',controlId:item.controlId};
  if(item.kind==='controlEquals')return{kind:'controlNotEquals',controlId:item.controlId,value:item.value};
  if(item.kind==='controlNotEquals')return{kind:'controlEquals',controlId:item.controlId,value:item.value};
  if(item.kind==='controlEnabled')return{kind:'controlDisabled',controlId:item.controlId};
  if(item.kind==='controlDisabled')return{kind:'controlEnabled',controlId:item.controlId};
  if(item.kind==='allOf')return rawAll('anyOf',item.items.map(negateRaw));
  if(item.kind==='anyOf')return rawAll('allOf',item.items.map(negateRaw));
  return null;
}
function sourceControlAccess(value){
  const text=stripOuterParens(value);
  let match=text.match(/^document\.getElementById\(\s*["']([^"']+)["']\s*\)\.(checked|value|disabled)$/);
  if(match)return{controlId:match[1],property:match[2]};
  match=text.match(/^\$\(\s*["']([^"']+)["']\s*\)\.(checked|value|disabled)$/);
  if(match)return{controlId:match[1],property:match[2]};
  match=text.match(/^\$\(\s*["']([^"']+)["']\s*\)\.(?:getProperty|get)\(\s*["'](checked|value|disabled)["']\s*\)$/);
  return match?{controlId:match[1],property:match[2]}:null;
}
function literalValue(value){
  const text=String(value||'').trim();
  if(/^["'][\s\S]*["']$/.test(text))return text.slice(1,-1);
  if(text==='true')return true;if(text==='false')return false;if(text==='null')return null;
  if(/^-?\d+(?:\.\d+)?$/.test(text))return Number(text);
  return undefined;
}
function sourcePropertyBag(value){
  const text=stripOuterParens(value),patterns=[
    /^document\.getElementById\(\s*["']([^"']+)["']\s*\)\.getProperties\(\s*([\s\S]*)\s*\)$/,
    /^\$\(\s*["']([^"']+)["']\s*\)\.getProperties\(\s*([\s\S]*)\s*\)$/
  ];
  for(const pattern of patterns){
    const match=text.match(pattern);if(!match)continue;
    const controlId=String(match[1]||''),properties=[];
    for(const property of String(match[2]||'').matchAll(/["'](checked|value|disabled)["']/g))if(!properties.includes(property[1]))properties.push(property[1]);
    if(controlId&&properties.length)return{controlId,properties};
  }
  return null;
}
function rawControlProperty(controlId,property){
  if(property==='checked')return{kind:'controlTruthy',controlId};
  if(property==='value')return{kind:'controlValue',controlId};
  if(property==='disabled')return{kind:'controlDisabled',controlId};
  return null;
}
function parseRawPredicate(value,env){
  let text=stripOuterParens(value);if(!text)return null;
  const ors=splitTopLevel(text,'||');if(ors.length>1)return rawAll('anyOf',ors.map(part=>parseRawPredicate(part,env)));
  const ands=splitTopLevel(text,'&&');if(ands.length>1)return rawAll('allOf',ands.map(part=>parseRawPredicate(part,env)));
  if(text.startsWith('!')&&!text.startsWith('!='))return negateRaw(parseRawPredicate(text.slice(1),env));
  if(env.has(text))return env.get(text);
  const comparison=text.match(/^([\s\S]+?)\s*(===|!==|==|!=)\s*([\s\S]+)$/);
  if(comparison){
    const leftText=stripOuterParens(comparison[1]),rightText=stripOuterParens(comparison[3]),op=comparison[2];
    const left=env.get(leftText)||(()=>{const access=sourceControlAccess(leftText);return access&&access.property==='value'?{kind:'controlValue',controlId:access.controlId}:null;})();
    const right=literalValue(rightText);
    if(left?.kind==='controlValue'&&right!==undefined)return{kind:(op==='==='||op==='==')?'controlEquals':'controlNotEquals',controlId:left.controlId,value:right};
  }
  const access=sourceControlAccess(text);
  if(access){
    if(access.property==='checked')return{kind:'controlTruthy',controlId:access.controlId};
    if(access.property==='value')return{kind:'controlValue',controlId:access.controlId};
    if(access.property==='disabled')return{kind:'controlDisabled',controlId:access.controlId};
  }
  if(text==='true')return{kind:'true'};if(text==='false')return{kind:'false'};
  return null;
}
function rawPredicateControlIds(item,out=new Set()){
  if(!item)return out;
  if(item.controlId)out.add(String(item.controlId));
  for(const child of item.items||[])rawPredicateControlIds(child,out);
  return out;
}
function resolvePreferencePredicate(item,controlToPreference,enabledByControl,seen=new Set()){
  if(!item)return null;
  if(item.kind==='true'||item.kind==='false')return item;
  if(item.kind==='controlValue')return null;
  if(item.kind==='controlEnabled'||item.kind==='controlDisabled'){
    const id=String(item.controlId||'');if(!id||seen.has(id))return null;const raw=enabledByControl.get(id);if(!raw)return null;
    const next=new Set(seen);next.add(id);const resolved=resolvePreferencePredicate(raw,controlToPreference,enabledByControl,next);
    return item.kind==='controlEnabled'?resolved:negatePreferencePredicate(resolved);
  }
  if(['controlTruthy','controlFalsy','controlEquals','controlNotEquals'].includes(item.kind)){
    const binding=controlToPreference[String(item.controlId||'')];
    if(!binding)return{kind:item.kind,controlId:String(item.controlId||''),...(Object.prototype.hasOwnProperty.call(item,'value')?{value:item.value}:{})};
    if(binding&&typeof binding==='object'&&binding.predicate){
      const base=binding.predicate;
      if(item.kind==='controlTruthy')return base;
      if(item.kind==='controlFalsy')return negatePreferencePredicate(base);
      if(item.kind==='controlEquals'&&item.value===true)return base;
      if(item.kind==='controlEquals'&&item.value===false)return negatePreferencePredicate(base);
      if(item.kind==='controlNotEquals'&&item.value===true)return negatePreferencePredicate(base);
      if(item.kind==='controlNotEquals'&&item.value===false)return base;
      return null;
    }
    const key=String(binding||'');if(!key)return null;
    if(item.kind==='controlTruthy')return{kind:'truthy',key};
    if(item.kind==='controlFalsy')return{kind:'falsy',key};
    if(item.kind==='controlEquals')return{kind:'equals',key,value:item.value};
    return{kind:'notEquals',key,value:item.value};
  }
  if(item.kind==='allOf'||item.kind==='anyOf'){
    const values=item.items.map(child=>resolvePreferencePredicate(child,controlToPreference,enabledByControl,seen));if(values.some(value=>!value))return null;
    return rawAll(item.kind,values);
  }
  return null;
}
function negatePreferencePredicate(item){
  if(!item)return null;
  if(item.kind==='true')return{kind:'false'};if(item.kind==='false')return{kind:'true'};
  if(item.kind==='truthy')return{kind:'falsy',key:item.key};if(item.kind==='falsy')return{kind:'truthy',key:item.key};
  if(item.kind==='equals')return{kind:'notEquals',key:item.key,value:item.value};if(item.kind==='notEquals')return{kind:'equals',key:item.key,value:item.value};
  if(item.kind==='gt')return{kind:'lte',key:item.key,value:item.value};if(item.kind==='lte')return{kind:'gt',key:item.key,value:item.value};
  if(item.kind==='allOf')return rawAll('anyOf',item.items.map(negatePreferencePredicate));
  if(item.kind==='anyOf')return rawAll('allOf',item.items.map(negatePreferencePredicate));
  return null;
}

export function extractQbPreferencesBehaviorPredicates(source,controlToPreference={}){
  const text=String(source||''),enabledByControl=new Map(),assignments=[],functions=[];
  for(const match of text.matchAll(/(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:\(\s*\)\s*=>|function\s*\(\s*\))\s*\{/g)){
    const body=balancedBody(text,match.index??0);if(body)functions.push({name:String(match[1]),body,start:match.index??0});
  }
  for(const match of text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\{/g)){
    const body=balancedBody(text,match.index??0);if(body&&!functions.some(item=>item.start===(match.index??0)))functions.push({name:String(match[1]),body,start:match.index??0});
  }
  functions.sort((a,b)=>a.start-b.start);
  for(const fn of functions){
    const env=new Map();
    for(const match of fn.body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)){
      const name=String(match[1]),expression=match[2],bag=sourcePropertyBag(expression);
      if(bag){for(const property of bag.properties){const raw=rawControlProperty(bag.controlId,property);if(raw)env.set(name+'.'+property,raw);}continue;}
      const parsed=parseRawPredicate(expression,env);if(parsed)env.set(name,parsed);
    }
    const modern=[
      ...fn.body.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)\.disabled\s*=\s*([^;]+);/g),
      ...fn.body.matchAll(/\$\(\s*["']([^"']+)["']\s*\)\.disabled\s*=\s*([^;]+);/g)
    ].map(match=>({target:match[1],expr:match[2],evidence:'property'}));
    const legacy=[...fn.body.matchAll(/\$\(\s*["']([^"']+)["']\s*\)\.(?:setProperty|set)\(\s*["']disabled["']\s*,\s*([\s\S]*?)\)\s*;/g)].map(match=>({target:match[1],expr:match[2],evidence:'setter'}));
    for(const row of [...modern,...legacy]){
      const disabled=parseRawPredicate(row.expr,env),enabled=negateRaw(disabled),target=String(row.target||'');
      if(enabled)enabledByControl.set(target,enabled);
      assignments.push({controlId:target,functionName:fn.name,evidence:row.evidence,resolved:!!enabled});
    }
  }
  const predicates={},unresolved=[];
  for(const row of assignments){
    if(Object.prototype.hasOwnProperty.call(predicates,row.controlId))continue;
    const raw=enabledByControl.get(row.controlId),resolved=resolvePreferencePredicate(raw,controlToPreference,enabledByControl);
    if(resolved)predicates[row.controlId]=resolved;
    else{predicates[row.controlId]={kind:'unknown'};unresolved.push({controlId:row.controlId,functionName:row.functionName});}
  }
  const controlDependencies=Object.fromEntries([...enabledByControl.entries()].map(([controlId,raw])=>[controlId,[...rawPredicateControlIds(raw)]]).filter(([,ids])=>ids.length));
  return{predicates,assignments,unresolved,controlDependencies};
}

export function extractQbPreferencesCompositeUiFacts(source,preferenceKeys=[]){
  const text=String(source||''),wanted=new Set((preferenceKeys||[]).map(String)),out={},titles=controlTitles(text);
  const add=(key,id,evidence,titleOverride=null,structured=null)=>{key=String(key||'');id=String(id||'');if(!key||!id||out[key]||(wanted.size&&!wanted.has(key)))return;const title=titleOverride||titles.get(id);if(title)out[key]={controlId:id,evidence,title,...(structured?{structured}:{})};};
  const statementPatterns=[
    {re:/document\.getElementById\(\s*["']([^"']+)["']\s*\)[^;\n]*?=[^;\n]*;?/g,family:'semantic-modern-statement'},
    {re:/\$\(\s*["']([^"']+)["']\s*\)[^;\n]*?=[^;\n]*;?/g,family:'semantic-legacy-statement'},
    {re:/\$\(\s*["']([^"']+)["']\s*\)\.(?:setProperty|set)\([^;\n]*\)\s*;?/g,family:'semantic-legacy-set'}
  ];
  for(const item of statementPatterns)for(const match of text.matchAll(item.re))for(const key of prefRefs(match[0],wanted))add(key,match[1],item.family);
  for(const match of text.matchAll(/\bswitch\s*\(\s*(?:Number\s*\(\s*)?pref\s*\.\s*([A-Za-z_$][\w$]*)(?:\s*\))?(?:\s*\.\s*toInt\s*\(\s*\))?\s*\)/g)){
    const key=String(match[1]||'');if(wanted.size&&!wanted.has(key))continue;const body=balancedBody(text,match.index??0),ids=controlIds(body);if(ids.length===1)add(key,ids[0],'semantic-switch');
  }
  for(const fact of structuredReturnFacts(text,wanted))add(fact.key,fact.controlId,fact.evidence,fact.title,fact.structured);
  return out;
}
