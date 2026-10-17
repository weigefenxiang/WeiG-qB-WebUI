import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedExtendedLocales,rootOfExternalLocales,validateExternalOverlay,canonicalEnglishSourceSha256,canonicalEnglishTranslationKeys} from './external-weig-locale-assets.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');
const match=/var EN=(\{[^\n]+\});/.exec(script);
assert(match,'W.I18n canonical English messages missing');
const english=JSON.parse(match[1]);
const chinese=JSON.parse(fs.readFileSync(path.join(root,'webui/private/data/weig-i18n/zh-CN.json'),'utf8'));
assert.equal(chinese.source,'WeiG-runtime-locale-overlay');
assert.equal(chinese.locale,'zh-CN');
const known=new Set(expectedExtendedLocales);

export function getTranslationReviewWorklist(locale){
  assert(known.has(locale),'Unknown or already bundled external locale: '+locale);
  const sourceFile=path.join(rootOfExternalLocales,locale+'.json');
  const data=fs.existsSync(sourceFile)?JSON.parse(fs.readFileSync(sourceFile,'utf8')):null;
  if(data)validateExternalOverlay(locale,data);
  const messages=data?.messages||{};
  const explicitEnglish=new Set(data?.reviewedEnglishFallbackKeys||[]);
  const copiedEnglish=Object.keys(messages).filter(key=>messages[key]===english[key]);
  const outstanding=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(messages,key)&&!explicitEnglish.has(key));
  const work=outstanding.map(key=>({key,english:english[key],
    simplifiedChinese:Object.hasOwn(chinese.messages,key)?chinese.messages[key]:null,
    placeholders:[...String(english[key]).matchAll(/\{([^{}]+)\}/g)].map(m=>m[1])}));
  return {schemaVersion:1,source:'WeiG-translation-review-worklist',
    locale,status:data?.translationStatus||'missing',englishSourceSha256:canonicalEnglishSourceSha256,
    canonicalKeys:canonicalEnglishTranslationKeys.length,
    suppliedKeys:Object.keys(messages).length,unchangedEnglishKeys:copiedEnglish,
    reviewedEnglishFallbackCount:explicitEnglish.size,unreviewedKeys:outstanding.length,
    work};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const localeArg=process.argv.find(arg=>arg.startsWith('--locale='));
  assert(localeArg,'Usage: node tools/translation-review-worklist.mjs --locale=ca [--limit=30]');
  const locale=localeArg.slice('--locale='.length);
  const result=getTranslationReviewWorklist(locale);
  const limArg=process.argv.find(arg=>arg.startsWith('--limit='));
  const limit=limArg?Number(limArg.split('=')[1]):30;
  assert(Number.isSafeInteger(limit)&&limit>=0&&limit<=canonicalEnglishTranslationKeys.length,'Invalid --limit');
  console.log(JSON.stringify({...result,work:result.work.slice(0,limit)},null,2));
}
