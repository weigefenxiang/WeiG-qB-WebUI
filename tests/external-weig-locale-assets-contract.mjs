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
// A78-294: This canonical pt-BR copy can receive count=1 or >1.
// Keep the quantity outside Portuguese plural inflection even while
// the exact product runtime caller of this legacy key remains unverified.
assert.equal(canonicalEnglishMessages['torrent.deleteSelected'],'Delete {count} selected torrents?');
assert.equal(portugueseVirtual.messages['torrent.deleteSelected'],'Excluir os torrents selecionados ({count})?');
for(const count of [1,2,17]){
  const rendered=portugueseVirtual.messages['torrent.deleteSelected'].replace('{count}',String(count));
  assert.equal(rendered,'Excluir os torrents selecionados ('+count+')?');
  assert.ok(!rendered.includes('os 1 torrents'),'Invalid pt-BR singular noun phrase');
}
assert.equal(portugueseVirtual.translationStatus,'draft');

// A78-295: capability fallback is a *source-evidence* decision, not a
// usable alternative Search/RSS API pathway. Preserve exact owner meaning.
for(const [key,feature] of [['capability.search.reason','search'],['capability.rss.reason','rss']]){
  const copy=portugueseVirtual.messages[key];
  assert.equal(typeof copy,'string','Missing pt-BR capability copy: '+key);
  assert.match(canonicalEnglishMessages[key],/fallback-only/, 'English provenance source missing');
  assert.match(copy,/vers[oõ]es? n[aã]o certificadas/iu, 'pt-BR must preserve uncertified-release scope: '+key);
  assert.match(copy,/crit[eé]rio de fallback/iu,'pt-BR must describe a fallback decision, not functional alternative: '+key);
  assert.doesNotMatch(copy,/serve apenas como alternativa/iu,'Ambiguous alternative capability path: '+key);
}
assert.equal(portugueseVirtual.translationStatus,'draft');

// A78-298: qB detail PropertiesWidget includes seeds_total and peers_total.
// layout.js uses detail.secondary.total for these current swarm counts;
// 'ao todo' expresses the total without inventing a cumulative-over-time meaning.
assert.equal(canonicalEnglishMessages['detail.secondary.total'],'total');
assert.equal(portugueseVirtual.messages['detail.secondary.total'],'ao todo',
  'pt-BR detail swarm total must not say cumulative/accumulated');
assert.equal(portugueseVirtual.translationStatus,'draft');
// A78-300: detail-compat PropertiesWidget time_elapsed includes seeding_time;
// this secondary value is elapsed seeding duration, not a present-tense status.
assert.equal(canonicalEnglishMessages['detail.secondary.seeding'],'seeding');
assert.equal(portugueseVirtual.messages['detail.secondary.seeding'],'tempo de semeadura',
  'pt-BR must label seeding duration rather than an ongoing sharing action');
assert.equal(portugueseVirtual.translationStatus,'draft');
// A78-301: qB 5.2.4 detail-compat has time_elapsed + seeding_time.
// layout.js renders detail.secondary.seeding for elapsed *duration*;
// status verbs like "seeding now"/"sharing" would change the UI meaning.
const detailLayoutSource=fs.readFileSync(path.resolve(rootOfExternalLocales,'../../webui/private/scripts/layout.js'),'utf8');
assert.match(detailLayoutSource,/if\(key==='seeding_time'\)return tr\('detail\.secondary\.seeding'\)/u,
  'Duration translation must keep its single real caller');
const detailManifest=JSON.parse(fs.readFileSync(path.resolve(rootOfExternalLocales,'../../webui/private/data/detail-compat.json'),'utf8'));
assert.ok(detailManifest.sourceFacts.torrentDetailUi.changes.some(change=>
  (change.value?.propertyLayout||[]).some(group=>(group.fields||[]).some(field=>
    field.id==='time_elapsed'&&field.dataProperties.includes('seeding_time')))),
  'Seeding-time copy must be backed by the qB source detail contract');
assert.equal(canonicalEnglishMessages['detail.secondary.seeding'],'seeding');
for(const [locale,expected] of [['ca','temps de sembra'],['gl','tempo de sementeira'],
  ['it','tempo di seeding'],['nl','seedtijd']]){
  const data=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(data.messages['detail.secondary.seeding'],expected,
    'Seeding elapsed duration must not be a status verb: '+locale);
  assert.equal(data.translationStatus,'draft','Unreviewed locale must remain draft: '+locale);
}

