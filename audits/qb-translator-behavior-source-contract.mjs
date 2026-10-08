import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildTranslatorBehaviorEvidence,
  extractTranslatorBehaviorFacts,
  translatorBehaviorFamily,
  validateTranslatorBehaviorFacts
} from '../tools/qb-translator-behavior-source.mjs';

const qappSource=`
void translateDocument(const QString &locale, QString &data)
{
  const QRegularExpression regex("QBT_TR\\\\((x)\\\\)QBT_TR\\\\[CONTEXT=x\\\\]");
  QString translation = qApp->translate(context.toUtf8().constData(), word.toUtf8().constData(), nullptr, 1);
}
void WebApplication::sendFile(const QString &path)
{
  const QMimeType mimeType {QMimeDatabase().mimeTypeForFileNameAndData(path, data)};
  const bool isTranslatable {mimeType.inherits(QLatin1String("text/plain"))};
  if (isTranslatable) translateDocument(locale, data);
}`;

const dedicatedNoFallback=`
void WebApplication::translateDocument(QString &data)
{
  const QRegularExpression regex("QBT_TR\\\\((x)\\\\)QBT_TR\\\\[CONTEXT=x\\\\]");
  QString translation = isTranslationNeeded
    ? m_translator.translate(context.toUtf8().constData(), word.toUtf8().constData(), nullptr, 1)
    : word;
}
void WebApplication::configure()
{
  if (m_translator.load(m_rootFolder + QLatin1String("/translations/webui_") + m_currentLocale)) {}
}
void WebApplication::sendFile(const QString &path)
{
  const QMimeType mimeType {QMimeDatabase().mimeTypeForFileNameAndData(path, data)};
  const bool isTranslatable {mimeType.inherits(QLatin1String("text/plain"))};
  if (isTranslatable) translateDocument(data);
}`;

const dedicatedFallback=`
void WebApplication::translateDocument(QString &data)
{
  const QRegularExpression regex("QBT_TR\\\\((x)\\\\)QBT_TR\\\\[CONTEXT=x\\\\]");
  const QString loadedText = m_translationFileLoaded
    ? m_translator.translate(context.toUtf8().constData(), sourceText.toUtf8().constData())
    : QString();
  QString translation = loadedText.isEmpty() ? sourceText : loadedText;
}
void WebApplication::configure()
{
  m_translationFileLoaded = m_translator.load((m_rootFolder / Path(u"translations/webui_"_s) + newLocale).data());
}
void WebApplication::sendFile(const Path &path)
{
  const QMimeType mimeType = QMimeDatabase().mimeTypeForFileNameAndData(path.data(), data);
  const bool isTranslatable = mimeType.inherits(u"text/plain"_s);
  if (isTranslatable) translateDocument(data);
}`;

const qtStringViewFallback=dedicatedFallback.replace('sourceText : loadedText','sourceText.toString() : loadedText');
const viewFacts=extractTranslatorBehaviorFacts(qtStringViewFallback);
assert.equal(viewFacts.missingTranslationFallback,'explicit-source','Qt QStringView sourceText.toString() requires source-derived fallback semantics');
assert.equal(translatorBehaviorFamily(viewFacts),'dedicated-native-explicit-fallback');

const dedicatedAltDisabled=dedicatedFallback.replace(
  'const bool isTranslatable = mimeType.inherits(u"text/plain"_s);',
  'const bool isTranslatable = !m_isAltUIUsed && mimeType.inherits(u"text/plain"_s);'
);

const qappFacts=extractTranslatorBehaviorFacts(qappSource);
assert.deepEqual(qappFacts,{
  qbtTrParserExists:true,
  translationCall:'qApp->translate',
  translatorResource:'application-installed-translator',
  altWebuiTranslation:true,
  missingTranslationFallback:'qt-application-translator',
  translationMimeRule:'inherits:text/plain'
});
assert.equal(validateTranslatorBehaviorFacts(qappFacts),'qapp-native');

const noFallbackFacts=extractTranslatorBehaviorFacts(dedicatedNoFallback);
assert.equal(noFallbackFacts.translatorResource,'active-webui-root/translations/webui_<locale>.qm');
assert.equal(noFallbackFacts.altWebuiTranslation,true);
assert.equal(noFallbackFacts.missingTranslationFallback,'none-explicit');
assert.equal(translatorBehaviorFamily(noFallbackFacts),'dedicated-native-no-explicit-fallback');

const fallbackFacts=extractTranslatorBehaviorFacts(dedicatedFallback);
assert.equal(fallbackFacts.altWebuiTranslation,true);
assert.equal(fallbackFacts.missingTranslationFallback,'explicit-source');
assert.equal(translatorBehaviorFamily(fallbackFacts),'dedicated-native-explicit-fallback');

const disabledFacts=extractTranslatorBehaviorFacts(dedicatedAltDisabled);
assert.equal(disabledFacts.altWebuiTranslation,false);
assert.equal(translatorBehaviorFamily(disabledFacts),'dedicated-alt-disabled');

assert.throws(
  ()=>validateTranslatorBehaviorFacts(extractTranslatorBehaviorFacts('const bool isTranslatable = true;')),
  /QBT_TR parser not found/,
  'unknown source must fail closed instead of guessing a translator family'
);

