import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getTranslationFullQualityWorklist,getTranslationSharedCallerCandidates,getTranslationReviewWorklist,getTranslationDraftScopeWorklist,simplifiedChineseReferenceSha256} from '../tools/translation-review-worklist.mjs';
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
  assert.equal(scope.distributionApproved,scope.status==='approved','Distribution approval must follow the source status only');
  assert.equal(Object.hasOwn(scope,'humanApproved'),false,'Native-speaker approval must not be inferred from distribution status');
  assert.equal(scope.distributionApproved,false,'Draft scope must not imply distribution approval: scope');
  assert.ok(scope.work.every(x=>x.classification==='unresolved'&&x.translation===null));
}
assert.equal(roScope.counts.localized,663);
assert.equal(roScope.counts.intentional_english,10);
assert.equal(roScope.counts.qb_owned,0);
assert.equal(roScope.unresolvedKeys,0);
assert.equal(roScope.draftScopeComplete,true);
assert.equal(roScope.distributionApproved,false,'Draft scope must not imply distribution approval: roScope');
assert.equal(slScope.counts.localized,665);
assert.equal(slScope.counts.intentional_english,8);
assert.equal(slScope.counts.qb_owned,0);
assert.equal(slScope.unresolvedKeys,0);
assert.equal(slScope.draftScopeComplete,true);
assert.equal(slScope.distributionApproved,false,'Draft scope must not imply distribution approval: slScope');
// Catalan A78-223 completed the 673-key AI draft. The older 45-key
// bootstrap fixture must not outlive the actual shipped language pack.
assert.equal(caScope.counts.localized,642);
assert.equal(caScope.counts.localized,ca.suppliedKeys);
assert.equal(caScope.counts.intentional_english,24);
assert.equal(caScope.counts.qb_owned,7);
assert.equal(caScope.unresolvedKeys,0);
assert.equal(caScope.draftScopeComplete,true);
assert.equal(caScope.distributionApproved,false,'Draft scope must not imply distribution approval: caScope');
assert.equal(beScope.referenceKeys,673);
assert.equal(beScope.counts.localized,666);
assert.equal(beScope.counts.intentional_english,7);
assert.equal(beScope.unresolvedKeys,0);
assert.equal(beScope.draftScopeComplete,true);
assert.equal(beScope.distributionApproved,false,'Draft scope must not imply distribution approval: beScope');
assert.equal(csScope.counts.localized,666);
assert.equal(csScope.counts.intentional_english,7);
assert.equal(csScope.unresolvedKeys,0);
assert.equal(csScope.draftScopeComplete,true);
assert.equal(csScope.distributionApproved,false,'Draft scope must not imply distribution approval: csScope');
assert.equal(ukScope.counts.localized,668);
assert.equal(ukScope.counts.intentional_english,5);
assert.equal(ukScope.unresolvedKeys,0);
assert.equal(ukScope.draftScopeComplete,true);
assert.equal(ukScope.distributionApproved,false,'Draft scope must not imply distribution approval: ukScope');
assert.equal(bgScope.counts.localized,668);
assert.equal(bgScope.counts.intentional_english,5);
assert.equal(bgScope.unresolvedKeys,0);
assert.equal(bgScope.draftScopeComplete,true);
assert.equal(bgScope.distributionApproved,false,'Draft scope must not imply distribution approval: bgScope');
assert.equal(ptScope.counts.localized,657);
assert.equal(ptScope.counts.intentional_english,16);
assert.equal(ptScope.unresolvedKeys,0);
assert.equal(ptScope.draftScopeComplete,true);
assert.equal(ptScope.distributionApproved,false,'Draft scope must not imply distribution approval: ptScope');
const viScope=getTranslationDraftScopeWorklist('vi');
assert.equal(viScope.counts.localized,657);
assert.equal(viScope.counts.intentional_english,9);
assert.equal(viScope.counts.qb_owned,7);
assert.equal(viScope.unresolvedKeys,0);
assert.equal(viScope.draftScopeComplete,true);
assert.equal(viScope.distributionApproved,false,'Draft scope must not imply distribution approval: viScope');
const thScope=getTranslationDraftScopeWorklist('th');
assert.equal(thScope.counts.localized,666);
assert.equal(thScope.counts.intentional_english,7);
assert.equal(thScope.counts.qb_owned,0);
assert.equal(thScope.unresolvedKeys,0);
assert.equal(thScope.draftScopeComplete,true);
assert.equal(thScope.distributionApproved,false,'Draft scope must not imply distribution approval: thScope');
const plScope=getTranslationDraftScopeWorklist('pl');
assert.equal(plScope.counts.localized,657);
assert.equal(plScope.counts.intentional_english,9);
assert.equal(plScope.counts.qb_owned,7);
assert.equal(plScope.unresolvedKeys,0);
assert.equal(plScope.draftScopeComplete,true);
assert.equal(plScope.distributionApproved,false,'Draft scope must not imply distribution approval: plScope');
const skScope=getTranslationDraftScopeWorklist('sk');
assert.equal(skScope.counts.localized,657);
assert.equal(skScope.counts.intentional_english,9);
assert.equal(skScope.counts.qb_owned,7);
assert.equal(skScope.unresolvedKeys,0);
assert.equal(skScope.draftScopeComplete,true);
assert.equal(skScope.distributionApproved,false,'Draft scope must not imply distribution approval: skScope');
const hrScope=getTranslationDraftScopeWorklist('hr');
assert.equal(hrScope.counts.localized,658);
assert.equal(hrScope.counts.intentional_english,8);
assert.equal(hrScope.counts.qb_owned,7);
assert.equal(hrScope.unresolvedKeys,0);
assert.equal(hrScope.draftScopeComplete,true);
assert.equal(hrScope.distributionApproved,false,'Draft scope must not imply distribution approval: hrScope');
const itScope=getTranslationDraftScopeWorklist('it');
assert.equal(itScope.counts.localized,651);
assert.equal(itScope.counts.intentional_english,15);
assert.equal(itScope.counts.qb_owned,7);
assert.equal(itScope.unresolvedKeys,0);
assert.equal(itScope.draftScopeComplete,true);
assert.equal(itScope.distributionApproved,false,'Draft scope must not imply distribution approval: itScope');
const nlScope=getTranslationDraftScopeWorklist('nl');
assert.equal(nlScope.counts.localized,648);
assert.equal(nlScope.counts.intentional_english,24);
assert.equal(nlScope.counts.qb_owned,1);
assert.equal(nlScope.unresolvedKeys,0);
assert.equal(nlScope.draftScopeComplete,true);
assert.equal(nlScope.distributionApproved,false,'Draft scope must not imply distribution approval: nlScope');
const svScope=getTranslationDraftScopeWorklist('sv');
assert.equal(svScope.counts.localized,650);
assert.equal(svScope.counts.intentional_english,16);
assert.equal(svScope.counts.qb_owned,7);
assert.equal(svScope.unresolvedKeys,0);
assert.equal(svScope.draftScopeComplete,true);
assert.equal(svScope.distributionApproved,false,'Draft scope must not imply distribution approval: svScope');
const daScope=getTranslationDraftScopeWorklist('da');
assert.equal(daScope.counts.localized,642);
assert.equal(daScope.counts.intentional_english,24);
assert.equal(daScope.counts.qb_owned,7);
assert.equal(daScope.unresolvedKeys,0);
assert.equal(daScope.draftScopeComplete,true);
assert.equal(daScope.distributionApproved,false,'Draft scope must not imply distribution approval: daScope');
const fiScope=getTranslationDraftScopeWorklist('fi');
assert.equal(fiScope.counts.localized,657);
assert.equal(fiScope.counts.intentional_english,9);
assert.equal(fiScope.counts.qb_owned,7);
assert.equal(fiScope.unresolvedKeys,0);
assert.equal(fiScope.draftScopeComplete,true);
assert.equal(fiScope.distributionApproved,false,'Draft scope must not imply distribution approval: fiScope');
const nbScope=getTranslationDraftScopeWorklist('nb');
assert.equal(nbScope.counts.localized,651);
assert.equal(nbScope.counts.intentional_english,15);
assert.equal(nbScope.counts.qb_owned,7);
assert.equal(nbScope.unresolvedKeys,0);
assert.equal(nbScope.draftScopeComplete,true);
assert.equal(nbScope.distributionApproved,false,'Draft scope must not imply distribution approval: nbScope');
const bsScope=getTranslationDraftScopeWorklist('bs');
assert.equal(bsScope.counts.localized,658);
assert.equal(bsScope.counts.intentional_english,8);
assert.equal(bsScope.counts.qb_owned,7);
assert.equal(bsScope.unresolvedKeys,0);
assert.equal(bsScope.draftScopeComplete,true);
assert.equal(bsScope.distributionApproved,false,'Draft scope must not imply distribution approval: bsScope');
const srLatnScope=getTranslationDraftScopeWorklist('sr-Latn');
assert.equal(srLatnScope.referenceKeys,673);
assert.equal(srLatnScope.counts.localized,658);
assert.equal(srLatnScope.counts.intentional_english,8);
assert.equal(srLatnScope.counts.qb_owned,7);
assert.equal(srLatnScope.unresolvedKeys,0);
assert.equal(srLatnScope.draftScopeComplete,true);
assert.equal(srLatnScope.distributionApproved,false,'Draft scope must not imply distribution approval: srLatnScope');
const srCyrillicScope=getTranslationDraftScopeWorklist('sr');
assert.equal(srCyrillicScope.referenceKeys,673);
assert.equal(srCyrillicScope.counts.localized,658);
assert.equal(srCyrillicScope.counts.intentional_english,8);
assert.equal(srCyrillicScope.counts.qb_owned,7);
assert.equal(srCyrillicScope.unresolvedKeys,0);
assert.equal(srCyrillicScope.draftScopeComplete,true);
assert.equal(srCyrillicScope.distributionApproved,false,'Draft scope must not imply distribution approval: srCyrillicScope');
const idScope=getTranslationDraftScopeWorklist('id');
assert.equal(idScope.referenceKeys,673);
assert.equal(idScope.counts.localized,659);
assert.equal(idScope.counts.intentional_english,13);
assert.equal(idScope.counts.qb_owned,1);
assert.equal(idScope.unresolvedKeys,0);
assert.equal(idScope.draftScopeComplete,true);
assert.equal(idScope.distributionApproved,false,'Draft scope must not imply distribution approval: idScope');
const msMYScope=getTranslationDraftScopeWorklist('ms-MY');
assert.equal(msMYScope.referenceKeys,673);
assert.equal(msMYScope.counts.localized,652);
assert.equal(msMYScope.counts.intentional_english,14);
assert.equal(msMYScope.counts.qb_owned,7);
assert.equal(msMYScope.unresolvedKeys,0);
assert.equal(msMYScope.draftScopeComplete,true);
assert.equal(msMYScope.distributionApproved,false,'Draft scope must not imply distribution approval: msMYScope');
const turkishScope=getTranslationDraftScopeWorklist('tr');
assert.equal(turkishScope.referenceKeys,673);
assert.equal(turkishScope.counts.localized,662);
assert.equal(turkishScope.counts.intentional_english,11);
assert.equal(turkishScope.counts.qb_owned,0);
assert.equal(turkishScope.unresolvedKeys,0);
assert.equal(turkishScope.draftScopeComplete,true);
assert.equal(turkishScope.distributionApproved,false,'Draft scope must not imply distribution approval: turkishScope');
const azLatnScope=getTranslationDraftScopeWorklist('az-Latn');
assert.equal(azLatnScope.referenceKeys,673);
assert.equal(azLatnScope.counts.localized,662);
assert.equal(azLatnScope.counts.intentional_english,11);
assert.equal(azLatnScope.counts.qb_owned,0);
assert.equal(azLatnScope.unresolvedKeys,0);
assert.equal(azLatnScope.draftScopeComplete,true);
assert.equal(azLatnScope.distributionApproved,false,'Draft scope must not imply distribution approval: azLatnScope');
const ltScope=getTranslationDraftScopeWorklist('lt');
assert.equal(ltScope.referenceKeys,673);
assert.equal(ltScope.counts.localized,658);
assert.equal(ltScope.counts.intentional_english,8);
assert.equal(ltScope.counts.qb_owned,7);
assert.equal(ltScope.unresolvedKeys,0);
assert.equal(ltScope.draftScopeComplete,true);
assert.equal(ltScope.distributionApproved,false,'Draft scope must not imply distribution approval: ltScope');
const estonianScope=getTranslationDraftScopeWorklist('et');
assert.equal(estonianScope.referenceKeys,673);
assert.equal(estonianScope.counts.localized,657);
assert.equal(estonianScope.counts.intentional_english,9);
assert.equal(estonianScope.counts.qb_owned,7);
assert.equal(estonianScope.unresolvedKeys,0);
assert.equal(estonianScope.draftScopeComplete,true);
assert.equal(estonianScope.distributionApproved,false,'Draft scope must not imply distribution approval: estonianScope');
const hungarianScope=getTranslationDraftScopeWorklist('hu');
assert.equal(hungarianScope.referenceKeys,673);
assert.equal(hungarianScope.counts.localized,657);
assert.equal(hungarianScope.counts.intentional_english,9);
assert.equal(hungarianScope.counts.qb_owned,7);
assert.equal(hungarianScope.unresolvedKeys,0);
assert.equal(hungarianScope.draftScopeComplete,true);
assert.equal(hungarianScope.distributionApproved,false,'Draft scope must not imply distribution approval: hungarianScope');
const icelandicScope=getTranslationDraftScopeWorklist('is');
assert.equal(icelandicScope.referenceKeys,673);
assert.equal(icelandicScope.counts.localized,657);
assert.equal(icelandicScope.counts.intentional_english,9);
assert.equal(icelandicScope.counts.qb_owned,7);
assert.equal(icelandicScope.unresolvedKeys,0);
assert.equal(icelandicScope.draftScopeComplete,true);
assert.equal(icelandicScope.distributionApproved,false,'Draft scope must not imply distribution approval: icelandicScope');
const latvianScope=getTranslationDraftScopeWorklist('lv-LV');
assert.equal(latvianScope.referenceKeys,673);
assert.equal(latvianScope.counts.localized,658);
assert.equal(latvianScope.counts.intentional_english,8);
assert.equal(latvianScope.counts.qb_owned,7);
assert.equal(latvianScope.unresolvedKeys,0);
assert.equal(latvianScope.draftScopeComplete,true);
assert.equal(latvianScope.distributionApproved,false,'Draft scope must not imply distribution approval: latvianScope');
const galicianScope=getTranslationDraftScopeWorklist('gl');
assert.equal(galicianScope.referenceKeys,673);
assert.equal(galicianScope.counts.localized,650);
assert.equal(galicianScope.counts.intentional_english,16);
assert.equal(galicianScope.counts.qb_owned,7);
assert.equal(galicianScope.unresolvedKeys,0);
assert.equal(galicianScope.draftScopeComplete,true);
assert.equal(galicianScope.distributionApproved,false,'Draft scope must not imply distribution approval: galicianScope');
const esperantoScope=getTranslationDraftScopeWorklist('eo');
assert.equal(esperantoScope.referenceKeys,673);
assert.equal(esperantoScope.canonicalEnglishKeys,693);
assert.equal(esperantoScope.counts.localized,658);
assert.equal(esperantoScope.counts.intentional_english,8);
assert.equal(esperantoScope.counts.qb_owned,7);
assert.equal(esperantoScope.unresolvedKeys,0);
assert.equal(esperantoScope.draftScopeComplete,true);
assert.equal(esperantoScope.distributionApproved,false,'Draft scope must not imply distribution approval: esperantoScope');
const albanianScope=getTranslationDraftScopeWorklist('sq');
assert.equal(albanianScope.referenceKeys,673);
assert.equal(albanianScope.canonicalEnglishKeys,693);
assert.equal(albanianScope.counts.localized,655);
assert.equal(albanianScope.counts.intentional_english,11);
assert.equal(albanianScope.counts.qb_owned,7);
assert.equal(albanianScope.unresolvedKeys,0);
assert.equal(albanianScope.draftScopeComplete,true);
assert.equal(albanianScope.distributionApproved,false,'Draft scope must not imply distribution approval: albanianScope');
const uzbekScope=getTranslationDraftScopeWorklist('uz-Latn');
assert.equal(uzbekScope.referenceKeys,673);
assert.equal(uzbekScope.canonicalEnglishKeys,693);
assert.equal(uzbekScope.counts.localized,657);
assert.equal(uzbekScope.counts.intentional_english,9);
assert.equal(uzbekScope.counts.qb_owned,7);
assert.equal(uzbekScope.unresolvedKeys,0);
assert.equal(uzbekScope.draftScopeComplete,true);
assert.equal(uzbekScope.distributionApproved,false,'Draft scope must not imply distribution approval: uzbekScope');
const hindiScope=getTranslationDraftScopeWorklist('hi-IN');
assert.equal(hindiScope.referenceKeys,673);
assert.equal(hindiScope.canonicalEnglishKeys,693);
assert.equal(hindiScope.counts.localized,657);
assert.equal(hindiScope.counts.intentional_english,9);
assert.equal(hindiScope.counts.qb_owned,7);
assert.equal(hindiScope.unresolvedKeys,0);
assert.equal(hindiScope.draftScopeComplete,true);
assert.equal(hindiScope.distributionApproved,false,'Draft scope must not imply distribution approval: hindiScope');
const nepaliScope=getTranslationDraftScopeWorklist('ne-NP');
assert.equal(nepaliScope.referenceKeys,673);
assert.equal(nepaliScope.canonicalEnglishKeys,693);
assert.equal(nepaliScope.counts.localized,657);
assert.equal(nepaliScope.counts.intentional_english,9);
assert.equal(nepaliScope.counts.qb_owned,7);
assert.equal(nepaliScope.unresolvedKeys,0);
assert.equal(nepaliScope.draftScopeComplete,true);
assert.equal(nepaliScope.distributionApproved,false,'Draft scope must not imply distribution approval: nepaliScope');
const greekScope=getTranslationDraftScopeWorklist('el');
assert.equal(greekScope.referenceKeys,673);
assert.equal(greekScope.canonicalEnglishKeys,693);
assert.equal(greekScope.counts.localized,656);
assert.equal(greekScope.counts.intentional_english,10);
assert.equal(greekScope.counts.qb_owned,7);
assert.equal(greekScope.unresolvedKeys,0);
assert.equal(greekScope.draftScopeComplete,true);
assert.equal(greekScope.distributionApproved,false,'Draft scope must not imply distribution approval: greekScope');
// A78-230 Georgian: the complete 673-key semantic-reference draft is not native approval.
const georgianScope=getTranslationDraftScopeWorklist('ka');
assert.equal(georgianScope.referenceKeys,673);
assert.equal(georgianScope.canonicalEnglishKeys,693);
assert.equal(georgianScope.counts.localized,656);
assert.equal(georgianScope.counts.intentional_english,10);
assert.equal(georgianScope.counts.qb_owned,7);
assert.equal(georgianScope.unresolvedKeys,0);
assert.equal(georgianScope.draftScopeComplete,true);
assert.equal(georgianScope.distributionApproved,false,'Draft scope must not imply distribution approval: georgianScope');