// A78-302: Keep native qB 5.2.4 duration terminology for additional locales,
// not verbs/states for a torrent that happens to be seeding right now.
for(const [locale,expected] of [['be','Час раздачы'],['cs','Čas seedování'],
  ['el','Χρόνος seeding'],['hu','Seedelési idő'],['pl','Czas seedowania'],
  ['sl','Čas sejanja'],['tr','Gönderim süresi'],['uk','Час роздачі']]){
  const data=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(data.messages['detail.secondary.seeding'],expected,
    'pt-BR/other locale duration meaning drift: '+locale);
  assert.equal(data.translationStatus,'draft','Unapproved locale must remain draft: '+locale);
}

// A78-303: qB 5.2.4 native vocabulary for *elapsed seeding time*
// in eight additional WeiG-owned draft language overlays.
for(const [locale,expected] of [['bs','Vrijeme dijeljenja'],['eu','Emaritza denbora'],
  ['hr','Vrijeme seedanja'],['nb','Delingstid'],['sk','Čas seedovania'],
  ['sr','Време сетве'],['sv','Distributionstid'],['vi','Thời gian seeding']]){
  const data=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(data.messages['detail.secondary.seeding'],expected,
    'Seeding duration translation must not denote an ongoing state: '+locale);
  assert.equal(data.translationStatus,'draft','No independent approval: '+locale);
}

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

// A78-263: Belarusian and Czech fully evidenced fallbacks remain draft.
// Belarusian Virtual describes the actual update channel (not virtualization);
// the Czech singular Tracker is the canonical BitTorrent column term.
for(const [locale,count,extra] of [['be',15,[]],['cs',16,['torrent.tracker']]]){
  const data=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  const scope=getTranslationDraftScopeWorklist(locale);
  const intentional=scope.items.filter(item=>item.classification==='intentional_english').map(item=>item.key);
  const expected=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),...intentional,...extra]);
  const absent=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(data.messages,key));
  assert.equal(expected.size,count);
  assert.deepEqual([...expected].sort(),absent.slice().sort(),'Unproven English fallback: '+locale);
  assert.deepEqual(data.reviewedEnglishFallbackKeys,absent);
  assert.equal(data.englishSourceSha256,canonicalEnglishSourceSha256);
  assert.equal(data.translationStatus,'draft','Fallback accounting is not AI translation approval');
}
const belarusianVirtual=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'be.json'),'utf8'));
assert.equal(canonicalEnglishMessages['settings.update.channelVirtual'],'Virtual');
assert.equal(belarusianVirtual.messages['settings.update.channelVirtual'],'Віртуальная');
assert.equal(canonicalEnglishMessages['torrent.tracker'],'Tracker');

// A78-264: two UI callers share identical source text and placeholders.
// Reuse each locale's already-authored DHT/Peers terminology, not an English
// fallback for only the statistics card. This does not approve the locale.
assert.equal(canonicalEnglishMessages['stats.dhtPeers'],
  canonicalEnglishMessages['connection.networkSnapshot']);
for(const locale of ['th','tr','az-Latn','ro','id','it','nl','fi']){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(overlay.messages['stats.dhtPeers'],overlay.messages['connection.networkSnapshot'],
    'DHT/Peers differs between stats and network snapshot: '+locale);
  assert.equal(overlay.translationStatus,'draft','Cross-surface consistency is not full QA');
}

// A78-265: The same EN DHT/Peers caption appears in statistics and
// connection status. Review RTL scripts and other source-owned translations
// against the existing locale's network wording, without approval promotion.
for(const locale of ['el','fa','he','gl','hi-IN','is','ms-MY','lt']){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(overlay.messages['stats.dhtPeers'],overlay.messages['connection.networkSnapshot'],
    'Same English source diverges across UI surfaces: '+locale);
  assert.equal(overlay.translationStatus,'draft','Parallel wording is not AI review approval');
}

// A78-268: the native General details caller reads pieces_have (pieces
// already possessed by this torrent). The PT-BR label must not imply generic
// pieces available elsewhere in the swarm. Keep the {count} placeholder.
assert.equal(canonicalEnglishMessages['detail.piecesHave'],'have {count}');
assert.equal(portugueseVirtual.messages['detail.piecesHave'],'possui {count}',
  'Portuguese pieces_have must describe owned pieces, not generally available ones');

// A78-269: layout.js interpolates counts without plural selection;
// selection.js also renders count=1 directly. Portuguese labels must remain
// grammatical for both one and many, while keeping original placeholders.
for(const [key,source,localized] of [
  ['settings.seconds','{n} seconds','{n} s'],
  ['detail.duration.daysHours','{days}d {hours}h','{days} d {hours} h'],
  ['detail.duration.seconds','{seconds}s','{seconds} s'],
  ['selection.selected','{n} selected','Selecionados: {n}']
]){
  assert.equal(canonicalEnglishMessages[key],source,'Unexpected source duration/count contract '+key);
  assert.equal(portugueseVirtual.messages[key],localized,'Portuguese count label must not force wrong plural: '+key);
}

