import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectExtendedLocaleSources,expectedExtendedLocales,validateExternalOverlay,canonicalEnglishTranslationKeys,canonicalEnglishSourceSha256,canonicalEnglishMessages,rootOfExternalLocales,SOURCE_PRESERVED_UI_LABELS} from '../tools/external-weig-locale-assets.mjs';

// The update identity caller uses the "virtual" channel for simulator metadata,
// not a virtualized installation; pt-BR must inherit canonical "Virtual".
const portugueseVirtual=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'pt-BR.json'),'utf8'));
assert.equal(canonicalEnglishMessages['settings.update.channelVirtual'],'Virtual');
assert.equal(Object.hasOwn(portugueseVirtual.messages,'settings.update.channelVirtual'),false,
  'Brazilian Portuguese must not relabel the simulator Virtual channel as Virtualizado');
// The density preview caller appends A/B/C to the literal Torrent label; LINKS has no Useful qualifier.
for(const [key,english] of [['settings.weig.density.torrentExample','Torrent'],['header.links','LINKS']]){
  assert.equal(canonicalEnglishMessages[key],english,'Canonical UI label changed: '+key);
  assert.equal(Object.hasOwn(portugueseVirtual.messages,key),false,
    'Do not add extra meaning to the Brazilian Portuguese standalone label '+key);
}

const status=inspectExtendedLocaleSources();
assert.equal(status.official,61);
assert.equal(status.primary,10);
assert.equal(status.englishVariants,2);
assert.equal(status.expected,48);
assert.equal(status.ready+status.missing.length,48);
assert.equal(status.ready+status.drafts.length,48,'All 48 external overlays must have source files');
assert.ok(status.ready+status.drafts.length>=17,'Previously authored extended locale sources must not disappear, whether draft or approved');
assert.equal(new Set(expectedExtendedLocales).size,48);
assert.ok(fs.existsSync(path.join(rootOfExternalLocales,'sk.json')),'Previously authored Slovak overlay must not disappear during approval');
assert.equal(expectedExtendedLocales.includes('en'),false,'Core English is never an external locale');
assert.equal(expectedExtendedLocales.includes('zh-HK'),false,'Current Hong Kong sparse overlay belongs to bundled WeiG core, not external packs');
const valid={schemaVersion:1,source:'WeiG-runtime-locale-overlay',locale:'ca',translationStatus:'draft',messages:{'app.loading':'S’està carregant…','library.count':'{count} descàrregues'}};
assert.equal(validateExternalOverlay('ca',valid),2);
// The 20 keys absent from the Chinese draft reference are not automatically English-only.
// Existing locale-specific ETA/Version translations must remain legal.
assert.equal(validateExternalOverlay('ca',{...valid,messages:{'torrent.eta':'Temps restant'}}),1);
assert.equal(validateExternalOverlay('ca',{...valid,messages:{'settings.about.version':'Versió'}}),1);
for(const key of Object.keys(SOURCE_PRESERVED_UI_LABELS)){
  const unwanted='Localized forbidden label: '+key;
  assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{[key]:unwanted}}),
    /Standalone English UI label must use W.I18n fallback/,'Independent English UI labels cannot be translated: '+key);
}
// A78-249: network loopback identifiers cannot be transliterated, even in a Cyrillic overlay.
const srSource=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'sr.json'),'utf8'));
const loopback=srSource.messages['instances.loopbackWarning'];
assert.equal(canonicalEnglishMessages['instances.loopbackWarning'].includes('127.0.0.1 / localhost'),true);
assert.ok(loopback.includes('127.0.0.1 / localhost'),'The Serbian Cyrillic network warning must preserve localhost verbatim');
assert.equal(validateExternalOverlay('sr',srSource),Object.keys(srSource.messages).length);
assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{'instances.loopbackWarning':'127.0.0.1 / лоцалхост no és el servidor remot.'}}),
  /Canonical network address literal missing/,'Transliterating localhost breaks a literal hostname');
assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{'instances.loopbackWarning':'localhost no és el servidor remot.'}}),
  /Canonical network address literal missing/,'Omitting 127.0.0.1 breaks the loopback address warning');

const boundaryValid={...valid,messages:{'library.refreshFailedPrefix':'No es poden actualitzar els torrents: ','instances.currentSuffix':' (actual)'}};
assert.equal(validateExternalOverlay('ca',boundaryValid),2,'Source-proven error prefixes and suffixes preserve whitespace boundaries');
assert.throws(()=>validateExternalOverlay('ca',{...boundaryValid,messages:{...boundaryValid.messages,'library.refreshFailedPrefix':'No es poden actualitzar els torrents:'}}),/Trailing whitespace mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...boundaryValid,messages:{...boundaryValid.messages,'instances.currentSuffix':'(actual)'}}),/Leading whitespace mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...boundaryValid,messages:{...boundaryValid.messages,'library.refreshFailedPrefix':'No es poden actualitzar els torrents:  '}}),/Trailing whitespace mismatch/,'Two trailing spaces cannot replace the one required by the canonical error prefix');
assert.throws(()=>validateExternalOverlay('ca',{...boundaryValid,messages:{...boundaryValid.messages,'instances.currentSuffix':'  (actual)'}}),/Leading whitespace mismatch/,'Two leading spaces cannot replace the one required by the canonical instance suffix');
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
const approvedMessages=Object.fromEntries(canonicalEnglishTranslationKeys.map(key=>{
  const source=canonicalEnglishMessages[key];
  return [key,source.replace(/^(\s*)/,(_whole,leading)=>leading+'Approved fixture ca: ')];
}));
const approvedFallback=['app.back',...Object.keys(SOURCE_PRESERVED_UI_LABELS)];
for(const key of approvedFallback)delete approvedMessages[key];
const approved={...valid,messages:approvedMessages,translationStatus:'approved',englishSourceSha256:canonicalEnglishSourceSha256,
  reviewedEnglishFallbackKeys:approvedFallback};
assert.equal(validateExternalOverlay('ca',approved),canonicalEnglishTranslationKeys.length-approvedFallback.length,'All canonical keys must be explicitly reviewed');
assert.throws(()=>validateExternalOverlay('ca',{...approved,englishSourceSha256:undefined}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,englishSourceSha256:'0'.repeat(64)}),/fingerprint mismatch/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,reviewedEnglishFallbackKeys:[]}),/unreviewed canonical/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,reviewedEnglishFallbackKeys:[...approved.reviewedEnglishFallbackKeys,approved.reviewedEnglishFallbackKeys[0]]}),/Duplicate or overlapping/);
assert.throws(()=>validateExternalOverlay('ca',{...approved,messages:{...approved.messages,'app.back':'Back'}}),/duplicates canonical English/);

const oldSparseApproved={...valid,translationStatus:'approved',englishSourceSha256:canonicalEnglishSourceSha256,
  messages:{'app.back':'Prova enrere'},reviewedEnglishFallbackKeys:canonicalEnglishTranslationKeys.filter(key=>key!=='app.back')};
assert.throws(()=>validateExternalOverlay('ca',oldSparseApproved),/10% English fallback/,'One translated key cannot certify a fully localized package');

assert.throws(()=>validateExternalOverlay('ca',{...valid,messages:{...valid.messages,'logs.ui.normal':'Normal'}}),/duplicates canonical English/,'Drafts must omit intentional English fallback values too');
