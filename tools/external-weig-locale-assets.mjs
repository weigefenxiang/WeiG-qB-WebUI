import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const languages=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8')).languages;
const englishSource=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');
const englishMatch=/var EN=(\{[^\n]+\});/.exec(englishSource);
assert(englishMatch,'Canonical W.I18n English source missing');
const english=JSON.parse(englishMatch[1]);
const primaryCodes=new Set(languages.filter(x=>x.primary).map(x=>x.code));
const extended=languages.filter(x=>!primaryCodes.has(x.code)&&!['en_AU','en_GB'].includes(x.code));
const bySlug=new Map(extended.map(x=>[x.slug,x]));
export const expectedExtendedLocales=Object.freeze(extended.map(x=>x.slug));
export const rootOfExternalLocales=path.join(root,'language-packs/weig-i18n');
function placeholders(s){return [...String(s).matchAll(/\{([^{}]+)\}/g)].map(match=>match[1]).sort().join('|');}
export function validateExternalOverlay(locale,data){
  assert(bySlug.has(locale),'Unknown/non-extended locale '+locale);
  assert(data&&data.schemaVersion===1&&data.source==='WeiG-runtime-locale-overlay'&&data.locale===locale,'Invalid extended language overlay identity '+locale);
  assert(data.messages&&typeof data.messages==='object'&&!Array.isArray(data.messages)&&Object.keys(data.messages).length>0,'Empty/invalid extended language overlay '+locale);
  assert(data.translationStatus==='draft'||data.translationStatus==='approved','External language must declare draft or approved review status: '+locale);
  for(const [key,value] of Object.entries(data.messages)){
    assert(Object.hasOwn(english,key),'Unknown canonical English key '+locale+'/'+key);
    assert(typeof value==='string'&&value.trim().length>0,'Empty/invalid translation '+locale+'/'+key);
    assert.equal(placeholders(value),placeholders(english[key]),'Placeholder mismatch '+locale+'/'+key);
  }
  return Object.keys(data.messages).length;
}
export function inspectExtendedLocaleSources({requireComplete=false,sourceDir=rootOfExternalLocales}={}){
  assert(fs.existsSync(sourceDir),'Missing extended language source directory');
  const files=fs.readdirSync(sourceDir).filter(x=>x.endsWith('.json'));
  const present=new Set(),drafts=[];
  let keys=0;
  for(const filename of files){
    const locale=filename.slice(0,-5);
    assert(bySlug.has(locale),'Unknown external overlay '+filename);
    assert(!present.has(locale),'Duplicate external locale '+locale);
    const data=JSON.parse(fs.readFileSync(path.join(sourceDir,filename),'utf8'));
    keys+=validateExternalOverlay(locale,data);
    if(data.translationStatus==='approved')present.add(locale);
    else drafts.push(locale);
  }
  const missing=expectedExtendedLocales.filter(x=>!present.has(x));
  if(requireComplete)assert.equal(missing.length,0,'Full-language distribution cannot claim completion: missing '+missing.join(', '));
  return Object.freeze({official:languages.length,primary:primaryCodes.size,englishVariants:2,expected:expectedExtendedLocales.length,ready:present.size,drafts,keys,missing});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const status=inspectExtendedLocaleSources({requireComplete:process.argv.includes('--require-complete')});
  console.log(JSON.stringify(status,null,2));
}