// A78-270: Romanian qB 5.2.4 terminology confirms Seeds=Surse,
// Peers=Parteneri; overlay owns the WeiG detail labels, while the exact
// source-owned torrent column captions (ETA/Ratio/Tracker) stay fallback.
// Source: qbittorrent-5.2.4/src/lang/qbittorrent_ro.ts (PropertiesWidget).
const roAccounted=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'ro.json'),'utf8'));
const roReviewScope=getTranslationDraftScopeWorklist('ro');
const roIntentional=roReviewScope.items.filter(x=>x.classification==='intentional_english').map(x=>x.key);
const roEnglishFallback=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...roIntentional,'torrent.eta','torrent.ratio','torrent.tracker','settings.update.channelVirtual']);
const roUnstored=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(roAccounted.messages,key));
assert.equal(roEnglishFallback.size,22,'Romanian fallbacks must have source-based classification');
assert.deepEqual([...roEnglishFallback].sort(),roUnstored.slice().sort());
assert.deepEqual(roAccounted.reviewedEnglishFallbackKeys,roUnstored);
assert.equal(roAccounted.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,localeTerm] of Object.entries({
  'detail.trackers':'Trackere','detail.peers':'Parteneri','detail.seeds':'Surse',
  'detail.peersCount':'Parteneri','transfer.dhtPeers':'DHT / Parteneri',
  'settings.about.version':'Versiune','capability.privateFilter.title':'Privat / PT'})){
  assert.equal(roAccounted.messages[key],localeTerm,'Native-source-aligned Romanian term: '+key);
}
assert.equal(roAccounted.translationStatus,'draft','Formal English fallback is not independent AI QA');

// A78-271: qB 5.2.4 Italian source uses Server traccia/Nodi/
// Distributori for the native Trackers/Peers/Seeds detail surface.
// The three native Torrent column captions are qB copy owned, while
// fallback accounting cannot mark the whole 693-key locale AI approved.
// Source: qbittorrent-5.2.4/src/lang/qbittorrent_it.ts (PropTabBar/PropertiesWidget).
const italianAccounted=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'it.json'),'utf8'));
const italianScope=getTranslationDraftScopeWorklist('it');
const italianScopeFall=italianScope.items.filter(x=>x.classification!=='localized').map(x=>x.key);
const italianReasons=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...italianScopeFall,'torrent.eta','torrent.ratio','torrent.tracker']);
const italianMissing=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(italianAccounted.messages,key));
assert.equal(italianReasons.size,33);
assert.deepEqual([...italianReasons].sort(),italianMissing.slice().sort());
assert.deepEqual(italianAccounted.reviewedEnglishFallbackKeys,italianMissing);
assert.equal(italianAccounted.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,val] of Object.entries({
  'detail.trackers':'Server traccia','detail.peers':'Nodi',
  'detail.seeds':'Distributori','detail.peersCount':'Nodi',
  'transfer.dhtPeers':'DHT / Peer','settings.about.version':'Versione',
  'capability.privateFilter.title':'Privato / PT','settings.update.channelVirtual':'Virtuale'})){
  assert.equal(italianAccounted.messages[key],val,'Source-context Italian translation: '+key);
}
assert.equal(italianAccounted.translationStatus,'draft','No complete independent review has occurred');

// A78-272: qB 5.2.4 Dutch source retains borrowed Tracker/Trackers,
// Peers and Seeds unchanged. W.I18n must fallback, not duplicate English
// strings; actual native qB captions remain owned by their source context.
// Source: qbittorrent-5.2.4/src/lang/qbittorrent_nl.ts.
const dutchAccounted=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'nl.json'),'utf8'));
const dutchScope=getTranslationDraftScopeWorklist('nl');
const dutchBase=dutchScope.items.filter(item=>item.classification!=='localized').map(item=>item.key);
const dutchReasons=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),...dutchBase,
  'torrent.tracker','detail.trackers','detail.peers','detail.seeds','detail.peersCount']);
