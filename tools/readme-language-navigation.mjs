import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
const primary=['en','zh_CN','zh_TW','ja','ko','de','fr','es','pt_PT','ru'];
const titles={"":"Language","zh-CN":"语言","zh-TW":"語言","zh-HK":"語言","ja":"言語","ko":"언어","de":"Sprache","fr":"Langue","es":"Idioma","pt":"Idioma","ru":"Язык","pt-BR":"Idioma","it":"Lingua","ca":"Idioma","nl":"Taal","ar":"اللغة","vi":"Ngôn ngữ","id":"Bahasa","tr":"Dil","uk":"Мова","sv":"Språk","nb":"Språk","da":"Sprog","fi":"Kieli","fa":"زبان","he":"שפה","el":"Γλώσσα","pl":"Język","cs":"Jazyk","sk":"Jazyk","hr":"Jezik","sl":"Jezik","ro":"Limbă","bs":"Jezik","sr-Latn":"Jezik","sr":"Језик","be":"Мова","bg":"Език","eo":"Lingvo","gl":"Lingua","ms-MY":"Bahasa","hu":"Nyelv","et":"Keel"};
const moreTitles={"":"More languages","zh-CN":"更多语言","zh-TW":"更多語言","zh-HK":"更多語言","ja":"その他の言語","ko":"더 많은 언어","de":"Weitere Sprachen","fr":"Autres langues","es":"Más idiomas","pt":"Mais idiomas","ru":"Другие языки","pt-BR":"Mais idiomas","it":"Altre lingue","ca":"Més llengües","nl":"Meer talen","ar":"لغات أخرى","vi":"Ngôn ngữ khác","id":"Bahasa lainnya","tr":"Diğer diller","uk":"Інші мови","sv":"Fler språk","nb":"Flere språk","da":"Flere sprog","fi":"Lisää kieliä","fa":"زبان‌های بیشتر","he":"שפות נוספות","el":"Περισσότερες γλώσσες","pl":"Więcej języków","cs":"Další jazyky","sk":"Ďalšie jazyky","hr":"Više jezika","sl":"Več jezikov","ro":"Mai multe limbi","bs":"Više jezika","sr-Latn":"Više jezika","sr":"Више језика","be":"Іншыя мовы","bg":"Още езици","eo":"Pliaj lingvoj","gl":"Máis linguas","ms-MY":"Bahasa lain","hu":"További nyelvek","et":"Veel keeli"};
const start='<!-- WEIG-README-LANGUAGES:START -->';
const end='<!-- WEIG-README-LANGUAGES:END -->';
export function readmePath(lang){return lang.code==='en'?'README.md':'translations/README.'+lang.slug+'.md';}
export function renderNavigation(lang) {
  const rootReadme=lang.code==='en', prefix=rootReadme?'translations/':'';
  const byCode=new Map(inventory.languages.map(item=>[item.code,item]));
  const primaryMarkup=primary.map(code=>{
    const item=byCode.get(code);
    if(code===lang.code)return '**'+item.name+'**';
    const target=code==='en'?'../README.md':prefix+'README.'+item.slug+'.md';
    return '['+item.name+']('+target+')';
  }).join(' · ');
  const rest=inventory.languages.filter(item=>!item.primary)
    .sort((a,b)=>a.direction==='rtl'&&b.direction!=='rtl'?1:a.direction!=='rtl'&&b.direction==='rtl'?-1:inventory.languages.indexOf(a)-inventory.languages.indexOf(b));
  const html=rest.map(item=>{
    const text=item.direction==='rtl'?'&#x2067;'+item.name+'&#x2069;':item.name;
    return item.code===lang.code?'<strong>'+text+'</strong>':'<a href="'+prefix+'README.'+item.slug+'.md">'+text+'</a>';
  }).join(' &lrm;·&lrm; ');
  return [start,'**'+(titles[lang.slug]||'Language')+'**: '+primaryMarkup,'','<details>',
    '<summary><b>🔤 '+(moreTitles[lang.slug]||'More languages')+'</b></summary>',
    '','<div dir="ltr">',html,'</div>','','</details>',end].join('\n');
}
export function updateNavigation(markdown,lang){
  const next=renderNavigation(lang);
  if(markdown.includes(start)){
    const first=markdown.indexOf(start),last=markdown.indexOf(end,first);
    if(last<0)throw Error('Missing language navigator end marker: '+lang.slug);
    return markdown.slice(0,first)+next+markdown.slice(last+end.length);
  }
  const old=markdown.split(/\r?\n/).find(line=>/^\*\*(?:Language|语言|語言|言語|언어|Sprache|Langue|Idioma|Язык)\*\*/u.test(line));
  if(!old)throw Error('Missing existing language line: '+lang.slug);
  return markdown.replace(old,next);
}
export function updateAll(write=false){
  if(inventory.schemaVersion!==1||inventory.languages.length!==61||new Set(inventory.languages.map(x=>x.slug)).size!==61)throw Error('Official locale catalog is incomplete or duplicated');
  let changed=0;
  for(const lang of inventory.languages){
    const file=path.join(root,readmePath(lang));
    if(!fs.existsSync(file))continue; // Intentional: hyperlinks precede translations.
    const original=fs.readFileSync(file,'utf8'),next=updateNavigation(original,lang);
    if(original!==next){changed++;if(write)fs.writeFileSync(file,next,'utf8');}
  }
  return changed;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const write=process.argv.includes('--write'),changed=updateAll(write);
  console.log('README navigation '+(write?'updated':'checked')+': '+changed+' '+(write?'written':'out of date'));
  if(!write&&changed)process.exitCode=1;
}