const kazakhScope=getTranslationDraftScopeWorklist('kk');
assert.equal(kazakhScope.referenceKeys,673);
assert.equal(kazakhScope.canonicalEnglishKeys,693);
assert.equal(kazakhScope.counts.localized,656);
assert.equal(kazakhScope.counts.intentional_english,10);
assert.equal(kazakhScope.counts.qb_owned,7);
assert.equal(kazakhScope.unresolvedKeys,0);
assert.equal(kazakhScope.draftScopeComplete,true);
assert.equal(kazakhScope.distributionApproved,false,'Draft scope must not imply distribution approval: kazakhScope');

const mongolianScope=getTranslationDraftScopeWorklist('mn-MN');
assert.equal(mongolianScope.referenceKeys,673);
assert.equal(mongolianScope.canonicalEnglishKeys,693);
assert.equal(mongolianScope.counts.localized,656);
assert.equal(mongolianScope.counts.intentional_english,10);
assert.equal(mongolianScope.counts.qb_owned,7);
assert.equal(mongolianScope.unresolvedKeys,0);
assert.equal(mongolianScope.draftScopeComplete,true);
assert.equal(mongolianScope.distributionApproved,false,'Draft scope must not imply distribution approval: mongolianScope');

const armenianScope=getTranslationDraftScopeWorklist('hy');
assert.equal(armenianScope.referenceKeys,673);
assert.equal(armenianScope.canonicalEnglishKeys,693);
assert.equal(armenianScope.counts.localized,656);
assert.equal(armenianScope.counts.intentional_english,10);
assert.equal(armenianScope.counts.qb_owned,7);
assert.equal(armenianScope.unresolvedKeys,0);
assert.equal(armenianScope.draftScopeComplete,true);
assert.equal(armenianScope.distributionApproved,false,'Draft scope must not imply distribution approval: armenianScope');

