import crypto from 'node:crypto';
import {parseQtTsTranslationSource} from './qb-settings-translation-source.mjs';
import {canonicalQbDisplayText,canonicalQbRef,qbSourceRefKey} from './qb-source-text.mjs';

const EVIDENCE_SCHEMA_VERSION=1;
const EVIDENCE_SOURCE='qb-official-ts-full-recovery-votes';
const UNION_SOURCE='qb-official-ts-deterministic-recovery-union';

function sha256(value){return crypto.createHash('sha256').update(String(value??''),'utf8').digest('hex');}
function baseLanguage(value){return String(value||'').trim().replace(/-/g,'_').split('_')[0].split('@')[0].toLowerCase();}
function releaseParts(version){
  const value=String(version||'').trim();
  if(!/^\d+(?:\.\d+)+$/.test(value))throw new Error(`Invalid exact qB stable version: ${value||'(empty)'}.`);
  return value.split('.').map((part)=>Number.parseInt(part,10));
}
export function compareQbStableVersions(a,b){
  const left=releaseParts(a),right=releaseParts(b),length=Math.max(left.length,right.length);
  for(let i=0;i<length;i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return delta;}
  return 0;
}
function normalizeTranslation(value,numerus){
  if(numerus){
    if(!Array.isArray(value)||!value.length||value.some(item=>!canonicalQbDisplayText(item)))throw new Error('Numerus recovery vote requires non-empty plural forms.');
    return value.map(item=>canonicalQbDisplayText(item));
  }
  if(Array.isArray(value))throw new Error('Scalar recovery vote cannot contain plural forms.');
  const text=canonicalQbDisplayText(value);if(!text)throw new Error('Recovery vote translation must not be empty.');return text;
}
function translationKey(value,numerus){return `${numerus?'1':'0'}\u0000${JSON.stringify(normalizeTranslation(value,numerus))}`;}
const messageKey=qbSourceRefKey;
function releaseKey(item){return `${item.qbVersion}\u0000${item.sourceSha}\u0000${item.locale}`;}
function compareText(a,b){const left=String(a),right=String(b);return left<right?-1:left>right?1:0;}
function compareMessage(a,b){return compareText(a.context,b.context)||compareText(a.source,b.source);}
function compareRelease(a,b){return compareQbStableVersions(a.qbVersion,b.qbVersion)||compareText(a.sourceSha,b.sourceSha)||compareText(a.locale,b.locale);}
function compareCandidate(a,b){
  return b.count-a.count
    || compareQbStableVersions(b.latestQbVersion,a.latestQbVersion)
    || compareText(translationKey(a.translation,a.numerus),translationKey(b.translation,b.numerus));
}
function assertEvidence(evidence){
  if(!evidence||evidence.schemaVersion!==EVIDENCE_SCHEMA_VERSION||evidence.source!==EVIDENCE_SOURCE||!Array.isArray(evidence.releases)||!Array.isArray(evidence.locales))throw new Error('Invalid qB native QM recovery evidence.');
}
function addCandidate(target,candidate){
  const key=translationKey(candidate.translation,candidate.numerus===true);
  const current=target.get(key);
  if(!current){target.set(key,{translation:normalizeTranslation(candidate.translation,candidate.numerus===true),numerus:candidate.numerus===true,count:Number(candidate.count)||0,latestQbVersion:String(candidate.latestQbVersion||'')});return;}
  current.count+=(Number(candidate.count)||0);
  if(compareQbStableVersions(candidate.latestQbVersion,current.latestQbVersion)>0)current.latestQbVersion=String(candidate.latestQbVersion);
}
function normalizeAggregate(releases,localeMaps){
  const locales=[];
  for(const locale of [...localeMaps.keys()].sort(compareText)){
    const messages=[];
    for(const entry of [...localeMaps.get(locale).values()].sort(compareMessage)){
      const candidates=[...entry.candidates.values()].sort(compareCandidate);
      messages.push({context:entry.context,source:entry.source,candidates});
    }
    locales.push({locale,messages});
  }
  return{schemaVersion:EVIDENCE_SCHEMA_VERSION,source:EVIDENCE_SOURCE,releases:[...releases].sort(compareRelease),locales};
}
function aggregateEvidence(evidences){
  const releases=[],releaseIds=new Set(),versionShas=new Map(),localeMaps=new Map();
  for(const evidence of evidences){
    assertEvidence(evidence);
    const evidenceVersionsByLocale=new Map();
    for(const release of evidence.releases){
      const qbVersion=String(release?.qbVersion||'').trim(),sourceSha=String(release?.sourceSha||'').trim(),locale=String(release?.locale||'').trim(),translationSourceSha256=String(release?.translationSourceSha256||'');
      releaseParts(qbVersion);
      if(!/^[0-9a-f]{40}$/.test(sourceSha)||!locale)throw new Error(`${qbVersion||'unknown'}: recovery release requires exact sourceSha + locale.`);
      if(!/^[0-9a-f]{64}$/.test(translationSourceSha256))throw new Error(`${qbVersion} ${locale}: recovery release requires exact official TS SHA-256.`);
      const bound=versionShas.get(qbVersion);
      if(bound&&bound!==sourceSha)throw new Error(`${qbVersion}: conflicting exact source SHA in recovery evidence.`);
      versionShas.set(qbVersion,sourceSha);
      const identity=releaseKey({qbVersion,sourceSha,locale});
      if(releaseIds.has(identity))throw new Error(`${qbVersion} ${locale}: duplicate exact recovery release evidence.`);
      releaseIds.add(identity);
      const versions=evidenceVersionsByLocale.get(locale)||new Set();versions.add(qbVersion);evidenceVersionsByLocale.set(locale,versions);
      releases.push({qbVersion,sourceSha,locale,sourceLanguage:release.sourceLanguage||null,translationSourceSha256});
    }
    for(const localeEntry of evidence.locales){
      const locale=String(localeEntry?.locale||'').trim();if(!locale)throw new Error('Recovery evidence locale must not be empty.');
      let byMessage=localeMaps.get(locale);if(!byMessage){byMessage=new Map();localeMaps.set(locale,byMessage);}
      for(const message of localeEntry.messages||[]){
        const canonical=canonicalQbRef(message);if(!canonical)throw new Error(`${locale}: recovery message requires context + source.`);const {context,source}=canonical;
        const identity=messageKey(context,source);let target=byMessage.get(identity);if(!target){target={context,source,candidates:new Map()};byMessage.set(identity,target);}
        for(const candidate of message.candidates||[]){
          const latestQbVersion=String(candidate?.latestQbVersion||'');releaseParts(latestQbVersion);
          if(!evidenceVersionsByLocale.get(locale)?.has(latestQbVersion))throw new Error(`${locale} ${context}/${source}: recovery vote latest release is not present in its evidence shard.`);
          if(!Number.isInteger(Number(candidate?.count))||Number(candidate.count)<1)throw new Error(`${locale} ${context}/${source}: recovery vote count must be a positive integer.`);
          addCandidate(target.candidates,{...candidate,latestQbVersion,count:Number(candidate.count)});
        }
      }
    }
  }
  return normalizeAggregate(releases,localeMaps);
}

