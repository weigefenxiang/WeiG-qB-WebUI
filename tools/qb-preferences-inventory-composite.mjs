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

export function inventoryCompositeSwitchBindings(source,descriptorKeys=new Set()){
  const text=String(source||''),wanted=descriptorKeys instanceof Set?descriptorKeys:new Set((descriptorKeys||[]).map(String)),rows=[];
  for(const match of text.matchAll(/\bswitch\s*\(\s*(?:Number\s*\(\s*)?pref\s*\.\s*([A-Za-z_$][\w$]*)(?:\s*\))?(?:\s*\.\s*toInt\s*\(\s*\))?\s*\)/g)){
    const key=String(match[1]||'');if(!key||(wanted.size&&!wanted.has(key)))continue;
    const body=balancedBody(text,match.index??0),ids=controlIds(body);if(ids.length!==1)continue;
    rows.push({key:ids[0],preferenceKeys:[key],syntax:['independent-switch-read'],position:match.index??0});
  }
  return rows;
}