const occitanScope=getTranslationDraftScopeWorklist('oc');
assert.equal(occitanScope.referenceKeys,673);
assert.equal(occitanScope.canonicalEnglishKeys,693);
assert.equal(occitanScope.counts.localized,656);
assert.equal(occitanScope.counts.intentional_english,10);
assert.equal(occitanScope.counts.qb_owned,7);
assert.equal(occitanScope.unresolvedKeys,0);
assert.equal(occitanScope.draftScopeComplete,true);
assert.equal(occitanScope.distributionApproved,false,'Draft scope must not imply distribution approval: occitanScope');

const basqueScope=getTranslationDraftScopeWorklist('eu');
assert.equal(basqueScope.referenceKeys,673);
assert.equal(basqueScope.canonicalEnglishKeys,693);
assert.equal(basqueScope.counts.localized,656);
assert.equal(basqueScope.counts.intentional_english,10);
assert.equal(basqueScope.counts.qb_owned,7);
assert.equal(basqueScope.unresolvedKeys,0);
assert.equal(basqueScope.draftScopeComplete,true);
assert.equal(basqueScope.distributionApproved,false,'Draft scope must not imply distribution approval: basqueScope');

const latgalianScope=getTranslationDraftScopeWorklist('ltg');
assert.equal(latgalianScope.referenceKeys,673);
assert.equal(latgalianScope.canonicalEnglishKeys,693);
assert.equal(latgalianScope.counts.localized,656);
assert.equal(latgalianScope.counts.intentional_english,10);
assert.equal(latgalianScope.counts.qb_owned,7);
assert.equal(latgalianScope.unresolvedKeys,0);
assert.equal(latgalianScope.draftScopeComplete,true);
assert.equal(latgalianScope.distributionApproved,false,'Draft scope must not imply distribution approval: latgalianScope');
// A78-237 Arabic: source-bound complete 673-key AI draft; native approval stays pending.
const arabicScope=getTranslationDraftScopeWorklist('ar');
assert.equal(arabicScope.referenceKeys,673);
assert.equal(arabicScope.canonicalEnglishKeys,693);
assert.equal(arabicScope.counts.localized,656);
assert.equal(arabicScope.counts.intentional_english,10);
assert.equal(arabicScope.counts.qb_owned,7);
assert.equal(arabicScope.unresolvedKeys,0);
assert.equal(arabicScope.draftScopeComplete,true);
assert.equal(arabicScope.distributionApproved,false,'Draft scope must not imply distribution approval: arabicScope');
// A78-238 Persian: completed AI semantic-reference draft, not native approved.
const persianScope=getTranslationDraftScopeWorklist('fa');
assert.equal(persianScope.referenceKeys,673);
assert.equal(persianScope.canonicalEnglishKeys,693);
assert.equal(persianScope.counts.localized,656);
assert.equal(persianScope.counts.intentional_english,10);
assert.equal(persianScope.counts.qb_owned,7);
assert.equal(persianScope.unresolvedKeys,0);
assert.equal(persianScope.draftScopeComplete,true);
assert.equal(persianScope.distributionApproved,false,'Draft scope must not imply distribution approval: persianScope');
// A78-239 Hebrew: complete 673-key AI draft; this is not native approval.
const hebrewScope=getTranslationDraftScopeWorklist('he');
assert.equal(hebrewScope.referenceKeys,673);
assert.equal(hebrewScope.canonicalEnglishKeys,693);
assert.equal(hebrewScope.counts.localized,656);
assert.equal(hebrewScope.counts.intentional_english,10);
assert.equal(hebrewScope.counts.qb_owned,7);
assert.equal(hebrewScope.unresolvedKeys,0);
assert.equal(hebrewScope.draftScopeComplete,true);
assert.equal(hebrewScope.distributionApproved,false,'Draft scope must not imply distribution approval: hebrewScope');
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(hebrewScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Hebrew torrent column '+field);
}

