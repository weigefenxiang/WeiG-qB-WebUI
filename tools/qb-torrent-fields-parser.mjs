import {QT_STRING_SUFFIX_SOURCE,extractStringLiterals} from './qb-cpp-literals.mjs';
import {parseQbtSourceRef} from './qb-source-text.mjs';
function unique(values){return [...new Set(values.filter(Boolean))];}
function escapeRe(value){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function extractFunctionBody(source,signature,label){const text=String(source||''),match=signature.exec(text);if(!match)throw new Error(`${label}: missing expected function`);const open=text.indexOf('{',match.index+match[0].length-1);if(open<0)throw new Error(`${label}: missing function body`);let depth=0,inString=false,quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i];if(inString){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)inString=false;continue;}if(ch==='"'||ch==="'"){inString=true;quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return text.slice(open+1,i);}throw new Error(`${label}: unterminated function body`);}
function extractBlockFromOpen(text,open,label){let depth=0,mode='code',quote='',escape=false;for(let i=open;i<text.length;i++){const ch=text[i],next=text[i+1];if(mode==='line-comment'){if(ch==='\n'||ch==='\r')mode='code';continue;}if(mode==='block-comment'){if(ch==='*'&&next==='/'){mode='code';i++;}continue;}if(mode==='string'){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote){mode='code';quote='';}continue;}if(ch==='/'&&next==='/'){mode='line-comment';i++;continue;}if(ch==='/'&&next==='*'){mode='block-comment';i++;continue;}if(ch==='"'||ch==="'"||ch==='`'){mode='string';quote=ch;escape=false;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return text.slice(open+1,i);}throw new Error(`${label}: unterminated block`);}
function jsString(value){return String(value||'').replace(/\\(['"\\])/g,'$1').replace(/\\n/g,'\n').replace(/\\t/g,'\t');}
function qbtRef(value){return parseQbtSourceRef(value);}
function tableClassBody(source,className,context){const text=String(source||''),name=escapeRe(className);let match=text.match(new RegExp(`\\bclass\\s+${name}\\s+extends\\s+DynamicTable\\s*\\{`));if(match){const open=text.indexOf('{',match.index);return extractBlockFromOpen(text,open,`${context}: class ${className}`);}match=text.match(new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*new\\s+Class\\s*\\(\\s*\\{`));if(match){const open=text.indexOf('{',match.index);return extractBlockFromOpen(text,open,`${context}: ${className} Class`);}throw new Error(`${context}: unable to locate ${className} implementation`);}
function initColumnsBody(classBody,className,context){let match=/\binitColumns\s*\(\s*\)\s*\{/.exec(classBody);if(!match)match=/\binitColumns\s*:\s*function\s*\(\s*\)\s*\{/.exec(classBody);if(!match)throw new Error(`${context}: ${className}.initColumns missing`);const open=classBody.indexOf('{',match.index+match[0].length-1);return extractBlockFromOpen(classBody,open,`${context}: ${className}.initColumns`);}
export function extractKeyConstants(source,prefix='KEY_'){const out=new Map(),text=String(source||'');const re=new RegExp(`(?:inline\\s+)?const\\s+(?:char|QString)\\s+([A-Z0-9_]+)(?:\\s*\\[\\s*\\])?\\s*=\\s*(?:u)?"([^"]+)"${QT_STRING_SUFFIX_SOURCE}\\s*;`,'g');for(const match of text.matchAll(re)){if(match[1].startsWith(prefix))out.set(match[1],match[2]);}return out;}
export function extractTorrentInfoFields({headerSource='',serializerSource=''}={},context='qB source'){const constants=extractKeyConstants(headerSource,'KEY_TORRENT_');if(!constants.size)throw new Error(`${context}: unable to extract Torrent field key constants`);const body=extractFunctionBody(serializerSource,/\bQVariantMap\s+serialize\s*\([^)]*\)/,`${context}: serialize(Torrent)`);const identifiers=unique([...body.matchAll(/\b(KEY_TORRENT_[A-Z0-9_]+)\b/g)].map(match=>match[1]));const unknown=identifiers.filter(name=>!constants.has(name));if(unknown.length)throw new Error(`${context}: Torrent serializer references unknown keys: ${unknown.join(', ')}`);const fields=unique(identifiers.map(name=>constants.get(name))).sort();if(!fields.length)throw new Error(`${context}: empty Torrent info field surface`);return fields;}
export function extractTorrentStates(serializerSource,context='qB source'){const body=extractFunctionBody(serializerSource,/\btorrentStateToString\s*\([^)]*\)/,`${context}: torrentStateToString`);const states=unique(extractStringLiterals(body));if(!states.length)throw new Error(`${context}: empty Torrent state surface`);return states;}
export function extractDynamicTableColumns(dynamicTableSource,className='TorrentsTable',context='qB source'){
  const classBody=tableClassBody(dynamicTableSource,className,context),body=initColumnsBody(classBody,className,context),columns=[];
  const re=/this\.newColumn\(\s*(['"])([^'"]*)\1\s*,\s*(['"])([^'"]*)\3\s*,\s*(['"])([^'"]*)\5\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(true|false)\s*\)\s*;/gs;
  for(const match of body.matchAll(re)){
    const key=jsString(match[2]).trim(),captionRaw=jsString(match[6]),translation=qbtRef(captionRaw),caption=translation?translation.source:captionRaw;
    if(!key)continue;
    columns.push({key,caption,defaultWidth:Number(match[7]),defaultVisible:match[8]==='true',...(translation?{translation}:{}),dataProperties:[key]});
  }
  if(!columns.length)throw new Error(`${context}: unable to extract ${className} native columns`);
  const byKey=new Map(columns.map(item=>[item.key,item]));
  for(const match of body.matchAll(/this\.columns\[\s*(['"])([^'"]*)\1\s*\]\.dataProperties\[\s*0\s*\]\s*=\s*(['"])([^'"]*)\3\s*;/g)){
    const item=byKey.get(jsString(match[2]));if(item)item.dataProperties[0]=jsString(match[4]);
  }
  for(const match of body.matchAll(/this\.columns\[\s*(['"])([^'"]*)\1\s*\]\.dataProperties\.push\(\s*(['"])([^'"]*)\3\s*\)\s*;/g)){
    const item=byKey.get(jsString(match[2])),value=jsString(match[4]);if(item&&value&&!item.dataProperties.includes(value))item.dataProperties.push(value);
  }
  if(new Set(columns.map(item=>item.key)).size!==columns.length)throw new Error(`${context}: duplicate ${className} native column key`);
  return columns;
}
export function extractTorrentTableColumns(dynamicTableSource,context='qB source'){return extractDynamicTableColumns(dynamicTableSource,'TorrentsTable',context);}