const syntheticCatalog=[
  {qbVersion:'4.1.3',tag:'release-4.1.3',sourceSha:'a'.repeat(40)},
  {qbVersion:'4.1.4',tag:'release-4.1.4',sourceSha:'b'.repeat(40)},
  {qbVersion:'4.5.0',tag:'release-4.5.0',sourceSha:'c'.repeat(40)},
  {qbVersion:'4.6.5',tag:'release-4.6.5',sourceSha:'d'.repeat(40)}
];
const sourceByVersion={
  '4.1.3':qappSource,
  '4.1.4':dedicatedNoFallback,
  '4.5.0':dedicatedAltDisabled,
  '4.6.5':dedicatedFallback
};
const evidence=buildTranslatorBehaviorEvidence(syntheticCatalog,({qbVersion})=>sourceByVersion[qbVersion]);
assert.equal(evidence.profileCount,4);
assert.deepEqual(
  evidence.profiles.map(item=>[item.qbVersion,item.family]),
  [
    ['4.1.3','qapp-native'],
    ['4.1.4','dedicated-native-no-explicit-fallback'],
    ['4.5.0','dedicated-alt-disabled'],
    ['4.6.5','dedicated-native-explicit-fallback']
  ]
);
assert.equal(evidence.families['dedicated-alt-disabled'].altWebuiTranslation,false);
assert.equal(evidence.families['dedicated-native-explicit-fallback'].altWebuiTranslation,true);
assert.throws(
  ()=>buildTranslatorBehaviorEvidence([...syntheticCatalog].reverse(),({qbVersion})=>sourceByVersion[qbVersion]),
  /strictly version-sorted/,
  'evidence generation must not silently reorder a malformed admitted catalog'
);

const lkg=JSON.parse(fs.readFileSync(new URL('../tools/data/qb-translator-behavior-lkg.json',import.meta.url),'utf8'));
const admitted=JSON.parse(fs.readFileSync(new URL('../tools/data/qb-stable-lkg.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/qb-release-catalog.lkg.json',import.meta.url),'utf8'));
assert.equal(lkg.schemaVersion,1);
assert.equal(lkg.source,'qB-upstream-src/webui/webapplication.cpp');
assert.equal(lkg.supportFloor,'4.1.0');
assert.equal(lkg.latestAdmittedStable,admitted.latestAdmittedStable);
assert.equal(lkg.profileCount,admitted.profileCount);
assert.equal(lkg.profiles.length,admitted.profileCount);
assert.equal(new Set(lkg.profiles.map(item=>item.qbVersion)).size,admitted.profileCount);
assert.equal(new Set(lkg.profiles.map(item=>item.sourceSha)).size,admitted.profileCount);
assert.equal(catalog.length,admitted.profileCount,'Translator LKG must have one exact source family for every admitted Frozen release');
for(let i=0;i<catalog.length;i++)assert.equal(lkg.profiles[i].qbVersion+'@'+lkg.profiles[i].sourceSha,catalog[i].qbVersion+'@'+catalog[i].sourceSha,'Translator source profile is not the canonical Frozen release '+i);
for(const profile of lkg.profiles){
  assert.match(profile.sourceSha,/^[0-9a-f]{40}$/);
  assert.deepEqual(
    Object.keys(profile).sort(),
    ['family','qbVersion','sourceSha'].sort(),
    'translator LKG stores source identity plus behavior-family binding only, never translation bodies'
  );
}
assert.deepEqual(
  Object.keys(lkg.families).sort(),
  [
    'qapp-native',
    'dedicated-native-no-explicit-fallback',
    'dedicated-native-explicit-fallback',
    'dedicated-alt-disabled'
  ].sort()
);

const byVersion=new Map(lkg.profiles.map(item=>[item.qbVersion,item]));
const behavior=(version)=>lkg.families[byVersion.get(version).family];
assert.equal(byVersion.get('4.1.3').family,'qapp-native');
assert.equal(byVersion.get('4.1.4').family,'dedicated-native-no-explicit-fallback');
assert.equal(byVersion.get('4.1.5').family,'dedicated-native-explicit-fallback');
assert.equal(behavior('4.4.5').altWebuiTranslation,true);
assert.equal(behavior('4.5.0').altWebuiTranslation,false);
assert.equal(behavior('4.6.4').altWebuiTranslation,false);
assert.equal(behavior('4.6.5').altWebuiTranslation,true);
assert.equal(byVersion.get('5.0.0').family,'dedicated-native-explicit-fallback');
assert.equal(byVersion.get('5.2.3').family,'dedicated-native-explicit-fallback');

const historical=lkg.profiles.filter(item=>{
  const row=item.qbVersion.split('.').map(Number),anchor=[5,2,3];
  for(let i=0;i<Math.max(row.length,anchor.length);i++){if((row[i]||0)!==(anchor[i]||0))return (row[i]||0)<(anchor[i]||0);}
  return true;
});
const historicalFamilies=historical.reduce((counts,item)=>{counts[item.family]=(counts[item.family]||0)+1;return counts;},{});
assert.deepEqual(historicalFamilies,{
  'qapp-native':4,
  'dedicated-native-no-explicit-fallback':1,
  'dedicated-native-explicit-fallback':49,
  'dedicated-alt-disabled':11
},'The originally certified 65-release translator behavior prefix must never be silently reclassified');
for(const row of lkg.profiles.slice(historical.length))assert.ok(lkg.families[row.family],'Every later admitted source must reference a reviewed translator family');

console.log(`qB translator behavior source contract passed: ${lkg.profileCount} exact admitted releases; the historical 65-source prefix remains certified and future source families are manifest-bound.`);
