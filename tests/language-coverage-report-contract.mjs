import assert from 'node:assert/strict';
import {languageCoverageReport} from '../tools/language-coverage-report.mjs';
const report=languageCoverageReport();
assert.equal(report.schemaVersion,1);
assert.equal(report.officialLanguages,61);
assert.equal(report.readmes.ready+report.readmes.missing,61);
assert.ok(report.readmes.ready>=34,'Already translated README languages must not disappear');
assert.equal(report.extendedOverlays.expected,48);
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