for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(persianScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Persian torrent column '+field);
}

for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(arabicScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Arabic torrent column '+field);
}

for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(latgalianScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Latgalian torrent column '+field);
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(basqueScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Basque torrent column '+field);
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(occitanScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Occitan torrent column '+field);
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(armenianScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned');
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(mongolianScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned');
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(kazakhScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned');
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(georgianScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'qBittorrent source owns Georgian torrent column '+field);
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
 assert.equal(nepaliScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned','qB owns torrent column '+field);
}
for(const field of ['name','size','progress','download','upload','status','categoryColumn']){
  assert.equal(uzbekScope.items.find(item=>item.key==='torrent.'+field)?.classification,'qb_owned',
    'The qBittorrent source must own torrent column '+field);
}
// Keep the exact-source error checks independent of a permanently unfinished
// Catalan fixture: a completed draft has no unresolved Catalan keys.
const caDecisionsBase={schemaVersion:1,source:'WeiG-locale-draft-scope-decisions',
  locale:'ca',englishSourceSha256:canonicalEnglishSourceSha256,
  simplifiedChineseSourceSha256:simplifiedChineseReferenceSha256,decisions:{}};
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...caDecisionsBase,englishSourceSha256:'stale'}}),/Stale English fingerprint/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...caDecisionsBase,simplifiedChineseSourceSha256:'stale'}}),/Stale Simplified Chinese fingerprint/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...caDecisionsBase,decisions:{'nav.rss':{classification:'intentional_english',
    reason:'Unrelated English-only field',evidence:'Synthetic out of scope'}}}}),
  /Non-reference key/);
