import assert from 'node:assert/strict';
import {getTranslationReviewWorklist} from '../tools/translation-review-worklist.mjs';
import {expectedExtendedLocales} from '../tools/external-weig-locale-assets.mjs';
const ca=getTranslationReviewWorklist('ca');
assert.equal(ca.schemaVersion,1);
assert.ok(['draft','approved'].includes(ca.status),'Previously authored Catalan source must remain available');
assert.equal(ca.canonicalKeys,693);
assert.ok(ca.suppliedKeys>=45,'Previously reviewed Catalan keys cannot disappear');
assert.equal(ca.unreviewedKeys,ca.canonicalKeys-ca.suppliedKeys-ca.reviewedEnglishFallbackCount);
assert.equal(ca.work.length,ca.unreviewedKeys);
assert.ok(ca.work.every(item=>typeof item.key==='string'&&typeof item.english==='string'));
const czech=getTranslationReviewWorklist('cs');
assert.ok(['draft','approved'].includes(czech.status));
assert.ok(czech.suppliedKeys>=568,'Czech reviewed translation entries were lost');
assert.equal(czech.unreviewedKeys,czech.canonicalKeys-czech.suppliedKeys-czech.reviewedEnglishFallbackCount);
const slovak=getTranslationReviewWorklist('sk');
assert.ok(['draft','approved'].includes(slovak.status),'Slovak must progress from draft to approved without breaking regression');
assert.ok(slovak.suppliedKeys>=45,'Previously reviewed Slovak keys cannot disappear');
assert.equal(slovak.unreviewedKeys,slovak.canonicalKeys-slovak.suppliedKeys-slovak.reviewedEnglishFallbackCount);
assert.equal(slovak.work.length,slovak.unreviewedKeys);
const missingLocale=expectedExtendedLocales.find(locale=>getTranslationReviewWorklist(locale).status==='missing');
if(missingLocale){
  const missing=getTranslationReviewWorklist(missingLocale);
  assert.equal(missing.status,'missing');
  assert.equal(missing.unreviewedKeys,missing.canonicalKeys);
}else{
  assert.ok(expectedExtendedLocales.every(locale=>getTranslationReviewWorklist(locale).status!=='missing'),
    'Once every extended source exists, no missing fixture is required');
}
assert.throws(()=>getTranslationReviewWorklist('zh-HK'),/Unknown or already bundled/);
assert.throws(()=>getTranslationReviewWorklist('en'),/Unknown or already bundled/);
console.log('Translation worklist passed: source-bound English and Simplified Chinese semantic reference, no fabricated approvals.');
