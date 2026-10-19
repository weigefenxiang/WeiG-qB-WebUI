import assert from 'node:assert/strict';
import {getTranslationReviewWorklist,getTranslationDraftScopeWorklist,simplifiedChineseReferenceSha256} from '../tools/translation-review-worklist.mjs';
import {canonicalEnglishSourceSha256} from '../tools/external-weig-locale-assets.mjs';
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
assert.ok(czech.suppliedKeys>=625,'Czech reviewed translation entries were lost');
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

const roScope=getTranslationDraftScopeWorklist('ro');
const slScope=getTranslationDraftScopeWorklist('sl');
for(const scope of [roScope,slScope]){
  assert.equal(scope.referenceKeys,673,'Reference source contains 673 Simplified Chinese keys');
  assert.equal(scope.canonicalEnglishKeys,693,'Approval source must remain 693 English keys');
  assert.equal(scope.englishOnlyOutOfScope,20);
  assert.equal(scope.items.length,scope.referenceKeys);
  assert.equal(scope.counts.localized+scope.counts.intentional_english+
    scope.counts.qb_owned+scope.counts.unresolved,scope.referenceKeys);
  assert.equal(scope.unresolvedKeys,scope.work.length);
  assert.equal(scope.draftScopeComplete,false,'Partially translated source cannot claim complete scope');
  assert.equal(scope.humanApproved,false,'Draft completion cannot imply mother-tongue approval');
  assert.ok(scope.work.every(x=>x.classification==='unresolved'&&x.translation===null));
}
assert.equal(roScope.counts.localized,150);
assert.equal(roScope.unresolvedKeys,523);
assert.equal(slScope.counts.localized,152);
assert.equal(slScope.unresolvedKeys,521);
const roMissing=roScope.work.find(x=>x.key==='instances.currentSuffix');
const qbMissing=roScope.work.find(x=>x.key==='torrent.name');
assert.ok(roMissing&&qbMissing,'Semantic test keys must be absent from the Romanian source');
const decisionsBase={schemaVersion:1,source:'WeiG-locale-draft-scope-decisions',
  locale:'ro',englishSourceSha256:canonicalEnglishSourceSha256,
  simplifiedChineseSourceSha256,decisions:{}};
const evidenced={...decisionsBase,decisions:{
  [roMissing.key]:{classification:'intentional_english',
    reason:'Synthetic test: preserve native technical label',
    evidence:'Synthetic UI terminology check, not an actual reviewer approval'},
  [qbMissing.key]:{classification:'qb_owned',
    reason:'Synthetic test: field caption handled by qB copy owner',
    evidence:'Synthetic runtime-owner fixture, not actual source verification',
    ownerFile:'webui/private/scripts/torrent-fields.js',
    caller:"qbText('column.'+key, sourceCaption)"}
}};
const classified=getTranslationDraftScopeWorklist('ro',{decisions:evidenced});
assert.equal(classified.counts.localized,150);
assert.equal(classified.counts.intentional_english,1);
assert.equal(classified.counts.qb_owned,1);
assert.equal(classified.unresolvedKeys,521);
assert.equal(classified.draftScopeComplete,false);
assert.equal(classified.humanApproved,false);
assert.equal(getTranslationReviewWorklist('ro').unreviewedKeys,543,
  'Draft scope decisions cannot edit the 693-key formal review ledger');
assert.throws(()=>getTranslationDraftScopeWorklist('ro',{decisions:{
  ...evidenced,englishSourceSha256:'stale'}}),/Stale English fingerprint/);
assert.throws(()=>getTranslationDraftScopeWorklist('ro',{decisions:{
  ...evidenced,simplifiedChineseSourceSha256:'stale'}}),/Stale Simplified Chinese fingerprint/);
assert.throws(()=>getTranslationDraftScopeWorklist('ro',{decisions:{
  ...evidenced,decisions:{'nav.rss':{classification:'intentional_english',
    reason:'Unrelated English-only field',evidence:'Synthetic out of scope'}}}}),
  /Non-reference key/);
assert.throws(()=>getTranslationDraftScopeWorklist('ro',{decisions:{
  ...evidenced,decisions:{'app.back':{classification:'intentional_english',
    reason:'Already translated in original Romanian',
    evidence:'Synthetic conflicting decision fixture'}}}}),/overlaps translated value/);
assert.throws(()=>getTranslationDraftScopeWorklist('ro',{decisions:{
  ...evidenced,decisions:{[roMissing.key]:{classification:'intentional_english',
    reason:'No actual supporting source',evidence:''}}}}),/verifiable evidence/);
assert.throws(()=>getTranslationDraftScopeWorklist('ro',{decisions:{
  ...evidenced,decisions:{[qbMissing.key]:{classification:'qb_owned',
    reason:'Unverified claimed qB label',
    evidence:'Synthetic missing caller / owner file'}}}}),/runtime owner file/);

console.log('Translation worklist passed: source-bound English and Simplified Chinese semantic reference, no fabricated approvals.');
