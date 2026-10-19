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
const caScope=getTranslationDraftScopeWorklist('ca');
const beScope=getTranslationDraftScopeWorklist('be');
const csScope=getTranslationDraftScopeWorklist('cs');
const ukScope=getTranslationDraftScopeWorklist('uk');
const bgScope=getTranslationDraftScopeWorklist('bg');
const ptScope=getTranslationDraftScopeWorklist('pt-BR');
for(const scope of [roScope,slScope,caScope]){
  assert.equal(scope.referenceKeys,673,'Reference source contains 673 Simplified Chinese keys');
  assert.equal(scope.canonicalEnglishKeys,693,'Approval source must remain 693 English keys');
  assert.equal(scope.englishOnlyOutOfScope,20);
  assert.equal(scope.items.length,scope.referenceKeys);
  assert.equal(scope.counts.localized+scope.counts.intentional_english+
    scope.counts.qb_owned+scope.counts.unresolved,scope.referenceKeys);
  assert.equal(scope.unresolvedKeys,scope.work.length);
  assert.equal(scope.draftScopeComplete,scope.unresolvedKeys===0,'Draft scope is complete only when no items remain unresolved');
  assert.equal(scope.humanApproved,false,'Draft completion cannot imply mother-tongue approval');
  assert.ok(scope.work.every(x=>x.classification==='unresolved'&&x.translation===null));
}
assert.equal(roScope.counts.localized,664);
assert.equal(roScope.counts.intentional_english,9);
assert.equal(roScope.counts.qb_owned,0);
assert.equal(roScope.unresolvedKeys,0);
assert.equal(roScope.draftScopeComplete,true);
assert.equal(roScope.humanApproved,false,'Completed draft scope is not human approval');
assert.equal(slScope.counts.localized,666);
assert.equal(slScope.counts.intentional_english,7);
assert.equal(slScope.counts.qb_owned,0);
assert.equal(slScope.unresolvedKeys,0);
assert.equal(slScope.draftScopeComplete,true);
assert.equal(slScope.humanApproved,false,'Completed Slovenian draft does not imply native review');
assert.equal(caScope.counts.localized,45);
assert.equal(caScope.unresolvedKeys,628);
assert.equal(caScope.draftScopeComplete,false);
assert.equal(beScope.referenceKeys,673);
assert.equal(beScope.counts.localized,666);
assert.equal(beScope.counts.intentional_english,7);
assert.equal(beScope.unresolvedKeys,0);
assert.equal(beScope.draftScopeComplete,true);
assert.equal(beScope.humanApproved,false);
assert.equal(csScope.counts.localized,667);
assert.equal(csScope.counts.intentional_english,6);
assert.equal(csScope.unresolvedKeys,0);
assert.equal(csScope.draftScopeComplete,true);
assert.equal(csScope.humanApproved,false);
assert.equal(ukScope.counts.localized,668);
assert.equal(ukScope.counts.intentional_english,5);
assert.equal(ukScope.unresolvedKeys,0);
assert.equal(ukScope.draftScopeComplete,true);
assert.equal(ukScope.humanApproved,false);
assert.equal(bgScope.counts.localized,668);
assert.equal(bgScope.counts.intentional_english,5);
assert.equal(bgScope.unresolvedKeys,0);
assert.equal(bgScope.draftScopeComplete,true);
assert.equal(bgScope.humanApproved,false);
assert.equal(ptScope.counts.localized,659);
assert.equal(ptScope.counts.intentional_english,14);
assert.equal(ptScope.unresolvedKeys,0);
assert.equal(ptScope.draftScopeComplete,true);
assert.equal(ptScope.humanApproved,false);
const viScope=getTranslationDraftScopeWorklist('vi');
assert.equal(viScope.counts.localized,657);
assert.equal(viScope.counts.intentional_english,9);
assert.equal(viScope.counts.qb_owned,7);
assert.equal(viScope.unresolvedKeys,0);
assert.equal(viScope.draftScopeComplete,true);
assert.equal(viScope.humanApproved,false,'A complete Vietnamese draft is not native-language approval');
const thScope=getTranslationDraftScopeWorklist('th');
assert.equal(thScope.counts.localized,666);
assert.equal(thScope.counts.intentional_english,7);
assert.equal(thScope.counts.qb_owned,0);
assert.equal(thScope.unresolvedKeys,0);
assert.equal(thScope.draftScopeComplete,true);
assert.equal(thScope.humanApproved,false,'Completed Thai draft is not native reviewer approval');
const plScope=getTranslationDraftScopeWorklist('pl');
assert.equal(plScope.counts.localized,657);
assert.equal(plScope.counts.intentional_english,9);
assert.equal(plScope.counts.qb_owned,7);
assert.equal(plScope.unresolvedKeys,0);
assert.equal(plScope.draftScopeComplete,true);
assert.equal(plScope.humanApproved,false,'Full Polish draft scope cannot bypass mother-tongue review');
const skScope=getTranslationDraftScopeWorklist('sk');
assert.equal(skScope.counts.localized,657);
assert.equal(skScope.counts.intentional_english,9);
assert.equal(skScope.counts.qb_owned,7);
assert.equal(skScope.unresolvedKeys,0);
assert.equal(skScope.draftScopeComplete,true);
assert.equal(skScope.humanApproved,false,'Completed Slovak draft is not native reviewer approval');
const hrScope=getTranslationDraftScopeWorklist('hr');
assert.equal(hrScope.counts.localized,658);
assert.equal(hrScope.counts.intentional_english,8);
assert.equal(hrScope.counts.qb_owned,7);
assert.equal(hrScope.unresolvedKeys,0);
assert.equal(hrScope.draftScopeComplete,true);
assert.equal(hrScope.humanApproved,false,'Completed Croatian draft scope is not native approval');
const itScope=getTranslationDraftScopeWorklist('it');
assert.equal(itScope.counts.localized,651);
assert.equal(itScope.counts.intentional_english,15);
assert.equal(itScope.counts.qb_owned,7);
assert.equal(itScope.unresolvedKeys,0);
assert.equal(itScope.draftScopeComplete,true);
assert.equal(itScope.humanApproved,false,'Complete Italian draft scope does not imply native Approved');
const nlScope=getTranslationDraftScopeWorklist('nl');
assert.equal(nlScope.counts.localized,647);
assert.equal(nlScope.counts.intentional_english,25);
assert.equal(nlScope.counts.qb_owned,1);
assert.equal(nlScope.unresolvedKeys,0);
assert.equal(nlScope.draftScopeComplete,true);
assert.equal(nlScope.humanApproved,false,'Dutch full-scope draft is not native approval');
const svScope=getTranslationDraftScopeWorklist('sv');
assert.equal(svScope.counts.localized,650);
assert.equal(svScope.counts.intentional_english,16);
assert.equal(svScope.counts.qb_owned,7);
assert.equal(svScope.unresolvedKeys,0);
assert.equal(svScope.draftScopeComplete,true);
assert.equal(svScope.humanApproved,false,'Swedish full draft scope is not native approval');
const daScope=getTranslationDraftScopeWorklist('da');
assert.equal(daScope.counts.localized,642);
assert.equal(daScope.counts.intentional_english,24);
assert.equal(daScope.counts.qb_owned,7);
assert.equal(daScope.unresolvedKeys,0);
assert.equal(daScope.draftScopeComplete,true);
assert.equal(daScope.humanApproved,false,'Danish draft scope does not mean native approval');
const fiScope=getTranslationDraftScopeWorklist('fi');
assert.equal(fiScope.counts.localized,657);
assert.equal(fiScope.counts.intentional_english,9);
assert.equal(fiScope.counts.qb_owned,7);
assert.equal(fiScope.unresolvedKeys,0);
assert.equal(fiScope.draftScopeComplete,true);
assert.equal(fiScope.humanApproved,false,'Finnish draft is not native approval');
const nbScope=getTranslationDraftScopeWorklist('nb');
assert.equal(nbScope.counts.localized,651);
assert.equal(nbScope.counts.intentional_english,15);
assert.equal(nbScope.counts.qb_owned,7);
assert.equal(nbScope.unresolvedKeys,0);
assert.equal(nbScope.draftScopeComplete,true);
assert.equal(nbScope.humanApproved,false,'Norwegian Bokmål AI draft is not a native-speaker approval');
const bsScope=getTranslationDraftScopeWorklist('bs');
assert.equal(bsScope.counts.localized,658);
assert.equal(bsScope.counts.intentional_english,8);
assert.equal(bsScope.counts.qb_owned,7);
assert.equal(bsScope.unresolvedKeys,0);
assert.equal(bsScope.draftScopeComplete,true);
assert.equal(bsScope.humanApproved,false,'Bosnian AI draft is not native-language approval');
const srLatnScope=getTranslationDraftScopeWorklist('sr-Latn');
assert.equal(srLatnScope.referenceKeys,673);
assert.equal(srLatnScope.counts.localized,658);
assert.equal(srLatnScope.counts.intentional_english,8);
assert.equal(srLatnScope.counts.qb_owned,7);
assert.equal(srLatnScope.unresolvedKeys,0);
assert.equal(srLatnScope.draftScopeComplete,true);
assert.equal(srLatnScope.humanApproved,false,'Serbian Latin AI draft is not native-language approval');
const srCyrillicScope=getTranslationDraftScopeWorklist('sr');
assert.equal(srCyrillicScope.referenceKeys,673);
assert.equal(srCyrillicScope.counts.localized,658);
assert.equal(srCyrillicScope.counts.intentional_english,8);
assert.equal(srCyrillicScope.counts.qb_owned,7);
assert.equal(srCyrillicScope.unresolvedKeys,0);
assert.equal(srCyrillicScope.draftScopeComplete,true);
assert.equal(srCyrillicScope.humanApproved,false,'Serbian Cyrillic AI draft is not native-language approval');
const idScope=getTranslationDraftScopeWorklist('id');
assert.equal(idScope.referenceKeys,673);
assert.equal(idScope.counts.localized,659);
assert.equal(idScope.counts.intentional_english,13);
assert.equal(idScope.counts.qb_owned,1);
assert.equal(idScope.unresolvedKeys,0);
assert.equal(idScope.draftScopeComplete,true);
assert.equal(idScope.humanApproved,false,'Indonesian AI draft is not native-language approval');
const msMYScope=getTranslationDraftScopeWorklist('ms-MY');
assert.equal(msMYScope.referenceKeys,673);
assert.equal(msMYScope.counts.localized,652);
assert.equal(msMYScope.counts.intentional_english,14);
assert.equal(msMYScope.counts.qb_owned,7);
assert.equal(msMYScope.unresolvedKeys,0);
assert.equal(msMYScope.draftScopeComplete,true);
assert.equal(msMYScope.humanApproved,false,'Malay (Malaysia) AI draft is not native-language approval');
const turkishScope=getTranslationDraftScopeWorklist('tr');
assert.equal(turkishScope.referenceKeys,673);
assert.equal(turkishScope.counts.localized,662);
assert.equal(turkishScope.counts.intentional_english,11);
assert.equal(turkishScope.counts.qb_owned,0);
assert.equal(turkishScope.unresolvedKeys,0);
assert.equal(turkishScope.draftScopeComplete,true);
assert.equal(turkishScope.humanApproved,false,'Turkish AI draft is not native-language approval');
const azLatnScope=getTranslationDraftScopeWorklist('az-Latn');
assert.equal(azLatnScope.referenceKeys,673);
assert.equal(azLatnScope.counts.localized,662);
assert.equal(azLatnScope.counts.intentional_english,11);
assert.equal(azLatnScope.counts.qb_owned,0);
assert.equal(azLatnScope.unresolvedKeys,0);
assert.equal(azLatnScope.draftScopeComplete,true);
assert.equal(azLatnScope.humanApproved,false,'Azerbaijani Latin AI draft is not native-language approval');
const ltScope=getTranslationDraftScopeWorklist('lt');
assert.equal(ltScope.referenceKeys,673);
assert.equal(ltScope.counts.localized,658);
assert.equal(ltScope.counts.intentional_english,8);
assert.equal(ltScope.counts.qb_owned,7);
assert.equal(ltScope.unresolvedKeys,0);
assert.equal(ltScope.draftScopeComplete,true);
assert.equal(ltScope.humanApproved,false,'Lithuanian AI draft is not native-language approval');
const estonianScope=getTranslationDraftScopeWorklist('et');
assert.equal(estonianScope.referenceKeys,673);
assert.equal(estonianScope.counts.localized,657);
assert.equal(estonianScope.counts.intentional_english,9);
assert.equal(estonianScope.counts.qb_owned,7);
assert.equal(estonianScope.unresolvedKeys,0);
assert.equal(estonianScope.draftScopeComplete,true);
assert.equal(estonianScope.humanApproved,false,'Estonian AI draft is not native-language approval');
const hungarianScope=getTranslationDraftScopeWorklist('hu');
assert.equal(hungarianScope.referenceKeys,673);
assert.equal(hungarianScope.counts.localized,657);
assert.equal(hungarianScope.counts.intentional_english,9);
assert.equal(hungarianScope.counts.qb_owned,7);
assert.equal(hungarianScope.unresolvedKeys,0);
assert.equal(hungarianScope.draftScopeComplete,true);
assert.equal(hungarianScope.humanApproved,false,'Hungarian AI draft is not native-language approval');
const icelandicScope=getTranslationDraftScopeWorklist('is');
assert.equal(icelandicScope.referenceKeys,673);
assert.equal(icelandicScope.counts.localized,657);
assert.equal(icelandicScope.counts.intentional_english,9);
assert.equal(icelandicScope.counts.qb_owned,7);
assert.equal(icelandicScope.unresolvedKeys,0);
assert.equal(icelandicScope.draftScopeComplete,true);
assert.equal(icelandicScope.humanApproved,false,'Icelandic AI draft is not native-language approval');
const latvianScope=getTranslationDraftScopeWorklist('lv-LV');
assert.equal(latvianScope.referenceKeys,673);
assert.equal(latvianScope.counts.localized,658);
assert.equal(latvianScope.counts.intentional_english,8);
assert.equal(latvianScope.counts.qb_owned,7);
assert.equal(latvianScope.unresolvedKeys,0);
assert.equal(latvianScope.draftScopeComplete,true);
assert.equal(latvianScope.humanApproved,false,'Latvian AI draft is not native-language approval');
const galicianScope=getTranslationDraftScopeWorklist('gl');
assert.equal(galicianScope.referenceKeys,673);
assert.equal(galicianScope.counts.localized,649);
assert.equal(galicianScope.counts.intentional_english,17);
assert.equal(galicianScope.counts.qb_owned,7);
assert.equal(galicianScope.unresolvedKeys,0);
assert.equal(galicianScope.draftScopeComplete,true);
assert.equal(galicianScope.humanApproved,false,'Galician AI draft is not native-language approval');
const catalanScope=getTranslationDraftScopeWorklist('ca');
assert.equal(catalanScope.referenceKeys,673);
assert.equal(catalanScope.canonicalEnglishKeys,693);
assert.equal(catalanScope.counts.localized,641);
assert.equal(catalanScope.counts.intentional_english,25);
assert.equal(catalanScope.counts.qb_owned,7);
assert.equal(catalanScope.unresolvedKeys,0);
assert.equal(catalanScope.draftScopeComplete,true);
assert.equal(catalanScope.humanApproved,false,'Catalan AI draft is not mother-tongue approval');
const esperantoScope=getTranslationDraftScopeWorklist('eo');
assert.equal(esperantoScope.referenceKeys,673);
assert.equal(esperantoScope.canonicalEnglishKeys,693);
assert.equal(esperantoScope.counts.localized,658);
assert.equal(esperantoScope.counts.intentional_english,8);
assert.equal(esperantoScope.counts.qb_owned,7);
assert.equal(esperantoScope.unresolvedKeys,0);
assert.equal(esperantoScope.draftScopeComplete,true);
assert.equal(esperantoScope.humanApproved,false,'Esperanto AI draft is not mother-tongue approval');
const albanianScope=getTranslationDraftScopeWorklist('sq');
assert.equal(albanianScope.referenceKeys,673);
assert.equal(albanianScope.canonicalEnglishKeys,693);
assert.equal(albanianScope.counts.localized,655);
assert.equal(albanianScope.counts.intentional_english,11);
assert.equal(albanianScope.counts.qb_owned,7);
assert.equal(albanianScope.unresolvedKeys,0);
assert.equal(albanianScope.draftScopeComplete,true);
assert.equal(albanianScope.humanApproved,false,'Albanian AI draft is not mother-tongue approval');
const uzbekScope=getTranslationDraftScopeWorklist('uz-Latn');
assert.equal(uzbekScope.referenceKeys,673);
assert.equal(uzbekScope.canonicalEnglishKeys,693);
assert.equal(uzbekScope.counts.localized,657);
assert.equal(uzbekScope.counts.intentional_english,9);
assert.equal(uzbekScope.counts.qb_owned,7);
assert.equal(uzbekScope.unresolvedKeys,0);
assert.equal(uzbekScope.draftScopeComplete,true);
assert.equal(uzbekScope.humanApproved,false,'Uzbek AI draft is not native-language approval');
const hindiScope=getTranslationDraftScopeWorklist('hi-IN');
assert.equal(hindiScope.referenceKeys,673);
assert.equal(hindiScope.canonicalEnglishKeys,693);
assert.equal(hindiScope.counts.localized,657);
assert.equal(hindiScope.counts.intentional_english,9);
assert.equal(hindiScope.counts.qb_owned,7);
assert.equal(hindiScope.unresolvedKeys,0);
assert.equal(hindiScope.draftScopeComplete,true);
assert.equal(hindiScope.humanApproved,false,'Hindi AI draft is not native-language approval');
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(uzbekScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'The qBittorrent source must own torrent column '+field);
}
const caMissing=caScope.work.find(x=>x.key==='instances.currentSuffix');
const qbMissing=caScope.work.find(x=>x.key==='torrent.name');
assert.ok(caMissing&&qbMissing,'Synthetic decisions use genuinely missing Catalan draft keys');
const decisionsBase={schemaVersion:1,source:'WeiG-locale-draft-scope-decisions',
  locale:'ca',englishSourceSha256:canonicalEnglishSourceSha256,
  simplifiedChineseSourceSha256:simplifiedChineseReferenceSha256,decisions:{}};
