import assert from 'node:assert/strict';
import {appendTranslatorBehaviorEvidence} from '../tools/qb-translator-behavior-append.mjs';
const old=[{qbVersion:'5.2.3',tag:'release-5.2.3',sourceSha:'a'.repeat(40),stable:true,officialWeiGSupport:true}];
const next=[...structuredClone(old),{qbVersion:'5.2.4',tag:'release-5.2.4',sourceSha:'b'.repeat(40),stable:true,officialWeiGSupport:true}];
const source=`void WebApplication::translateDocument(QString &data){
 const QString loadedText=m_translator.translate(nullptr,nullptr);
 QString translation=loadedText.isEmpty() ? sourceText.toString() : loadedText;
 QBT_TR(x)QBT_TR[CONTEXT=x]
}
void WebApplication::configure(){m_translator.load((m_rootFolder/Path(u"translations/webui_"_s)+newLocale).data());}
void WebApplication::sendFile(){const bool isTranslatable=mimeType.inherits(u"text/plain"_s);}`;
const family={qbtTrParserExists:true,translationCall:'m_translator.translate',translatorResource:'active-webui-root/translations/webui_<locale>.qm',altWebuiTranslation:true,missingTranslationFallback:'explicit-source',translationMimeRule:'inherits:text/plain'};
const lkg={schemaVersion:1,supportFloor:'5.2.3',latestAdmittedStable:'5.2.3',profileCount:1,families:{'dedicated-native-explicit-fallback':family},profiles:[{qbVersion:'5.2.3',sourceSha:'a'.repeat(40),family:'dedicated-native-explicit-fallback'}]};
const observed=[];
const result=appendTranslatorBehaviorEvidence(old,next,lkg,release=>{observed.push(release.qbVersion);return source;});
assert.equal(result.profileCount,2);
assert.deepEqual(observed,['5.2.4'],'Historical translator source must never be re-extracted');
assert.deepEqual(result.profiles[0],lkg.profiles[0],'Certified translator prefix must remain byte-semantic invariant');
assert.equal(result.profiles[1].family,'dedicated-native-explicit-fallback');
assert.equal(result.profiles[1].sourceSha,'b'.repeat(40));
assert.deepEqual(lkg.profiles,[{qbVersion:'5.2.3',sourceSha:'a'.repeat(40),family:'dedicated-native-explicit-fallback'}],'Appending must not mutate original evidence');
assert.throws(()=>appendTranslatorBehaviorEvidence(old,next,{...lkg,profiles:[{...lkg.profiles[0],sourceSha:'c'.repeat(40)}]},()=>source),/prefix mismatch/);
assert.throws(()=>appendTranslatorBehaviorEvidence(old,next,lkg,()=>source.replace('m_translator.translate','unprovenTranslator.translate')),/translation call path unresolved|New official translator family/);
console.log('Translator behavior append contract passed: exact immutable historical prefix, new-source-only extraction and semantic-family proof.');
