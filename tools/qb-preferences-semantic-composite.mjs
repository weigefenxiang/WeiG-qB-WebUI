function decodeHtml(value){return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(Number.parseInt(n,16))).replace(/&amp;/g,'&').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();}
function qbtTr(value){const match=String(value||'').match(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/i);if(!match)return null;const source=decodeHtml(match[1]),context=String(match[2]||'').trim();return source&&context?{source,context}:null;}
function escapeRe(value){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function prefRefs(statement,wanted){const out=[];for(const match of String(statement||'').matchAll(/\bpref\s*\.\s*([A-Za-z_$][\w$]*)/g)){const key=String(match[1]||'');if((!wanted.size||wanted.has(key))&&!out.includes(key))out.push(key);}return out;}
function controlTitle(markup,id){
  const escaped=escapeRe(id),text=String(markup||'');
  const direct=text.match(new RegExp(`<label\\b([^>]*)\\bfor\\s*=\\s*["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/label>`,'i'));
  if(direct){const ref=qbtTr(direct[2]);if(ref)return ref;}
  const labelled=text.match(new RegExp(`<(?:input|select|textarea|table)\\b[^>]*\\bid\\s*=\\s*["']${escaped}["'][^>]*\\baria-labelledby\\s*=\\s*["']([^"']+)["'][^>]*>`,'i'));
  if(labelled){for(const labelId of String(labelled[1]||'').split(/\s+/)){const label=text.match(new RegExp(`<label\\b[^>]*\\bid\\s*=\\s*["']${escapeRe(labelId)}["'][^>]*>([\\s\\S]*?)<\\/label>`,'i'));const ref=label?qbtTr(label[1]):null;if(ref)return ref;const legend=text.match(new RegExp(`<legend\\b[^>]*\\bid\\s*=\\s*["']${escapeRe(labelId)}["'][^>]*>([\\s\\S]*?)<\\/legend>`,'i'));const legendRef=legend?qbtTr(legend[1]):null;if(legendRef)return legendRef;}}
  const adjacent=text.match(new RegExp(`<label\\b[^>]*>([\\s\\S]*?)<\\/label>\\s*<(?:input|select|textarea|table)\\b[^>]*\\bid\\s*=\\s*["']${escaped}["']`,'i'));
  return adjacent?qbtTr(adjacent[1]):null;
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

export function extractQbPreferencesCompositeUiFacts(source,preferenceKeys=[]){
  const text=String(source||''),wanted=new Set((preferenceKeys||[]).map(String)),out={};
  const add=(key,id,evidence)=>{key=String(key||'');id=String(id||'');if(!key||!id||out[key]||(wanted.size&&!wanted.has(key)))return;const title=controlTitle(text,id);if(title)out[key]={controlId:id,evidence,title};};
  const statementPatterns=[
    {re:/document\.getElementById\(\s*["']([^"']+)["']\s*\)[^;\n]*?=[^;\n]*;?/g,family:'semantic-modern-statement'},
    {re:/\$\(\s*["']([^"']+)["']\s*\)[^;\n]*?=[^;\n]*;?/g,family:'semantic-legacy-statement'},
    {re:/\$\(\s*["']([^"']+)["']\s*\)\.(?:setProperty|set)\([^;\n]*\)\s*;?/g,family:'semantic-legacy-set'}
  ];
  for(const item of statementPatterns)for(const match of text.matchAll(item.re))for(const key of prefRefs(match[0],wanted))add(key,match[1],item.family);
  for(const match of text.matchAll(/\bswitch\s*\(\s*(?:Number\s*\(\s*)?pref\s*\.\s*([A-Za-z_$][\w$]*)(?:\s*\))?(?:\s*\.\s*toInt\s*\(\s*\))?\s*\)/g)){
    const key=String(match[1]||'');if(wanted.size&&!wanted.has(key))continue;const body=balancedBody(text,match.index??0),ids=controlIds(body);if(ids.length===1)add(key,ids[0],'semantic-switch');
  }
  return out;
}
