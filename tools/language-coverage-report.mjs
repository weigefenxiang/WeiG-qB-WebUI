import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readmePath} from './readme-language-navigation.mjs';
import {getTranslationDraftScopeWorklist} from './translation-review-worklist.mjs';
import {expectedExtendedLocales,inspectExtendedLocaleSources,canonicalEnglishTranslationKeys,rootOfExternalLocales,SOURCE_PRESERVED_UI_LABELS} from './external-weig-locale-assets.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
const simplifiedChinese=JSON.parse(fs.readFileSync(path.join(root,'webui/private/data/weig-i18n/zh-CN.json'),'utf8')).messages;
const referenceExceptions=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(simplifiedChinese,key));
const sourcePreserved=new Set(Object.keys(SOURCE_PRESERVED_UI_LABELS));
export function languageCoverageReport(){
  const overlays=inspectExtendedLocaleSources();
  const extended=new Set(expectedExtendedLocales);
  const drafts=new Set(overlays.drafts),missing=new Set(overlays.missing);
  const records=source.languages.map(lang=>{
    const file=readmePath(lang),readmeReady=fs.existsSync(path.join(root,file));
    const overlayStatus=extended.has(lang.slug)
      ? drafts.has(lang.slug)?'draft':missing.has(lang.slug)?'missing':'approved'
      : ['en_AU','en_GB'].includes(lang.code)?'english-baseline':'bundled';
    // Only external WeiG overlays contribute to the 693-key review ledger.
    // Bundled qB translations and English variants are intentionally excluded.
    const sourceFile=path.join(rootOfExternalLocales,lang.slug+'.json');
    const data=extended.has(lang.slug)&&fs.existsSync(sourceFile)
      ?JSON.parse(fs.readFileSync(sourceFile,'utf8')):null;
    const supplied=Object.keys(data?.messages||{}).length;
    const reviewedEnglishFallback=data?.reviewedEnglishFallbackKeys?.length||0;
    // Missing storage is NOT proof that the locale should use English.
    const translated=new Set(Object.keys(data?.messages||{}));
    const fallback=new Set(data?.reviewedEnglishFallbackKeys||[]);
    const outstanding=extended.has(lang.slug)
      ?canonicalEnglishTranslationKeys.filter(key=>!translated.has(key)&&!fallback.has(key)):[];
    const unreviewedByReference={
      withSimplifiedChinese:outstanding.filter(key=>Object.hasOwn(simplifiedChinese,key)).length,
      sourcePreservedEnglish:outstanding.filter(key=>sourcePreserved.has(key)).length,
      contextualEnglishOnly:outstanding.filter(key=>!Object.hasOwn(simplifiedChinese,key)&&!sourcePreserved.has(key)).length
    };
    assert.equal(Object.values(unreviewedByReference).reduce((a,b)=>a+b,0),outstanding.length);
    // Draft scope decisions are useful triage, not independently verified QA.
    const draftScope=extended.has(lang.slug)?getTranslationDraftScopeWorklist(lang.slug):null;
    const outstandingSet=new Set(outstanding);
    const pendingDraftDecisions={
      intentionalEnglishCandidate:0,qBOwnedCandidate:0,unclassifiedChineseReference:0,
      englishOnlyContext:unreviewedByReference.contextualEnglishOnly,
      sourcePreservedUnregistered:unreviewedByReference.sourcePreservedEnglish
    };
    for(const item of draftScope?.items||[]){
      if(!outstandingSet.has(item.key))continue;
      if(item.classification==='intentional_english')pendingDraftDecisions.intentionalEnglishCandidate++;
      else if(item.classification==='qb_owned')pendingDraftDecisions.qBOwnedCandidate++;
      else pendingDraftDecisions.unclassifiedChineseReference++;
    }
    if(extended.has(lang.slug))assert.equal(
      Object.values(pendingDraftDecisions).reduce((a,b)=>a+b,0),outstanding.length);
    const translationKeys=extended.has(lang.slug)?{
      supplied,reviewedEnglishFallback,unreviewed:outstanding.length,
      unreviewedByReference,pendingDraftDecisions}:null;
    return {code:lang.code,locale:lang.slug,name:lang.name,readme:file,readmeReady,overlayStatus,translationKeys};
  });
  assert.equal(records.length,61);
  assert.equal(records.filter(x=>x.overlayStatus==='bundled').length,11);
  assert.equal(records.filter(x=>x.overlayStatus==='english-baseline').length,2);
  assert.equal(records.filter(x=>['approved','draft','missing'].includes(x.overlayStatus)).length,overlays.expected);
  assert.equal(records.filter(x=>x.overlayStatus==='approved').length,overlays.ready);
  const docsReady=records.filter(x=>x.readmeReady).length;
  const external=records.filter(item=>item.translationKeys!==null);
  const supplied=external.reduce((n,item)=>n+item.translationKeys.supplied,0);
  const reviewedEnglishFallback=external.reduce((n,item)=>n+item.translationKeys.reviewedEnglishFallback,0);
  const unreviewed=external.reduce((n,item)=>n+item.translationKeys.unreviewed,0);
  const expectedSlots=overlays.expected*canonicalEnglishTranslationKeys.length;
  assert.equal(supplied,overlays.keys,'Coverage ledger and validated external sources disagree');
  assert.equal(supplied+reviewedEnglishFallback+unreviewed,expectedSlots);
  const unreviewedByReference={
    withSimplifiedChinese:external.reduce((n,item)=>n+item.translationKeys.unreviewedByReference.withSimplifiedChinese,0),
    sourcePreservedEnglish:external.reduce((n,item)=>n+item.translationKeys.unreviewedByReference.sourcePreservedEnglish,0),
    contextualEnglishOnly:external.reduce((n,item)=>n+item.translationKeys.unreviewedByReference.contextualEnglishOnly,0)
  };
  assert.equal(Object.values(unreviewedByReference).reduce((a,b)=>a+b,0),unreviewed);
  const pendingDraftDecisions={
    intentionalEnglishCandidate:0,qBOwnedCandidate:0,unclassifiedChineseReference:0,
    englishOnlyContext:0,sourcePreservedUnregistered:0
  };
  for(const item of external){
    for(const key of Object.keys(pendingDraftDecisions)){
      pendingDraftDecisions[key]+=item.translationKeys.pendingDraftDecisions[key];
    }
  }
  assert.equal(Object.values(pendingDraftDecisions).reduce((a,b)=>a+b,0),unreviewed);
  const referenceScope={canonicalEnglishKeys:canonicalEnglishTranslationKeys.length,
    simplifiedChineseKeys:Object.keys(simplifiedChinese).length,
    englishOnlyKeys:referenceExceptions.length,
    sourcePreservedEnglishOnly:referenceExceptions.filter(key=>sourcePreserved.has(key)).length,
    contextualEnglishOnly:referenceExceptions.filter(key=>!sourcePreserved.has(key)).length};
  const weiGUiKeyCoverage={canonicalPerLocale:canonicalEnglishTranslationKeys.length,
    expectedSlots,supplied,reviewedEnglishFallback,unreviewed,
    unreviewedByReference,pendingDraftDecisions};
  return {schemaVersion:1,source:'WeiG-official-locale-coverage',weiGUiKeyCoverage,referenceScope,
    officialLanguages:records.length,readmes:{ready:docsReady,missing:records.length-docsReady},
    extendedOverlays:{expected:overlays.expected,approved:overlays.ready,draft:overlays.drafts.length,missing:overlays.expected-overlays.ready-overlays.drafts.length},
    records};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=languageCoverageReport();
  console.log(JSON.stringify(output, null, process.argv.includes('--details')?2:0));
}
