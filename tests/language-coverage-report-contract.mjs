import assert from 'node:assert/strict';
import {languageCoverageReport} from '../tools/language-coverage-report.mjs';
const report=languageCoverageReport();
assert.equal(report.schemaVersion,1);
assert.equal(report.officialLanguages,61);
assert.equal(report.readmes.ready+report.readmes.missing,61);
assert.ok(report.readmes.ready>=34,'Already translated README languages must not disappear');
assert.equal(report.extendedOverlays.expected,48);
const ledger=report.weiGUiKeyCoverage;
assert.equal(ledger.canonicalPerLocale,693);
assert.equal(ledger.expectedSlots,48*693);
assert.equal(ledger.supplied+ledger.reviewedEnglishFallback+ledger.unreviewed,ledger.expectedSlots);
assert.ok(ledger.supplied>=5979,'Previously supplied locale translations disappeared');
assert.ok(ledger.unreviewed>0,'Sparse draft locales must not appear fully reviewed');
const externalRecords=report.records.filter(item=>item.translationKeys!==null);
assert.equal(externalRecords.length,48);
assert.equal(externalRecords.reduce((n,item)=>n+item.translationKeys.supplied,0),ledger.supplied);
assert.equal(externalRecords.reduce((n,item)=>n+item.translationKeys.reviewedEnglishFallback,0),ledger.reviewedEnglishFallback);
assert.equal(externalRecords.reduce((n,item)=>n+item.translationKeys.unreviewed,0),ledger.unreviewed);
for(const record of externalRecords){
  assert.equal(record.translationKeys.supplied+record.translationKeys.reviewedEnglishFallback+
    record.translationKeys.unreviewed,ledger.canonicalPerLocale);
  assert.ok(['draft','approved','missing'].includes(record.overlayStatus));
}
assert.equal(report.extendedOverlays.approved+report.extendedOverlays.draft+report.extendedOverlays.missing,48);
assert.equal(report.records.find(item=>item.code==='zh_HK')?.overlayStatus,'bundled','Hong Kong overlay is part of standard product, not external pack');
assert.equal(report.records.find(item=>item.code==='en')?.readme,'README.md');
assert.equal(report.records.find(item=>item.code==='pt_BR')?.readmeReady,true);
assert.equal(report.records.find(item=>item.code==='sk')?.readmeReady,true,'Completed Slovak README must be retained');
assert.equal(report.records.find(item=>item.code==='hr')?.readmeReady,true,'Completed Croatian README must be retained');
assert.equal(report.records.find(item=>item.code==='ro')?.readmeReady,true,'Completed Romanian README must be retained');
assert.ok(['draft','approved'].includes(report.records.find(item=>item.code==='sk')?.overlayStatus),'Slovak external overlay must remain present through draft and approval');
assert.ok(report.extendedOverlays.approved+report.extendedOverlays.draft>=20,'Previously authored external locale sources must not disappear');
for(const code of ['hr','ro','sl'])assert.ok(['draft','approved'].includes(report.records.find(item=>item.code===code)?.overlayStatus),'Reviewed initial overlay missing for '+code);
for(const record of report.records){
  if(record.overlayStatus==='draft'||record.overlayStatus==='approved')assert.ok(record.locale,'External locale must have canonical slug');
}
console.log('Official locale progress contract passed:',JSON.stringify({readmes:report.readmes,extended:report.extendedOverlays}));