assert.throws(()=>getTranslationDraftScopeWorklist('ca',{decisions:{
  ...caDecisionsBase,decisions:{'app.back':{classification:'intentional_english',
    reason:'Already translated in Catalan',
    evidence:'Synthetic conflicting decision fixture'}}}}),/overlaps translated value/);

// Exercise valid/invalid evidence against a *currently unresolved* source.
// The fixture follows the review ledger as more AI drafts finish, rather than
// asserting that a specific previously completed language must stay incomplete.
const unfinishedScope=expectedExtendedLocales
  .map(locale=>getTranslationDraftScopeWorklist(locale))
  .find(scope=>scope.unresolvedKeys>0);
if(unfinishedScope){
  const missing=unfinishedScope.work[0];
  const locale=unfinishedScope.locale;
  // A partially reviewed source may already contain evidenced decisions.
  // Preserve all of them while injecting exactly one additional test decision.
  const existingDecisions=Object.fromEntries(unfinishedScope.items
    .filter(item=>['intentional_english','qb_owned'].includes(item.classification))
    .map(item=>[item.key,{classification:item.classification,
      reason:item.reason,evidence:item.evidence,
      ...(item.classification==='qb_owned'?{ownerFile:item.ownerFile,caller:item.caller}:{})}]));
  const decisionsBase={...caDecisionsBase,locale};
  const evidenced={...decisionsBase,decisions:{
    ...existingDecisions,
    [missing.key]:{classification:'intentional_english',
      reason:'Synthetic test: retain a technical identifier unchanged',
      evidence:'Synthetic valid-evidence fixture, never human approval'}
  }};
  const classified=getTranslationDraftScopeWorklist(locale,{decisions:evidenced});
  assert.equal(classified.counts.localized,unfinishedScope.counts.localized);
  assert.equal(classified.counts.intentional_english,unfinishedScope.counts.intentional_english+1);
  assert.equal(classified.counts.qb_owned,unfinishedScope.counts.qb_owned);
  assert.equal(classified.unresolvedKeys,unfinishedScope.unresolvedKeys-1);
  assert.equal(classified.draftScopeComplete,classified.unresolvedKeys===0);
  assert.equal(classified.distributionApproved,false,'Draft scope must not imply distribution approval: classified');
  const originalFormal=getTranslationReviewWorklist(locale);
  assert.equal(originalFormal.unreviewedKeys,
    originalFormal.canonicalKeys-originalFormal.suppliedKeys-originalFormal.reviewedEnglishFallbackCount,
    'Draft scope decisions cannot alter the 693-key formal review ledger');
  assert.throws(()=>getTranslationDraftScopeWorklist(locale,{decisions:{
    ...evidenced,decisions:{[missing.key]:{classification:'intentional_english',
      reason:'No actual supporting source',evidence:''}}}}),/verifiable evidence/);
  assert.throws(()=>getTranslationDraftScopeWorklist(locale,{decisions:{
    ...evidenced,decisions:{[missing.key]:{classification:'qb_owned',
      reason:'Unverified claimed qB label',
      evidence:'Synthetic missing caller / owner file'}}}}),/runtime owner file/);
}else{
  assert.ok(expectedExtendedLocales.every(locale=>getTranslationDraftScopeWorklist(locale).unresolvedKeys===0),
    'Evidence fixtures are optional after every 673-key draft has been classified');
}