const dutchMissing=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(dutchAccounted.messages,key));
assert.equal(dutchReasons.size,38,'Unexplained Dutch fallback');
assert.deepEqual([...dutchReasons].sort(),dutchMissing.slice().sort());
assert.deepEqual(dutchAccounted.reviewedEnglishFallbackKeys,dutchMissing);
assert.equal(dutchAccounted.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,val] of Object.entries({
  'transfer.dhtPeers':'DHT / peers','settings.about.version':'Versie',
  'capability.privateFilter.title':'Privé / PT','settings.update.channelVirtual':'Virtueel'})){
  assert.equal(dutchAccounted.messages[key],val,'Dutch source context mismatch: '+key);
}
assert.equal(dutchAccounted.translationStatus,'draft','Fallback accounting is not locale QA approval');

// A78-273: qB 5.2.4 Finnish source distinguishes seurantapalvelimet,
// vertaiset and complete seeds (jakajat); native Torrent columns retain their
// own exact copy ownership. Review does not imply AI/native approval.
// Source: qbittorrent-5.2.4/src/lang/qbittorrent_fi.ts (PropTabBar).
const finnish=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'fi.json'),'utf8'));
const fiScope=getTranslationDraftScopeWorklist('fi');
const fiReasons=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...fiScope.items.filter(x=>x.classification!=='localized').map(x=>x.key),
  'torrent.eta','torrent.ratio','torrent.tracker']);
const fiUnstored=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(finnish.messages,key));
assert.equal(fiReasons.size,27);
assert.deepEqual([...fiReasons].sort(),fiUnstored.slice().sort());
assert.deepEqual(finnish.reviewedEnglishFallbackKeys,fiUnstored);
assert.equal(finnish.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,term] of Object.entries({
  'detail.trackers':'Seurantapalvelimet','detail.peers':'Vertaiset',
  'detail.seeds':'Jakajat','detail.peersCount':'Vertaiset',
  'transfer.dhtPeers':'DHT / Vertaiset','settings.about.version':'Versio',
  'capability.privateFilter.title':'Yksityinen / PT',
  'settings.update.channelVirtual':'Virtuaalinen'})){
  assert.equal(finnish.messages[key],term,'Source-aligned Finnish label: '+key);
}
assert.equal(finnish.translationStatus,'draft');

// A78-274: settings.js parses multiple comma-separated tracker hosts.
// Brazilian Portuguese agreement must be plural for 'domínios ... separados'
// and must not suggest a single domain when users enter multiple rules.
assert.equal(canonicalEnglishMessages['settings.weig.ptTrackers.description'],
  'Private metadata is resolved from qBittorrent; this optional list classifies PT by tracker domain, comma separated.');
assert.match(portugueseVirtual.messages['settings.weig.ptTrackers.description'],
  /domínios dos rastreadores, separados por vírgulas\./u,
  'Portuguese PT tracker-rule hint must preserve plural comma-separated domains');

// A78-275: qB 5.2.4 Turkish UI uses İzleyiciler for Trackers,
// Eşler for Peers and Gönderim for Seeds in native Properties context.
// Exact source remains authoritative for native qB copy, while this WeiG
// draft accounts for every EN canonical key without granting language PASS.
// Source: qbittorrent-5.2.4/src/lang/qbittorrent_tr.ts.
const turkish=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'tr.json'),'utf8'));
const trScope=getTranslationDraftScopeWorklist('tr');
const trReasons=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...trScope.items.filter(x=>x.classification!=='localized').map(x=>x.key)]);
const trMissing=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(turkish.messages,key));
assert.equal(trReasons.size,19);
assert.deepEqual([...trReasons].sort(),trMissing.slice().sort());
assert.deepEqual(turkish.reviewedEnglishFallbackKeys,trMissing);
assert.equal(turkish.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,val] of Object.entries({
  'detail.trackers':'İzleyiciler','detail.peers':'Eşler',
  'detail.seeds':'Gönderim','detail.peersCount':'Eşler',
  'transfer.dhtPeers':'DHT / Eşler','settings.about.version':'Sürüm',
  'capability.privateFilter.title':'Özel / PT','settings.update.channelVirtual':'Sanal'})){
  assert.equal(turkish.messages[key],val,'Turkish source-aligned term: '+key);
}
assert.equal(turkish.translationStatus,'draft','Source term review != independent QA approval');

// A78-276: selection.js interpolates the selected count directly, with no
// plural engine. Also, capabilities.js warns users to back up torrent DATA,
// not merely the .torrent descriptors before a qBittorrent version upgrade.
assert.equal(canonicalEnglishMessages['selection.deleteSelected'],
  'Delete {n} selected torrent(s).');
assert.equal(portugueseVirtual.messages['selection.deleteSelected'],
  'Excluir torrents selecionados ({n}).');
assert.equal(portugueseVirtual.messages['selection.deleteSelected'].replace('{n}','1'),
  'Excluir torrents selecionados (1).');