export function buildQbNativeQmRecoveryEvidence(entries){
  if(!Array.isArray(entries)||!entries.length)throw new Error('qB native QM recovery evidence requires at least one exact release/locale source.');
  const releases=[],releaseIds=new Set(),versionShas=new Map(),localeMaps=new Map();
  for(const entry of entries){
    const qbVersion=String(entry?.qbVersion||'').trim(),sourceSha=String(entry?.sourceSha||'').trim(),locale=String(entry?.locale||'').trim(),translationSource=String(entry?.translationSource||'');
    releaseParts(qbVersion);
    if(!/^[0-9a-f]{40}$/.test(sourceSha)||!locale||!translationSource)throw new Error(`${qbVersion||'unknown'}: recovery source requires exact sourceSha + locale + official TS source.`);
    const bound=versionShas.get(qbVersion);if(bound&&bound!==sourceSha)throw new Error(`${qbVersion}: conflicting exact source SHA in recovery sources.`);versionShas.set(qbVersion,sourceSha);
    const identity=releaseKey({qbVersion,sourceSha,locale});if(releaseIds.has(identity))throw new Error(`${qbVersion} ${locale}: duplicate exact recovery source.`);releaseIds.add(identity);
    const parsed=parseQtTsTranslationSource(translationSource);
    if(parsed.language&&baseLanguage(parsed.language)!==baseLanguage(locale))throw new Error(`${qbVersion} ${locale}: official TS language mismatch (${parsed.language}).`);
    releases.push({qbVersion,sourceSha,locale,sourceLanguage:parsed.language||null,translationSourceSha256:sha256(translationSource)});
    let byMessage=localeMaps.get(locale);if(!byMessage){byMessage=new Map();localeMaps.set(locale,byMessage);}
    for(const message of parsed.messages){
      if(!message?.context||!message?.source)continue;
      const canonical=canonicalQbRef(message);if(!canonical)continue;const msgIdentity=messageKey(canonical.context,canonical.source);let target=byMessage.get(msgIdentity);if(!target){target={context:canonical.context,source:canonical.source,candidates:new Map()};byMessage.set(msgIdentity,target);}
      addCandidate(target.candidates,{translation:message.translation,numerus:message.numerus===true,count:1,latestQbVersion:qbVersion});
    }
  }
  return normalizeAggregate(releases,localeMaps);
}

