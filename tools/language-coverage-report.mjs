import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readmePath} from './readme-language-navigation.mjs';
import {expectedExtendedLocales,inspectExtendedLocaleSources} from './external-weig-locale-assets.mjs';

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
    return {code:lang.code,locale:lang.slug,name:lang.name,readme:file,readmeReady,overlayStatus};
  });
  assert.equal(records.length,61);
  assert.equal(records.filter(x=>x.overlayStatus==='bundled').length,11);
  assert.equal(records.filter(x=>x.overlayStatus==='english-baseline').length,2);
  assert.equal(records.filter(x=>['approved','draft','missing'].includes(x.overlayStatus)).length,overlays.expected);
  assert.equal(records.filter(x=>x.overlayStatus==='approved').length,overlays.ready);
  const docsReady=records.filter(x=>x.readmeReady).length;
  return {schemaVersion:1,source:'WeiG-official-locale-coverage',
    officialLanguages:records.length,readmes:{ready:docsReady,missing:records.length-docsReady},
    extendedOverlays:{expected:overlays.expected,approved:overlays.ready,draft:overlays.drafts.length,missing:overlays.expected-overlays.ready-overlays.drafts.length},
    records};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=languageCoverageReport();
  console.log(JSON.stringify(output, null, process.argv.includes('--details')?2:0));
}