assert.equal(canonicalEnglishMessages['capability.advice'],
  'Availability is determined by the detected qBittorrent / WebAPI capability. Back up qBittorrent configuration and torrent data before upgrading.');
assert.match(portugueseVirtual.messages['capability.advice'],
  /backup da configuração do qBittorrent e dos dados dos torrents antes de atualizar\./u,
  'Portuguese upgrade warning must explicitly include torrent data backup');

// A78-277: layout.js renders pieces_have (locally possessed torrent pieces),
// not piece availability across the swarm. Preserve the placeholder while
// disambiguating that source field in the four locale overlays below.
assert.equal(canonicalEnglishMessages['detail.piecesHave'],'have {count}');
for(const [locale,meaning] of [
  ['it','in possesso: {count}'],['nl','in bezit: {count}'],
  ['ca','en possessió: {count}'],['el','στην κατοχή: {count}']
]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(overlay.messages['detail.piecesHave'],meaning,
    'pieces_have must mean locally possessed pieces, not globally available: '+locale);
  assert.equal(overlay.translationStatus,'draft','Targeted meaning fix is not full QA');
}

// A78-278: qBittorrent 5.2.4 Slovenian source uses Sledilniki
// (Trackers), Semena (Seeds) and Različica (Version); existing WeiG
// connection/peer UI consistently uses Vrstniki. Native torrent column
// copy stays with qB source, while 693-key fallback is documented only.
// Upstream reference: qbittorrent/qBittorrent release-5.2.4 src/lang/qbittorrent_sl.ts
const slAccounted=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'sl.json'),'utf8'));
const slScope=getTranslationDraftScopeWorklist('sl');
const slFixed=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...slScope.items.filter(item=>item.classification!=='localized').map(item=>item.key),
  'torrent.eta','torrent.ratio','torrent.tracker']);
const slMissing=canonicalEnglishTranslationKeys.filter(key=>!Object.hasOwn(slAccounted.messages,key));
assert.equal(slFixed.size,19);
assert.deepEqual([...slFixed].sort(),slMissing.slice().sort());
assert.deepEqual(slAccounted.reviewedEnglishFallbackKeys,slMissing);
assert.equal(slAccounted.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,value] of Object.entries({
  "stats.dhtPeers": "DHT {dht} · Vrstniki {peers}",
  "detail.trackers": "Sledilniki",
  "detail.peers": "Vrstniki",
  "detail.seeds": "Semena",
  "detail.peersCount": "Vrstniki",
  "transfer.dhtPeers": "DHT / Vrstniki",
  "settings.about.version": "Različica",
  "capability.privateFilter.title": "Zasebni / PT",
  "settings.update.channelVirtual": "Navidezna"
})){
  assert.equal(slAccounted.messages[key],value,'Slovenian caller/source translation: '+key);
}
assert.equal(slAccounted.translationStatus,'draft','Source ownership is not independent language QA');

// A78-279: qBittorrent 5.2.4 Polish upstream labels Trackery,
// Seedy, Wersja; the existing WeiG peer actions/network status use peerzy.
// The three exact native torrent column captions remain source owned.
// Upstream: qbittorrent/qBittorrent release-5.2.4 src/lang/qbittorrent_pl.ts
const plAccounted=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,'pl.json'),'utf8'));
const plScope=getTranslationDraftScopeWorklist('pl');
const plSourceRetained=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
  ...plScope.items.filter(item=>item.classification!=='localized').map(item=>item.key),
  'torrent.eta','torrent.ratio','torrent.tracker']);
const plMissing=canonicalEnglishTranslationKeys.filter(k=>!Object.hasOwn(plAccounted.messages,k));
assert.equal(plSourceRetained.size,27,'Polish fallback set must have evidence');
assert.deepEqual([...plSourceRetained].sort(),plMissing.slice().sort());
assert.deepEqual(plAccounted.reviewedEnglishFallbackKeys,plMissing);
assert.equal(plAccounted.englishSourceSha256,canonicalEnglishSourceSha256);
for(const [key,value] of Object.entries({
  "stats.dhtPeers": "DHT {dht} · peerzy {peers}",
  "detail.trackers": "Trackery",
  "detail.peers": "Peerzy",
  "detail.seeds": "Seedy",
  "detail.peersCount": "Peerzy",
  "transfer.dhtPeers": "DHT / peerzy",
  "settings.about.version": "Wersja",
  "capability.privateFilter.title": "Prywatne / PT",
  "settings.update.channelVirtual": "Wirtualna"
})){
  assert.equal(plAccounted.messages[key],value,'Source-aligned Polish terminology: '+key);
}
assert.equal(plAccounted.translationStatus,'draft','Fallback provenance does not establish full quality approval');

