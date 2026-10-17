import assert from 'node:assert/strict';
import {inspectExtendedLocaleSources,expectedExtendedLocales,validateExternalOverlay,canonicalEnglishTranslationKeys,canonicalEnglishSourceSha256} from '../tools/external-weig-locale-assets.mjs';
const status=inspectExtendedLocaleSources();
assert.equal(status.official,61);
assert.equal(status.primary,10);
assert.equal(status.englishVariants,2);
assert.equal(status.expected,48);
assert.equal(status.ready+status.missing.length,48);
assert.ok(status.drafts.includes('ca')&&status.drafts.includes('it')&&status.drafts.includes('nl'),'Real draft overlays must be tracked separately from publishable language coverage');
assert.equal(new Set(expectedExtendedLocales).size,48);
assert.equal(expectedExtendedLocales.includes('en'),false,'Core English is never an external locale');
assert.equal(expectedExtendedLocales.includes('zh-HK'),false,'Current Hong Kong sparse overlay belongs to bundled WeiG core, not external packs');
const valid={schemaVersion:1,source:'WeiG-runtime-locale-overlay',locale:'ca',translationStatus:'draft',messages:{'app.loading':'S’està carregant…','library.count':'{count} torrents'}};
assert.equal(validateExternalOverlay('ca',valid),2);
assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{'library.count':'torrents'}}),/Placeholder mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...valid,locale:'fr'}),/identity/);
assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{'unknown.key':'test'}}),/Unknown canonical English key/);
assert.throws(()=>validateExternalOverlay('bogus',valid),/Unknown/);
if(status.missing.length)assert.throws(()=>inspectExtendedLocaleSources({requireComplete:true}),/cannot claim completion/);
console.log('External locale gate passed: official 61-language identity, sparse overlay integrity and fail-closed full-language eligibility.');

assert.throws(()=>validateExternalOverlay('ca',{...valid,translationStatus:'unspecified'}),/draft or approved/);

assert(canonicalEnglishTranslationKeys.length>500,'English source review set unexpectedly small');
const approved={...valid,messages:{...valid.messages,'library.count':'{count} descàrregues'},translationStatus:'approved',englishSourceSha256:canonicalEnglishSourceSha256,
  reviewedEnglishFallbackKeys:canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(valid.messages,key))};
assert.equal(validateExternalOverlay('ca',approved),2,'All canonical keys must be explicitly reviewed');
assert.throws(()=>validateExternalOverlay('ca',{...approved,englishSourceSha256:undefined}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,englishSourceSha256:'0'.repeat(64)}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,reviewedEnglishFallbackKeys:approved.reviewedEnglishFallbackKeys.slice(1)}),/unreviewed canonical/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,reviewedEnglishFallbackKeys:[...approved.reviewedEnglishFallbackKeys,approved.reviewedEnglishFallbackKeys[0]]}),/Duplicate or overlapping/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,messages:{...approved.messages,'app.back':'Back'}}),/English-identical/);
