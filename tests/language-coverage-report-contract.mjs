import assert from 'node:assert/strict';
import {languageCoverageReport} from '../tools/language-coverage-report.mjs';
const report=languageCoverageReport();
assert.equal(report.schemaVersion,1);
assert.equal(report.officialLanguages,61);
assert.equal(report.readmes.ready+report.readmes.missing,61);
assert.equal(report.readmes.missing,0,'Completed official README coverage must not regress');
assert.equal(report.readmes.ready,61,'Every official README must exist after A78 documentation completion');
assert.equal(report.extendedOverlays.expected,48);
assert.equal(report.extendedOverlays.missing,0,'All 48 external language source files must remain present');
const ledger=report.weiGUiKeyCoverage;
assert.equal(ledger.canonicalPerLocale,693);
assert.equal(ledger.expectedSlots,48*693);
assert.equal(ledger.supplied+ledger.reviewedEnglishFallback+ledger.unreviewed,ledger.expectedSlots);
assert.ok(ledger.supplied>=6605,'A78-160 cumulative external UI translations must not regress');
assert.ok(ledger.unreviewed>=0,'Unreviewed WeiG UI message count cannot be negative');
// A fully translated draft can have zero unreviewed keys, and all approved locales must.
// Do not make the valid fully reviewed distribution impossible to validate.
if(report.extendedOverlays.approved===report.extendedOverlays.expected){
  assert.equal(ledger.unreviewed,0,'Every approved external locale must have accounted for all canonical WeiG messages');
}
const externalRecords=report.records.filter(item=>item.translationKeys!==null);
assert.equal(externalRecords.length,48);
for(const [locale,min] of [['be',677],['cs',678],['uk',680],['bg',680],['pt-BR',671],['oc',127],['eu',151],['hy',135],['ka',135],['kk',135],['mn_MN',135],['ltg',93],['th',669],['vi',657],['it',651],['nl',649],['ms-MY',168],['nb',149],['sv',650],['da',642],['pl',657],['fi',657],['ro',664],['sk',657],['hr',658],['sl',666]]){
  const record=externalRecords.find(item=>item.locale===locale||item.locale===locale.replace('_','-'));
  assert.ok(record,'Missing official language progress record for '+locale);
  assert.ok(record.translationKeys.supplied>=min,'Previously supplied translations for '+locale+' must not disappear');
}
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
