import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectExtendedLocaleSources,expectedExtendedLocales,validateExternalOverlay,canonicalEnglishTranslationKeys,canonicalEnglishSourceSha256,canonicalEnglishMessages,rootOfExternalLocales} from '../tools/external-weig-locale-assets.mjs';
const status=inspectExtendedLocaleSources();
assert.equal(status.official,61);
assert.equal(status.primary,10);
assert.equal(status.englishVariants,2);
assert.equal(status.expected,48);
assert.equal(status.ready+status.missing.length,48);
assert.ok(status.ready+status.drafts.length>=17,'Previously authored extended locale sources must not disappear, whether draft or approved');
assert.equal(new Set(expectedExtendedLocales).size,48);
assert.ok(fs.existsSync(path.join(rootOfExternalLocales,'sk.json')),'Previously authored Slovak overlay must not disappear during approval');
assert.equal(expectedExtendedLocales.includes('en'),false,'Core English is never an external locale');
assert.equal(expectedExtendedLocales.includes('zh-HK'),false,'Current Hong Kong sparse overlay belongs to bundled WeiG core, not external packs');
const valid={schemaVersion:1,source:'WeiG-runtime-locale-overlay',locale:'ca',translationStatus:'draft',messages:{'app.loading':'S’està carregant…','library.count':'{count} descàrregues'}};
assert.equal(validateExternalOverlay('ca',valid),2);
assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{'library.count':'torrents'}}),/Placeholder mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...valid,locale:'fr'}),/identity/);
assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{'unknown.key':'test'}}),/Unknown canonical English key/);
assert.throws(()=>validateExternalOverlay('bogus',valid),/Unknown/);
if(status.missing.length)assert.throws(()=>inspectExtendedLocaleSources({requireComplete:true}),/cannot claim completion/);
console.log('External locale gate passed: official 61-language identity, sparse overlay integrity and fail-closed full-language eligibility.');

assert.throws(()=>validateExternalOverlay('ca',{...valid,translationStatus:'unspecified'}),/draft or approved/);

const reviewedDraft={...valid,englishSourceSha256:canonicalEnglishSourceSha256,
  reviewedEnglishFallbackKeys:['app.back']};
assert.equal(validateExternalOverlay('ca',reviewedDraft),2,'Draft review may mark real English fallback as source-bound');
assert.throws(()=>validateExternalOverlay('ca',{...valid,reviewedEnglishFallbackKeys:'app.back'}),/must be an array/);
assert.throws(()=>validateExternalOverlay('ca',{...valid,reviewedEnglishFallbackKeys:['app.back']}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...reviewedDraft,reviewedEnglishFallbackKeys:['unrecognised.key']}),/Unknown reviewed English fallback key/);
assert.throws(()=>validateExternalOverlay('ca',{...reviewedDraft,reviewedEnglishFallbackKeys:['app.back','app.back']}),/Duplicate or overlapping reviewed fallback/);
assert.throws(()=>validateExternalOverlay('ca',{...reviewedDraft,reviewedEnglishFallbackKeys:['app.loading']}),/Duplicate or overlapping reviewed fallback/);
assert.throws(()=>validateExternalOverlay('ca',{...reviewedDraft,reviewedEnglishFallbackKeys:[42]}),/Unknown reviewed English fallback key/);
assert.throws(()=>validateExternalOverlay('ca',{...reviewedDraft,englishSourceSha256:'0'.repeat(64)}),/fingerprint mismatch/);


assert(canonicalEnglishTranslationKeys.length>500,'English source review set unexpectedly small');
const approvedMessages=Object.fromEntries(canonicalEnglishTranslationKeys.map(key=>[key,'Approved fixture ca: '+canonicalEnglishMessages[key]]));
delete approvedMessages['app.back'];
const approved={...valid,messages:approvedMessages,translationStatus:'approved',englishSourceSha256:canonicalEnglishSourceSha256,
  reviewedEnglishFallbackKeys:['app.back']};
assert.equal(validateExternalOverlay('ca',approved),canonicalEnglishTranslationKeys.length-1,'All canonical keys must be explicitly reviewed');
assert.throws(()=>validateExternalOverlay('ca',{...approved,englishSourceSha256:undefined}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,englishSourceSha256:'0'.repeat(64)}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,reviewedEnglishFallbackKeys:[]}),/unreviewed canonical/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,reviewedEnglishFallbackKeys:[...approved.reviewedEnglishFallbackKeys,approved.reviewedEnglishFallbackKeys[0]]}),/Duplicate or overlapping/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,messages:{...approved.messages,'app.back':'Back'}}),/duplicates canonical English/);

const oldSparseApproved={...valid,translationStatus:'approved',englishSourceSha256:canonicalEnglishSourceSha256,
  messages:{'app.back':'Prova enrere'},reviewedEnglishFallbackKeys:canonicalEnglishTranslationKeys.filter(key=>key!=='app.back')};
assert.throws(()=>validateExternalOverlay('ca',oldSparseApproved),/10% English fallback/,'One translated key cannot certify a fully localized package');

assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{...valid.messages,'logs.ui.normal':'Normal'}}),/duplicates canonical English/,'Drafts must omit intentional English fallback values too');