const evidenced={...decisionsBase,decisions:{
  [caMissing.key]:{classification:'intentional_english',
    reason:'Synthetic test: preserve native technical label',
    evidence:'Synthetic UI terminology check, not an actual reviewer approval'},
  [qbMissing.key]:{classification:'qb_owned',
    reason:'Synthetic test: field caption handled by qB copy owner',
    evidence:'Synthetic runtime-owner fixture, not actual source verification',
    ownerFile:'webui/private/scripts/torrent-fields.js',
    caller:"qbText('column.'+key, sourceCaption)"}
}};
const classified=getTranslationDraftScopeWorklist('ca',{decisions:evidenced});
assert.equal(classified.counts.localized,45);
assert.equal(classified.counts.intentional_english,1);
assert.equal(classified.counts.qb_owned,1);
assert.equal(classified.unresolvedKeys,626);
assert.equal(classified.draftScopeComplete,false);
assert.equal(classified.humanApproved,false);
assert.equal(getTranslationReviewWorklist('ca').unreviewedKeys,648,
  'Draft scope decisions cannot edit the 693-key formal review ledger');
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...evidenced,englishSourceSha256:'stale'}}),/Stale English fingerprint/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...evidenced,simplifiedChineseSourceSha256:'stale'}}),/Stale Simplified Chinese fingerprint/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...evidenced,decisions:{'nav.rss':{classification:'intentional_english',
    reason:'Unrelated English-only field',evidence:'Synthetic out of scope'}}}}),
  /Non-reference key/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...evidenced,decisions:{'app.back':{classification:'intentional_english',
    reason:'Already translated in original Romanian',
    evidence:'Synthetic conflicting decision fixture'}}}}),/overlaps translated value/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...evidenced,decisions:{[caMissing.key]:{classification:'intentional_english',
    reason:'No actual supporting source',evidence:''}}}}),/verifiable evidence/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...evidenced,decisions:{[qbMissing.key]:{classification:'qb_owned',
    reason:'Unverified claimed qB label',
    evidence:'Synthetic missing caller / owner file'}}}}),/runtime owner file/);

console.log('Translation worklist passed: source-bound English and Simplified Chinese semantic reference, no fabricated approvals.');