// A78-280: Swedish and Danish qB 5.2.4 source uses Spårare/Trackere
// and Distributioner/Seeds for native labels; W.I18n keeps already authored
// Peer terminology in the status surface. A qB-owned caption (or exact
// English technical label) is fallback rather than copied English text.
// Upstream: qbittorrent/qBittorrent release-5.2.4 src/lang/qbittorrent_{sv,da}.ts.
for(const [code,expectedCount,terms,extras] of [
  ['sv',35,{"stats.dhtPeers":"DHT {dht} · Peernoder {peers}","detail.trackers":"Spårare","detail.peers":"Peernoder","detail.seeds":"Distributioner","detail.peersCount":"Peernoder","transfer.dhtPeers":"DHT / Peernoder","capability.privateFilter.title":"Privat / PT","settings.update.channelVirtual":"Virtuell"},["torrent.eta","torrent.ratio","torrent.tracker","settings.about.version"]],
  ['da',44,{"stats.dhtPeers":"DHT {dht} · Peer-enheder {peers}","detail.trackers":"Trackere","detail.peers":"Modparter","detail.peersCount":"Modparter","transfer.dhtPeers":"DHT / Peer-enheder","capability.privateFilter.title":"Privat / PT","settings.update.channelVirtual":"Virtuel"},["torrent.eta","torrent.ratio","torrent.tracker","detail.seeds","settings.about.version"]]
]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,code+'.json'),'utf8'));
  const scope=getTranslationDraftScopeWorklist(code);
  const expected=new Set([...Object.keys(SOURCE_PRESERVED_UI_LABELS),
    ...scope.items.filter(item=>item.classification!=='localized').map(item=>item.key),
    ...extras]);
  const missing=canonicalEnglishTranslationKeys.filter(k=>!Object.hasOwn(overlay.messages,k));
  assert.equal(expected.size,expectedCount,'Scoped English labels '+code);
  assert.deepEqual([...expected].sort(),missing.slice().sort());
  assert.deepEqual(overlay.reviewedEnglishFallbackKeys,missing);
  assert.equal(overlay.englishSourceSha256,canonicalEnglishSourceSha256);
  for(const [key,value] of Object.entries(terms)){
    assert.equal(overlay.messages[key],value,'Source terminology '+code+'/'+key);
  }
  assert.equal(overlay.translationStatus,'draft','Native review is still pending '+code);
}

// A78-281: the real General Details caller renders the qBittorrent
// pieces_have count for locally possessed pieces. Explicitly qualify
// availability as local in these eight overlays to avoid swarm ambiguity.
// This focused check does not certify any complete 693-key locale review.
assert.equal(canonicalEnglishMessages['detail.piecesHave'],'have {count}');
for(const [locale,copy] of [["ar","القطع الموجودة محليًا: {count}"],["bg","локално налични части: {count}"],["gl","pezas dispoñibles localmente: {count}"],["hi-IN","स्थानीय रूप से मौजूद हिस्से: {count}"],["lv-LV","lokāli pieejami fragmenti: {count}"],["ne-NP","स्थानीय रूपमा उपलब्ध टुक्राहरू: {count}"],["sk","lokálne dostupných častí: {count}"],["sq","pjesë të disponueshme lokalisht: {count}"]]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(overlay.messages['detail.piecesHave'],copy,
    'pieces_have must describe locally held pieces: '+locale);
  assert.equal(overlay.translationStatus,'draft',
    'Local semantics correction is not an independent AI quality PASS: '+locale);
  assert.deepEqual([...copy.matchAll(/\{([^{}]+)\}/gu)].map(x=>x[1]),['count'],
    'Translation must preserve the count placeholder: '+locale);
}

// A78-282: caller inserts item counts without Portuguese plural rules:
// app.js detail items.length and instances-ui.js imported data.items.length.
// Count-neutral copy must be grammatical at 1 and at multiple items, and
// must preserve all EN placeholders and the no-credentials safety message.
for(const [key,expected] of [
  ['detail.virtualSummary','Itens: {count} · somente os elementos visíveis são montados no DOM.'],
  ['instances.importHint','Uma página externa forneceu endereços de instâncias de {source} (total: {count}). Revise antes de salvar; nenhuma senha nem sessão está incluída.']
]){
  assert.equal(portugueseVirtual.messages[key],expected,
    'Portuguese count-neutral copy required for direct caller interpolation: '+key);
  assert.equal(portugueseVirtual.translationStatus,'draft');
}
assert.ok(portugueseVirtual.messages['instances.importHint'].includes('nenhuma senha nem sessão'),
  'An imported instance list must not imply that credentials or sessions are included');