export function mergeQbNativeQmRecoveryEvidence(evidences){
  if(!Array.isArray(evidences)||!evidences.length)throw new Error('At least one qB native QM recovery evidence shard is required.');
  return aggregateEvidence(evidences);
}

export function validateQbNativeQmRecoveryUnion(union){
  if(!union||union.schemaVersion!==1||union.source!==UNION_SOURCE||!union.locales||typeof union.locales!=='object'||Array.isArray(union.locales))throw new Error('Invalid qB native QM recovery union.');
  for(const [locale,messages] of Object.entries(union.locales)){
    if(!String(locale||'').trim()||!Array.isArray(messages))throw new Error('qB recovery union contains an invalid locale payload.');
    const seen=new Set();
    for(const item of messages){
      const canonical=canonicalQbRef(item);if(!canonical)throw new Error(`${locale}: recovery union message requires context + source.`);
      if(canonical.context!==String(item.context)||canonical.source!==String(item.source))throw new Error(`${locale}: recovery union message must use canonical context/source: ${String(item.context)}/${String(item.source)}.`);
      const identity=messageKey(canonical.context,canonical.source);if(seen.has(identity))throw new Error(`${locale}: duplicate canonical recovery union message ${canonical.context}/${canonical.source}.`);seen.add(identity);
      normalizeTranslation(item.translation,item.numerus===true);
    }
  }
  return union;
}
export function materializeQbNativeQmRecoveryUnion(evidence){
  assertEvidence(evidence);
  const locales={};
  for(const localeEntry of evidence.locales){
    const messages=[];
    for(const message of localeEntry.messages||[]){
      if(!Array.isArray(message.candidates)||!message.candidates.length)throw new Error(`${localeEntry.locale} ${message.context}/${message.source}: recovery message has no votes.`);
      const winner=[...message.candidates].sort(compareCandidate)[0];
      messages.push({context:String(message.context),source:String(message.source),translation:normalizeTranslation(winner.translation,winner.numerus===true),numerus:winner.numerus===true});
    }
    messages.sort(compareMessage);
    locales[String(localeEntry.locale)]=messages;
  }
  return validateQbNativeQmRecoveryUnion({schemaVersion:1,source:UNION_SOURCE,locales});
}