// A78-267: full English canonical worklist never confuses accounted keys,
// static caller *candidates* or scope decisions with independent QA approval.
const ptFull=getTranslationFullQualityWorklist('pt-BR');
assert.equal(ptFull.canonicalKeys,693);
assert.equal(ptFull.items.length,693);
assert.equal(ptFull.counts.translated,668);
assert.equal(ptFull.counts.reviewedEnglishFallback,25);
assert.equal(ptFull.counts.unreviewedEnglishFallback,0);
assert.equal(ptFull.independentErrorReviewRecorded,false);
assert.equal(ptFull.staticCallerEvidence,'candidate-only');
assert.ok(ptFull.items.every(item=>item.semanticAndIndependentReview==='pending'));
assert.ok(ptFull.items.some(item=>item.key==='settings.update.channelVirtual'&&item.disposition==='reviewed_english_fallback'));
assert.ok(ptFull.items.find(item=>item.key==='selection.invertAllMatching')
  .callerCandidates.some(item=>item.file==='webui/private/scripts/selection.js'));
// A78-286: instances-ui.js uses a proven scoped wrapper, not a
// dotted literal at each caller. The review worklist must surface these
// candidates without treating the presence of a candidate as QA PASS.
for(const key of ['instances.importHint','instances.online','instances.lastReported']){
  const record=ptFull.items.find(item=>item.key===key);
  assert.ok(record,'Missing canonical key '+key);
  assert.ok(record.callerCandidates.some(item=>
    item.file==='webui/private/scripts/instances-ui.js'&&
    item.evidence==='static-scoped-wrapper-candidate-not-verified'),
    'Source-proven scoped caller is missing: '+key);
  assert.equal(record.semanticAndIndependentReview,'pending');
}
assert.equal(ptFull.independentErrorReviewRecorded,false);