// A78-283: app.js supplies items.length directly with no plural grammar
// selection. Count-neutral language labels must work at both 1 and N,
// without modifying localization approval or the caller's business state.
assert.equal(canonicalEnglishMessages['detail.virtualSummary'],
  '{count} items · only the visible DOM is mounted.');
for(const [locale,copy] of [["it","Elementi: {count} · nel DOM sono presenti soltanto quelli visibili."],["nl","Items: {count} · alleen zichtbare elementen staan in de DOM."],["ro","Elemente: {count} · în DOM sunt afișate doar cele vizibile."],["fi","Kohteet: {count} · DOM sisältää vain näkyvät kohteet."],["sl","Elementi: {count} · v DOM so vključeni samo vidni elementi."],["pl","Elementy: {count} · w DOM znajdują się tylko widoczne elementy."],["da","Elementer: {count} · kun synlige elementer findes i DOM."],["nb","Elementer: {count} · bare de synlige elementene er lagt inn i DOM."]]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(overlay.messages['detail.virtualSummary'],copy,
    'Count-neutral detail virtual summary required: '+locale);
  assert.equal(overlay.translationStatus,'draft');
  assert.ok(copy.includes('{count}'),'Count placeholder lost: '+locale);
}

// A78-284: qB detail virtualization can show one item. These four
// languages use a count-neutral status label to preserve valid grammar at 1,
// without changing {count} or claiming completed native/AI quality review.
for(const [locale,expected] of [["cs","Položky: {count} · do DOM se přidává jen viditelná oblast."],["be","Элементы: {count} · у DOM дадаюцца толькі бачныя элементы."],["ca","Elements: {count} · al DOM només es munten els elements visibles."],["ar","العناصر: {count} · لا يُحمَّل في DOM إلا الجزء المرئي."]]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  assert.equal(overlay.messages['detail.virtualSummary'],expected,
    'Count-neutral detail-summary expected in '+locale);
  assert.equal(overlay.translationStatus,'draft');
  assert.ok(expected.includes('{count}'),'Missing placeholder: '+locale);
}

// A78-285: instances-ui.js interpolates a total count of addresses,
// including the case count=1. These translations avoid forced plural nouns,
// preserve source and count, and retain the original no-credentials warning.
for(const [locale,expected] of [["it","Una pagina esterna ha fornito indirizzi di istanze da {source} (totale: {count}). Controllali prima del salvataggio; non sono incluse password né sessioni."],["nl","Een externe pagina heeft instantieadressen van {source} aangeleverd (totaal: {count}). Controleer ze voordat je ze opslaat; er worden geen wachtwoorden of sessies meegeleverd."],["ro","O pagină externă a furnizat adrese de instanțe de la {source} (total: {count}). Verifică-le înainte de salvare; nu sunt incluse parole sau sesiuni."],["sl","Zunanja stran je posredovala naslove primerkov iz vira {source} (skupaj: {count}). Pred shranjevanjem jih preveri; gesla in seje niso vključeni."],["pl","Zewnętrzna strona udostępniła adresy instancji ze źródła {source} (łącznie: {count}). Sprawdź je przed zapisaniem; nie dołączono haseł ani sesji."],["da","En ekstern side leverede instansadresser fra {source} (i alt: {count}). Gennemgå dem før lagring; der medfølger ingen adgangskoder eller sessioner."],["nb","En ekstern side oppga instansadresser fra {source} (totalt: {count}). Kontroller dem før de lagres. Passord og økter er ikke inkludert."],["cs","Externí stránka poskytla adresy instancí ze zdroje {source} (celkem: {count}). Před uložením je zkontrolujte; žádná hesla ani relace nejsou součástí."]]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  const actual=overlay.messages['instances.importHint'];
  assert.equal(actual,expected,'Wrong count-neutral import prompt for '+locale);
  assert.equal(overlay.translationStatus,'draft');
  const placeholders=[...actual.matchAll(/\{([^{}]+)\}/gu)].map(m=>m[1]).sort();
  assert.deepEqual(placeholders,['count','source'],'Missing import placeholders in '+locale);
}

