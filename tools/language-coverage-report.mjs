import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readmePath} from './readme-language-navigation.mjs';
import {expectedExtendedLocales,inspectExtendedLocaleSources,canonicalEnglishTranslationKeys,rootOfExternalLocales} from './external-weig-locale-assets.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
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
    const translationKeys=extended.has(lang.slug)?{
      supplied,reviewedEnglishFallback,
      unreviewed:canonicalEnglishTranslationKeys.length-supplied-reviewedEnglishFallback}:null;
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
  const weiGUiKeyCoverage={canonicalPerLocale:canonicalEnglishTranslationKeys.length,
    expectedSlots,supplied,reviewedEnglishFallback,unreviewed};
  return {schemaVersion:1,source:'WeiG-official-locale-coverage',weiGUiKeyCoverage,
    officialLanguages:records.length,readmes:{ready:docsReady,missing:records.length-docsReady},
    extendedOverlays:{expected:overlays.expected,approved:overlays.ready,draft:overlays.drafts.length,missing:overlays.expected-overlays.ready-overlays.drafts.length},
    records};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=languageCoverageReport();
  console.log(JSON.stringify(output, null, process.argv.includes('--details')?2:0));
}