// A78-296: dynamic capability copy derives only from real registry feature
// IDs, not from guesswork or an approved locale state.
for(const id of ['privateFilter','categoryFacet','tagFacet','search','rss','logs','stalledFilter']){
  for(const part of ['title','reason']){
    const key='capability.'+id+'.'+part;
    const item=ptFull.items.find(x=>x.key===key);
    assert.ok(item&&item.callerCandidates.some(x=>
      x.file==='webui/private/scripts/capabilities.js'&&
      x.registry==='webui/private/data/capabilities.json'&&
      x.featureId===id&&
      x.evidence==='static-feature-registry-candidate-not-verified'),
      'Missing real-registry static caller candidate: '+key);
    assert.equal(item.semanticAndIndependentReview,'pending');
  }
}
assert.equal(ptFull.independentErrorReviewRecorded,false);

// A78-287: HTML data-i18n bindings are also source-proven static caller
// candidates. The app menu aria label and skip link reside in index.html,
// not a JS literal caller; candidate status never implies QA approval.
for(const key of ['app.skip','app.menu','nav.torrents']){
  const item=ptFull.items.find(entry=>entry.key===key);
  assert.ok(item&&item.callerCandidates.some(candidate=>
    candidate.file==='webui/private/index.html'&&
    candidate.evidence==='static-html-attribute-candidate-not-verified'),
    'Missing declarative HTML i18n caller candidate: '+key);
  assert.equal(item.semanticAndIndependentReview,'pending');
}
assert.throws(()=>getTranslationFullQualityWorklist('zh-CN'),/Unknown or already bundled/);

console.log('Translation worklist passed: source-bound English and Simplified Chinese semantic reference, no fabricated approvals.');

// A78-312: shared, source-fingerprinted candidates; zero automatic QA approvals.
const sharedCallers=getTranslationSharedCallerCandidates();
assert.equal(sharedCallers.source,'WeiG-shared-translation-caller-candidates');
assert.equal(sharedCallers.canonicalEnglishSourceSha256,canonicalEnglishSourceSha256);
assert.equal(sharedCallers.simplifiedChineseSourceSha256,simplifiedChineseReferenceSha256);
assert.match(sharedCallers.candidateSourceSha256,/^[a-f0-9]{64}$/);
assert.equal(sharedCallers.counts.canonicalKeys,693);
assert.equal(sharedCallers.items.length,693);
assert.equal(sharedCallers.counts.withCandidates+sharedCallers.counts.withoutCandidates,693);
assert.equal(sharedCallers.verifiedRuntimeOwnerCount,0);
assert.equal(sharedCallers.independentSemanticReviewRecorded,false);
assert.ok(sharedCallers.sourceFiles.some(item=>item.file==='webui/private/index.html'));
assert.ok(sharedCallers.sourceFiles.some(item=>item.file==='webui/private/data/capabilities.json'));
assert.ok(sharedCallers.sourceFiles.every(item=>/^[a-f0-9]{64}$/.test(item.sha256)));
for(const key of ['app.skip','instances.importHint','capability.search.title','selection.deleteSelected']){
  const sharedItem=sharedCallers.items.find(item=>item.key===key);
  const perLocaleItem=ptFull.items.find(item=>item.key===key);
  assert.deepEqual(sharedItem.callerCandidates,perLocaleItem.callerCandidates,
    'Shared map must preserve existing caller candidates: '+key);
  assert.equal(sharedItem.evidence,'static-candidate-only-not-runtime-verified');
}