// A78-288/290: torrent selection, instance import and virtual-list owners
// interpolate bare counts, without CLDR plural selection. Keep UI phrases
// natural at count=1 and count>1 using neutral labels plus explicit totals.
// Do not invent a second plural runtime or promote any draft locale.
for(const [locale,keys] of Object.entries({
  "bs": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ],
  "ca": [
    "selection.deleteSelected",
    "instances.importHint"
  ],
  "da": [
    "selection.deleteSelected",
    "instances.torrentCount"
  ],
  "eo": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ],
  "gl": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ],
  "hr": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ],
  "is": [
    "selection.deleteSelected",
    "instances.importHint"
  ],
  "it": [
    "selection.deleteSelected"
  ],
  "nb": [
    "selection.deleteSelected",
    "instances.torrentCount"
  ],
  "nl": [
    "selection.deleteSelected"
  ],
  "pl": [
    "selection.deleteSelected"
  ],
  "ro": [
    "selection.deleteSelected",
    "instances.torrentCount"
  ],
  "sk": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ],
  "sl": [
    "selection.deleteSelected",
    "instances.torrentCount"
  ],
  "lt": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ],
  "lv-LV": [
    "selection.deleteSelected",
    "detail.virtualSummary",
    "instances.importHint"
  ]
})){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  for(const key of keys){
    const src=canonicalEnglishMessages[key],copy=overlay.messages[key];
    assert.equal(typeof copy,'string','Missing localized dynamic label '+locale+'/'+key);
    const sourcePlaceholders=[...src.matchAll(/\{([^{}]+)\}/gu)].map(m=>m[1]).sort();
    const localPlaceholders=[...copy.matchAll(/\{([^{}]+)\}/gu)].map(m=>m[1]).sort();
    assert.deepEqual(localPlaceholders,sourcePlaceholders,'Count placeholder changed '+locale+'/'+key);
    const countKey=key==='selection.deleteSelected'?'n':'count';
    assert.ok(copy.includes(': {'+countKey+'}'),
      'Use neutral count labeling, not count-dependent plural grammar: '+locale+'/'+key);
    const rendered=copy.replace('{' + countKey + '}', '1');
    assert.ok(rendered.includes('1'),'Lost singular value '+locale+'/'+key);
  }
  assert.equal(overlay.translationStatus,'draft','Targeted count corrections are not full AI approval');
}

// A78-291: instances-ui.js directly interpolates live and historical
// torrent counts without locale plural inflection. Use quantity-neutral
// captions rather than rendering incorrect singular values (e.g. 1 torentoj).
// This is a focused copy fix; it is not an independent 693-key quality review.
assert.equal(canonicalEnglishMessages['instances.torrentCount'],'{count} torrents');
for(const [locale,label] of [["eo","Torentoj: {count}"],["fi","Torrentit: {count}"],["he","טורנטים: {count}"],["sv","Torrenter: {count}"],["ne-NP","टोरेन्टहरू: {count}"],["lt","Torrentų: {count}"],["oc","Torrents dins l'instància: {count}"],["is","Torrentar: {count}"]]){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  const copy=overlay.messages['instances.torrentCount'];
  assert.equal(copy,label,'Incorrect count-neutral instance tooltip in '+locale);
  assert.equal(copy.replace('{count}','1'),label.replace('{count}','1'));
  assert.deepEqual([...copy.matchAll(/\{([^{}]+)\}/gu)].map(x=>x[1]),['count']);
  assert.equal(overlay.translationStatus,'draft','Count repair must not promote '+locale);
}

// A78-292: instances-ui.js substitutes a bare count in its live and
// historical instance tooltip, so '{count} torrents' must not be retained
// as English for a single instance torrent. Retire three superseded scope
// decisions, plus the Dutch formal fallback, as the localized copy takes over.
assert.equal(canonicalEnglishMessages['instances.torrentCount'],'{count} torrents');
for(const locale of ['ca','gl','nl']){
  const overlay=JSON.parse(fs.readFileSync(path.join(rootOfExternalLocales,locale+'.json'),'utf8'));
  const worklist=getTranslationDraftScopeWorklist(locale);
  const entry=worklist.items.find(item=>item.key==='instances.torrentCount');
  assert.equal(overlay.messages['instances.torrentCount'],'Torrents: {count}');
  assert.equal(overlay.messages['instances.torrentCount'].replace('{count}','1'),'Torrents: 1');
  assert.equal(entry.classification,'localized','Retire stale English-only scope: '+locale);
  assert.equal(overlay.translationStatus,'draft','Localized phrase alone is not QA approved');
  if(locale==='nl'){
    assert.equal(overlay.reviewedEnglishFallbackKeys.length,38);
    assert.ok(!overlay.reviewedEnglishFallbackKeys.includes('instances.torrentCount'));
    assert.equal(overlay.englishSourceSha256,canonicalEnglishSourceSha256);
  }
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
assert.ok(Object.keys(malayP2P.messages).length>=656,'Malay locale key count must not regress');

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
