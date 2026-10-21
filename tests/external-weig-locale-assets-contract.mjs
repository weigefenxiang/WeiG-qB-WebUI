import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {getTranslationDraftScopeWorklist} from '../tools/translation-review-worklist.mjs';
import {inspectExtendedLocaleSources,expectedExtendedLocales,validateExternalOverlay,canonicalEnglishTranslationKeys,canonicalEnglishSourceSha256,canonicalEnglishMessages,rootOfExternalLocales,SOURCE_PRESERVED_UI_LABELS} from '../tools/external-weig-locale-assets.mjs';

// The update identity caller uses the "virtual" channel for simulator metadata,
// not a virtualized installation; pt-BR must inherit canonical "Virtual".
const portugueseVirtual=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'pt-BR.json'),'utf8'));
assert.equal(canonicalEnglishMessages['settings.update.channelVirtual'],'Virtual');
assert.equal(Object.hasOwn(portugueseVirtual.messages,'settings.update.channelVirtual'),false,
  'Brazilian Portuguese must not relabel the simulator Virtual channel as Virtualizado');
// A78-260: selection.js uses allMatchingHashes() to invert only torrents
// matching the current filters, not the entire selected set.
// Preserve that scope in the Brazilian Portuguese bulk-selection UI.
assert.equal(canonicalEnglishMessages['selection.invertAllMatching'],'Invert all matching');
assert.match(portugueseVirtual.messages['selection.invertAllMatching'],/torrents correspondentes/iu,
  'Brazilian Portuguese invert-all action must retain the matching-filter scope');

// A78-261: The 25 unlocalized pt-BR canonical values have individually
// evidenced English fallback provenance: 16 draft scope decisions, eight
// canonical preserved labels and the source-owned Virtual channel.
// This is only fallback accounting, not 693-key semantic approval.
const ptDraftScope=getTranslationDraftScopeWorklist('pt-BR');
const ptScopeFallback=ptDraftScope.items
  .filter(item=>item.classification==='intentional_english').map(item=>item.key);
const ptProvenFallback=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...ptScopeFallback,'settings.update.channelVirtual']);
const ptUnstored=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(portugueseVirtual.messages,key));
assert.equal(ptScopeFallback.length,16);
assert.equal(ptProvenFallback.size,25);
assert.deepEqual([...ptProvenFallback].sort(),ptUnstored.slice().sort());
assert.deepEqual(portugueseVirtual.reviewedEnglishFallbackKeys,ptUnstored,
  'Every pt-BR fallback must be sourced and explicitly accounted');
assert.equal(portugueseVirtual.englishSourceSha256,canonicalEnglishSourceSha256,
  'pt-BR review evidence must be bound to the exact canonical English text');
assert.equal(portugueseVirtual.translationStatus,'draft',
  'Reviewed fallback keys are not complete locale quality approval');

// The density preview caller appends A/B/C to the literal Torrent label; LINKS has no Useful qualifier.
for(const [key,english] of [['settings.weig.density.torrentExample','Torrent'],['header.links','LINKS']]){
  assert.equal(canonicalEnglishMessages[key],english,'Canonical UI label changed: '+key);
  assert.equal(Object.hasOwn(portugueseVirtual.messages,key),false,
    'Do not add extra meaning to the Brazilian Portuguese standalone label '+key);
}

// A78-256: the density preview labels its samples by appending A/B/C to a bare Torrent noun.
// Never add Example/Sample, and do not store a duplicate of English when the natural noun is Torrent.
const densitySampleKey='settings.weig.density.torrentExample';
assert.equal(canonicalEnglishMessages[densitySampleKey],'Torrent');
for(const [locale,term] of [['be','Торэнт'],['bg','Торент'],['uk','Торент']]){
  const data=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(data.messages[densitySampleKey],term,'Incorrect density sample noun: '+locale);
}
for(const locale of ['cs','ro','sl','pt-BR']){
  const data=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(Object.hasOwn(data.messages,densitySampleKey),false,
    'Literal Torrent should inherit the canonical English density sample label: '+locale);
}

// A78-257: density affects row spacing, not the font family.
// Preserve text-size and column-width meaning at the actual settings.js caller.
const romanianDensity=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'ro.json'),'utf8'));
assert.equal(canonicalEnglishMessages['settings.weig.density.description'],
  'Adjust vertical spacing between list rows without changing text size or column widths.');
assert.match(romanianDensity.messages['settings.weig.density.description'],/dimensiunea textului/u,
  'Romanian density description must preserve the text-size distinction');
assert.match(romanianDensity.messages['settings.weig.density.description'],/lățimea coloanelor/u,
  'Romanian density description must preserve the column-width distinction');

// A78-262: Bulgarian/Ukrainian missing canonical keys have exact
// English fallback provenance (eight source-preserved labels plus five
// individually documented draft scope decisions). This does NOT approve
// the 680 localized values for either language.
for(const locale of ['bg','uk']){
  const source=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  const scope=getTranslationDraftScopeWorklist(locale);
  const scopeIntentionallyEnglish=scope.items.filter(item=>item.classification==='intentional_english').map(item=>item.key);
  const proven=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),...scopeIntentionallyEnglish]);
  const missing=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(source.messages,key));
  assert.equal(scopeIntentionallyEnglish.length,5);
  assert.equal(proven.size,13);
  assert.deepEqual([...proven].sort(),missing.slice().sort(),'Unsourced English fallback: '+locale);
  assert.deepEqual(source.reviewedEnglishFallbackKeys,missing,'Unreviewed English fallback: '+locale);
  assert.equal(source.englishSourceSha256,canonicalEnglishSourceSha256,'English fingerprint: '+locale);
  assert.equal(source.translationStatus,'draft','Fallback proof is not whole-language approval: '+locale);
}

// A78-259: Evidence correction. The BitTorrent app's own Malay description
// uses "rakan sebaya" for peers within a torrent swarm. A financial P2P term
// ("rakan setara") alone cannot disqualify that BitTorrent usage.
// Source: https://play.google.com/store/apps/details?hl=ms&id=com.bittorrent.client
const malayP2P=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'ms-MY.json'),'utf8'));
const malayPeerKeys=['detail.peers','detail.peersCount','peer.ban','peer.banned',
  'connection.reason.firewalled','connection.networkSnapshot','connection.step.default.3',
  'api.peersUnexpected'];
for(const key of malayPeerKeys){
  assert.match(malayP2P.messages[key],/rakan sebaya/iu,
    'Malay BitTorrent peer terminology must stay consistent: '+key);
}
assert.equal(malayP2P.translationStatus,'draft','Source-term QA does not imply formal review approval');
assert.equal(Object.keys(malayP2P.messages).length,656,'Malay locale key count must not regress');

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
