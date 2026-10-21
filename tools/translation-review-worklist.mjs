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

// Full review is deliberately not an approval action. A draft can have every
// canonical key accounted for and still require per-message semantic review.
let staticCallerCandidateCache;
function getStaticCallerCandidates(){
  if(staticCallerCandidateCache)return staticCallerCandidateCache;
  const index=new Map(canonicalEnglishTranslationKeys.map(key=>[key,[]]));
  const dir=path.join(root,'webui/private/scripts');
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.js')||entry.name==='i18n.js')continue;
    const filename=path.join(dir,entry.name);
    if(fs.statSync(filename).size>1000000)continue;
    const file='webui/private/scripts/'+entry.name;
    const content=fs.readFileSync(filename,'utf8');
    // A local tr() wrapper can prepend a proven namespace to short keys.
    // Detect the exact literal I18n owner expression, never infer a prefix
    // from filenames or UI feature names.
    const wrapper=/function\s+tr\s*\(\s*key(?:\s*,[^)]*)?\)\s*\{\s*return\s+W\.I18n&&W\.I18n\.t\?W\.I18n\.t\(\s*(['"])([A-Za-z0-9_-]+\.)\1\s*\+\s*key\b/u.exec(content);
    const scopedPrefix=wrapper?wrapper[2]:null;
    const lines=content.split(/\r?\n/u);
    for(let i=0;i<lines.length;i++){
      // A literal reference is a caller *candidate*, never a verified UI owner.
      const literals=/(['"])([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)\1/gu;
      for(const match of lines[i].matchAll(literals)){
        const owners=index.get(match[2]);
        if(!owners||owners.length>=12)continue;
        if(!owners.some(item=>item.file===file&&item.line===i+1)){
          owners.push({file,line:i+1,evidence:'static-literal-candidate-not-verified'});
        }
      }
      if(scopedPrefix){
        // tr('importHint') -> instances.importHint, only when the wrapper
        // visibly calls W.I18n.t('instances.'+key,vars) in this same file.
        for(const match of lines[i].matchAll(/\btr\(\s*(['"])([A-Za-z0-9_-]+)\1/gu)){
          const owners=index.get(scopedPrefix+match[2]);
          if(!owners||owners.length>=12)continue;
          if(!owners.some(item=>item.file===file&&item.line===i+1)){
            owners.push({file,line:i+1,evidence:'static-scoped-wrapper-candidate-not-verified'});
          }
        }
      }
    }
  }
  // A78-296: capability dialogs construct `capability.<feature>.<part>`
  // from a real feature registry id. A bare literal grep cannot see these
  // runtime-consumed keys, so connect them to the precise source registry
  // without EVER promoting a source candidate to semantic QA approval.
  const capabilityFile='webui/private/scripts/capabilities.js';
  const capabilityContent=fs.readFileSync(path.join(root,capabilityFile),'utf8');
  const dynamicFeatureKey="var key='capability.'+String(id||'')+'.'+String(part||'')";
  if(capabilityContent.includes(dynamicFeatureKey)&&
     capabilityContent.includes("featureCopy(id,'title'")&&
     capabilityContent.includes("featureCopy(id,'reason'")){
    const registryPath=path.join(root,'webui/private/data/capabilities.json');
    const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
    assert(registry.schemaVersion===2&&registry.features&&
      typeof registry.features==='object'&&!Array.isArray(registry.features),
      'Invalid source feature registry for translation caller candidates');
    const line=capabilityContent.slice(0,capabilityContent.indexOf(dynamicFeatureKey)).split(/\\r?\
/u).length;
    for(const id of Object.keys(registry.features)){
      for(const part of ['title','reason']){
        const key='capability.'+id+'.'+part,owners=index.get(key);
        if(!owners||owners.some(item=>item.file===capabilityFile&&item.line===line))continue;
        owners.push({file:capabilityFile,line,registry:'webui/private/data/capabilities.json',
          featureId:id,evidence:'static-feature-registry-candidate-not-verified'});
      }
    }
  }
  // Declarative HTML bindings are genuine static UI reference candidates,
  // even though a JS-only scan cannot see them. Still NOT semantic QA proof.
  const htmlPath=path.join(root,'webui/private/index.html');
  const htmlLines=fs.readFileSync(htmlPath,'utf8').split(/\r?\n/u);
  for(let i=0;i<htmlLines.length;i++){
    const attributes=/\bdata-i18n(?:-[a-z-]+)?\s*=\s*(['"])([A-Za-z0-9_.-]+)\1/gu;
    for(const match of htmlLines[i].matchAll(attributes)){
      const owners=index.get(match[2]);
      if(!owners||owners.length>=12)continue;
      if(!owners.some(item=>item.file==='webui/private/index.html'&&item.line===i+1)){
        owners.push({file:'webui/private/index.html',line:i+1,
          evidence:'static-html-attribute-candidate-not-verified'});
      }
    }
  }
  staticCallerCandidateCache=index;
  return index;
}
export function getTranslationFullQualityWorklist(locale){
  assert(known.has(locale),'Unknown or already bundled external locale: '+locale);
  const filename=path.join(rootOfExternalLocales,locale+'.json');
  const data=fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):null;
  if(data)validateExternalOverlay(locale,data);
  const messages=data?.messages||{};
  const formalFallback=new Set(data?.reviewedEnglishFallbackKeys||[]);
  const scope=getTranslationDraftScopeWorklist(locale);
  const scopeItems=new Map(scope.items.map(item=>[item.key,item]));
  const callers=getStaticCallerCandidates();
  const counts={translated:0,reviewedEnglishFallback:0,unreviewedEnglishFallback:0,withoutStaticCallerCandidate:0};
  const items=canonicalEnglishTranslationKeys.map(key=>{
    const exists=Object.hasOwn(messages,key),reviewed=formalFallback.has(key);
    const disposition=exists?'translated':reviewed?'reviewed_english_fallback':'unreviewed_english_fallback';
    if(exists)counts.translated++;
    else if(reviewed)counts.reviewedEnglishFallback++;
    else counts.unreviewedEnglishFallback++;
    const candidates=callers.get(key)||[];
    if(!candidates.length)counts.withoutStaticCallerCandidate++;
    const draftScope=scopeItems.get(key);
    return {key,english:english[key],
      simplifiedChinese:Object.hasOwn(chinese.messages,key)?chinese.messages[key]:null,
      translation:exists?messages[key]:null,disposition,
      draftScopeClassification:draftScope?.classification||'out_of_zh_cn_draft_scope',
      ...(draftScope?.reason?{draftScopeReason:draftScope.reason}:{}),
      callerCandidates:candidates,
      placeholders:[...String(english[key]).matchAll(/\{([^{}]+)\}/gu)].map(m=>m[1]),
      semanticAndIndependentReview:'pending'};
  });
  assert.equal(items.length,canonicalEnglishTranslationKeys.length);
  assert.equal(counts.translated+counts.reviewedEnglishFallback+counts.unreviewedEnglishFallback,items.length);
  return {schemaVersion:1,source:'WeiG-translation-full-quality-worklist',
    locale,translationStatus:data?.translationStatus||'missing',
    englishSourceSha256:canonicalEnglishSourceSha256,canonicalKeys:items.length,
    counts,independentErrorReviewRecorded:false,
    // A source lookup only generates candidates, not confirmed caller/owner proof.
    staticCallerEvidence:'candidate-only',
    items};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const localeArg=process.argv.find(arg=>arg.startsWith('--locale='));
  assert(localeArg,'Usage: node tools/translation-review-worklist.mjs --locale=ca [--limit=30]');
  const locale=localeArg.slice('--locale='.length);
  const scopeArg=process.argv.find(arg=>arg.startsWith('--scope='));
  assert(!scopeArg||scopeArg==='--scope=zh-CN','Only the Simplified Chinese draft reference scope is supported');
  const fullArg=process.argv.includes('--full');
  assert(!(fullArg&&scopeArg),'--full and --scope are mutually exclusive');
  const result=fullArg?getTranslationFullQualityWorklist(locale):scopeArg?getTranslationDraftScopeWorklist(locale):getTranslationReviewWorklist(locale);
  const limArg=process.argv.find(arg=>arg.startsWith('--limit='));
  const limit=limArg?Number(limArg.split('=')[1]):30;
  assert(Number.isSafeInteger(limit)&&limit>=0&&limit<=canonicalEnglishTranslationKeys.length,'Invalid --limit');
  console.log(JSON.stringify(fullArg
    ?{...result,items:result.items.slice(0,limit)}
    :scopeArg?{...result,items:result.items.slice(0,limit),work:result.work.slice(0,limit)}
    :{...result,work:result.work.slice(0,limit)},null,2));
}
