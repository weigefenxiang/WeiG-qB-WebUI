import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
// A78-191: the Simplified Chinese overlay defines draft *scope*, not the 693-key approval contract.
export const simplifiedChineseReferenceKeys=Object.freeze(Object.keys(chinese.messages));
assert(simplifiedChineseReferenceKeys.every(key=>Object.hasOwn(english,key)),
  'Simplified Chinese draft reference contains a key absent from English canonical');
export const simplifiedChineseReferenceSha256=createHash('sha256')
  .update(JSON.stringify(chinese.messages)).digest('hex');

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

const SCOPE_DECISION_SOURCE='WeiG-locale-draft-scope-decisions';
function scopeDecisionsFor(locale,overridden){
  const file=path.join(root,'language-packs/weig-i18n-scopes',locale+'.json');
  const data=overridden===undefined
    ?(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null)
    :overridden;
  if(data===null)return {};
  assert(data&&typeof data==='object'&&!Array.isArray(data),'Invalid draft scope decisions for '+locale);
  assert.equal(data.schemaVersion,1,'Invalid scope decision schema for '+locale);
  assert.equal(data.source,SCOPE_DECISION_SOURCE,'Invalid scope decision source for '+locale);
  assert.equal(data.locale,locale,'Scope decision locale mismatch: '+locale);
  assert.equal(data.englishSourceSha256,canonicalEnglishSourceSha256,
    'Stale English fingerprint for draft scope '+locale);
  assert.equal(data.simplifiedChineseSourceSha256,simplifiedChineseReferenceSha256,
    'Stale Simplified Chinese fingerprint for draft scope '+locale);
  const decisions=data.decisions;
  assert(decisions&&typeof decisions==='object'&&!Array.isArray(decisions),
    'Invalid draft scope decisions map for '+locale);
  return decisions;
}
/**
 * Draft translation scope is deliberately separate from the 693-key Approved gate.
 * Explicit English and qB ownership decisions are never treated as human approval.
 * Missing keys without evidenced decisions remain unresolved, not automatically fallback.
 */
export function getTranslationDraftScopeWorklist(locale,{decisions}={}){
  assert(known.has(locale),'Unknown or already bundled external locale: '+locale);
  const sourceFile=path.join(rootOfExternalLocales,locale+'.json');
  const data=fs.existsSync(sourceFile)?JSON.parse(fs.readFileSync(sourceFile,'utf8')):null;
  if(data)validateExternalOverlay(locale,data);
  const messages=data?.messages||{};
  const explicit=scopeDecisionsFor(locale,decisions);
  const reference=new Set(simplifiedChineseReferenceKeys);
  for(const [key,decision] of Object.entries(explicit)){
    assert(reference.has(key),'Non-reference key in draft scope decisions: '+locale+'/'+key);
    assert(!Object.hasOwn(messages,key),'Draft scope decision overlaps translated value: '+locale+'/'+key);
    assert(decision&&typeof decision==='object'&&!Array.isArray(decision),
      'Invalid draft scope decision: '+locale+'/'+key);
    assert(['intentional_english','qb_owned'].includes(decision.classification),
      'Unsupported draft scope classification: '+locale+'/'+key);
    assert(typeof decision.reason==='string'&&decision.reason.trim().length>=12,
      'Draft scope decision needs a specific reason: '+locale+'/'+key);
    assert(typeof decision.evidence==='string'&&decision.evidence.trim().length>=12,
      'Draft scope decision needs verifiable evidence: '+locale+'/'+key);
    if(decision.classification==='qb_owned'){
      assert(typeof decision.ownerFile==='string'&&decision.ownerFile.startsWith('webui/'),
        'qB-owned scope decision needs real runtime owner file: '+locale+'/'+key);
      assert(typeof decision.caller==='string'&&decision.caller.trim().length>=8,
        'qB-owned scope decision needs source caller evidence: '+locale+'/'+key);
    }
  }
  const counts={localized:0,intentional_english:0,qb_owned:0,unresolved:0};
  const items=simplifiedChineseReferenceKeys.map(key=>{
    const translated=Object.hasOwn(messages,key),decision=explicit[key];
    const classification=translated?'localized':decision?.classification||'unresolved';
    counts[classification]++;
    return {key,english:english[key],simplifiedChinese:chinese.messages[key],
      translation:translated?messages[key]:null,classification,
      ...(decision?{reason:decision.reason,evidence:decision.evidence,
        ...(decision.classification==='qb_owned'?{ownerFile:decision.ownerFile,caller:decision.caller}:{})}:{})};
  });
  assert.equal(Object.values(counts).reduce((n,v)=>n+v,0),simplifiedChineseReferenceKeys.length);
  const unresolved=items.filter(item=>item.classification==='unresolved');
  return {schemaVersion:1,source:'WeiG-translation-draft-scope-worklist',
    locale,status:data?.translationStatus||'missing',
    englishSourceSha256:canonicalEnglishSourceSha256,
    simplifiedChineseSourceSha256:simplifiedChineseReferenceSha256,
    referenceKeys:simplifiedChineseReferenceKeys.length,
    canonicalEnglishKeys:canonicalEnglishTranslationKeys.length,
    counts,unresolvedKeys:unresolved.length,
    draftScopeComplete:unresolved.length===0,
    // A release-quality approval is not evidence of native-speaker review.
    distributionApproved:data?.translationStatus==='approved',
    englishOnlyOutOfScope:canonicalEnglishTranslationKeys.length-simplifiedChineseReferenceKeys.length,
    items,work:unresolved};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const localeArg=process.argv.find(arg=>arg.startsWith('--locale='));
  assert(localeArg,'Usage: node tools/translation-review-worklist.mjs --locale=ca [--limit=30]');
  const locale=localeArg.slice('--locale='.length);
  const scopeArg=process.argv.find(arg=>arg.startsWith('--scope='));
  assert(!scopeArg||scopeArg==='--scope=zh-CN','Only the Simplified Chinese draft reference scope is supported');
  const result=scopeArg?getTranslationDraftScopeWorklist(locale):getTranslationReviewWorklist(locale);
  const limArg=process.argv.find(arg=>arg.startsWith('--limit='));
  const limit=limArg?Number(limArg.split('=')[1]):30;
  assert(Number.isSafeInteger(limit)&&limit>=0&&limit<=canonicalEnglishTranslationKeys.length,'Invalid --limit');
  console.log(JSON.stringify(scopeArg
    ?{...result,items:result.items.slice(0,limit),work:result.work.slice(0,limit)}
    :{...result,work:result.work.slice(0,limit)},null,2));
}