// A78-313: only 8 of 20 English-only keys have an explicit preserved-label
// contract; contextual UI labels (e.g., Version, Ratio) are NOT auto-fallback.
const exceptions=sharedCallers.referenceExceptions;
assert.equal(exceptions.length,20);
assert.equal(sharedCallers.counts.simplifiedChineseReferenceKeys,673);
assert.equal(sharedCallers.counts.englishOnlyReferenceExceptions,20);
assert.equal(sharedCallers.counts.sourcePreservedEnglishOnly,8);
assert.equal(sharedCallers.counts.contextReviewEnglishOnly,12);
assert.equal(exceptions.filter(item=>item.classification==='source-preserved-label').length,8);
for(const key of ['nav.rss','rss.title','settings.weig.title','language.en']){
  assert.equal(exceptions.find(item=>item.key===key)?.classification,'source-preserved-label');
}
for(const key of ['torrent.eta','torrent.ratio','settings.about.version','settings.update.channelVirtual']){
  assert.equal(exceptions.find(item=>item.key===key)?.classification,'target-locale-context-review-required');
}
assert.equal(sharedCallers.verifiedRuntimeOwnerCount,0);

// A78-314: the 8 source-preserved English labels are explicitly accounted
// in six existing drafts; no automatic full-locale or semantic QA approval.
for(const locale of ['ar','az-Latn','bs','ca','el','eo','et','eu','fa','gl','he','hi-IN','hr','hu','hy','id','is','ka','kk','lt','ltg','lv-LV','mn-MN','ms-MY','nb','ne-NP','oc','sk','sq','sr-Latn','sr','th','uz-Latn','vi']){
  const work=getTranslationReviewWorklist(locale);
  assert.equal(work.status,'draft');
  assert.ok(work.reviewedEnglishFallbackCount>=8);
  for(const key of ['nav.rss','rss.title','capability.rss.title','settings.weig.title',
    'language.en','language.zh-CN','language.ja','language.ko']){
    assert.ok(!work.work.some(item=>item.key===key),
      'Fixed source label must be formal English fallback: '+locale+'/'+key);
  }
}

// A78-321: consent text must not promise session isolation or narrow all
// credentials to passwords; this is a static wording gate, not real-qB QA.
for(const [locale,required,unsupported] of [
  ['ko',/인증 정보/,/비밀번호|세션/u],
  ['ru',/Учётные данные для входа/u,/Пароли|сеансы/u],
  ['zh-TW',/登入憑證/u,/密碼|工作階段/u],
  ['zh-CN',/登录凭据/u,/密码|会话/u]
]){
  const bundle=JSON.parse(fs.readFileSync(
    new URL('../webui/private/data/weig-i18n/'+locale+'.json',import.meta.url),'utf8'));
  const hint=bundle.messages['instances.allowHint'];
  assert.match(hint,required,'Login credential guarantee is missing in '+locale);
  assert.doesNotMatch(hint,unsupported,'Unsupported password/session privacy promise in '+locale);
  assert.ok(hint.includes('{source}'),'Consent source placeholder lost for '+locale);
}

// A78-322: every existing draft scope stays attached to the current 673-key
// Simplified Chinese semantic reference after a corrected consent string.
for(const locale of expectedExtendedLocales){
  const scope=getTranslationDraftScopeWorklist(locale);
  assert.equal(scope.simplifiedChineseSourceSha256,simplifiedChineseReferenceSha256,
    'Stale Simplified Chinese scope fingerprint for '+locale);
  assert.equal(scope.referenceKeys,673);
}

// A78-323: the Latgalian consent wording must not claim session sharing
// guarantees or narrow credentials to passwords. Native QA remains pending.
const latgalian=JSON.parse(fs.readFileSync(
  new URL('../language-packs/weig-i18n/ltg.json',import.meta.url),'utf8'));
const ltgConsent=latgalian.messages['instances.allowHint'];
assert.match(ltgConsent,/Pīsaslēgšonys dati/u);
assert.doesNotMatch(ltgConsent,/Parolis, seansi/u);
assert.ok(ltgConsent.includes('{source}'));
assert.equal(latgalian.translationStatus,'draft');
