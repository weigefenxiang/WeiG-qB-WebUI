import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const languages=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8')).languages;
const englishSource=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');
const englishMatch=/var EN=(\{[^\n]+\});/.exec(englishSource);
assert(englishMatch,'Canonical W.I18n English source missing');
const english=JSON.parse(englishMatch[1]);
export const canonicalEnglishTranslationKeys=Object.freeze(Object.keys(english));
export const canonicalEnglishMessages=Object.freeze(english);
const MAX_APPROVED_ENGLISH_FALLBACK_PERCENT=10;
// Preserve only source-bound identifiers (RSS, product name and language endonyms). Other UI labels such as ETA and Version remain localizable.
export const SOURCE_PRESERVED_UI_LABELS=Object.freeze({
  'nav.rss':'RSS',
  'rss.title':'RSS',
  'capability.rss.title':'RSS',
  'settings.weig.title':'WeiG WebUI',
  'language.en':'English',
  'language.zh-CN':'简体中文',
  'language.ja':'日本語',
  'language.ko':'한국어'
});
for(const [key,source] of Object.entries(SOURCE_PRESERVED_UI_LABELS)){
  assert.equal(english[key],source,'Canonical fixed English UI label changed: '+key);
}
export const canonicalEnglishSourceSha256=createHash('sha256').update(JSON.stringify(english)).digest('hex');
const primaryCodes=new Set(languages.filter(x=>x.primary).map(x=>x.code));
const runtimeLocaleMatch=/var SUPPORTED_LOCALES=(\[[^\n]+\]);/.exec(englishSource);
assert(runtimeLocaleMatch,'Canonical W.I18n runtime locale inventory missing');
const bundledLocales=new Set(JSON.parse(runtimeLocaleMatch[1]));
const extended=languages.filter(x=>!bundledLocales.has(x.slug||x.code)&&!['en_AU','en_GB'].includes(x.code));
assert(extended.length+bundledLocales.size+2===languages.length,'Extended locale inventory overlaps current W.I18n or misses official locales');
const bySlug=new Map(extended.map(x=>[x.slug,x]));
export const expectedExtendedLocales=Object.freeze(extended.map(x=>x.slug));
export const rootOfExternalLocales=path.join(root,'language-packs/weig-i18n');
function placeholders(s){return [...String(s).matchAll(/\{([^{}]+)\}/g)].map(match=>match[1]).sort().join('|');}
function boundaryWhitespace(s,leading){return (String(s).match(leading?/^\s*/:/\s*$/)||[''])[0];}
export function validateExternalOverlay(locale,data){
  assert(bySlug.has(locale),'Unknown/non-extended locale '+locale);
  assert(data&&data.schemaVersion===1&&data.source==='WeiG-runtime-locale-overlay'&&data.locale===locale,'Invalid extended language overlay identity '+locale);
  assert(data.messages&&typeof data.messages==='object'&&!Array.isArray(data.messages)&&Object.keys(data.messages).length>0,'Empty/invalid extended language overlay '+locale);
  assert(data.translationStatus==='draft'||data.translationStatus==='approved','External language must declare draft or approved review status: '+locale);
  for(const [key,value] of Object.entries(data.messages)){
    assert(Object.hasOwn(english,key),'Unknown canonical English key '+locale+'/'+key);
    assert(!Object.hasOwn(SOURCE_PRESERVED_UI_LABELS,key),'Standalone English UI label must use W.I18n fallback: '+locale+'/'+key);
    assert(typeof value==='string'&&value.trim().length>0,'Empty/invalid translation '+locale+'/'+key);
    assert.equal(placeholders(value),placeholders(english[key]),'Placeholder mismatch '+locale+'/'+key);
    assert.equal(boundaryWhitespace(value,true),boundaryWhitespace(english[key],true),'Leading whitespace mismatch '+locale+'/'+key);
    assert.equal(boundaryWhitespace(value,false),boundaryWhitespace(english[key],false),'Trailing whitespace mismatch '+locale+'/'+key);
    // Network address literals are executable host identifiers, not translatable words.
    // A localized spelling of localhost may make the safety hint unusable.
    if(key==='instances.loopbackWarning'){
      for(const address of ['127.0.0.1','localhost']){
        assert(value.includes(address),'Canonical network address literal missing: '+locale+'/'+key+'/'+address);
      }
    }
    assert.notEqual(value,english[key],'WeiG overlay duplicates canonical English value; omit the key to use W.I18n fallback: '+locale+'/'+key);
  }
  // Review progress is source-bound even while a locale remains draft.
  // Unvalidated draft fallbacks would otherwise silently disappear from worklists.
  const reviewedFallback=data.reviewedEnglishFallbackKeys;
  if(reviewedFallback!==undefined||data.translationStatus==='approved'){
    assert(Array.isArray(reviewedFallback),'reviewed English fallback keys must be an array: '+locale);
    assert.equal(data.englishSourceSha256,canonicalEnglishSourceSha256,
      'Reviewed locale English-source fingerprint mismatch: '+locale);
    const accounted=new Set(Object.keys(data.messages));
    for(const key of reviewedFallback){
      assert(typeof key==='string'&&Object.hasOwn(english,key),'Unknown reviewed English fallback key: '+locale+'/'+key);
      assert(!accounted.has(key),'Duplicate or overlapping reviewed fallback: '+locale+'/'+key);
      accounted.add(key);
    }
    if(data.translationStatus==='approved'){
      assert(reviewedFallback.length*100<=canonicalEnglishTranslationKeys.length*MAX_APPROVED_ENGLISH_FALLBACK_PERCENT,
        'Approved locale exceeds 10% English fallback review budget: '+locale);
      assert.equal(accounted.size,canonicalEnglishTranslationKeys.length,'Approved locale has unreviewed canonical WeiG messages: '+locale);
    }
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
    const sourceFile=path.join(sourceDir,filename),bytes=fs.statSync(sourceFile).size;
    assert(bytes>2&&bytes<5*1024*1024,'Extended WeiG locale asset exceeds runtime single-file limit: '+filename);
    const data=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
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
