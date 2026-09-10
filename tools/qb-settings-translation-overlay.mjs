#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractQbPreferenceUiFacts,extractQbSettingsTranslationFacts,translationSourcesForPreferenceUi} from './qb-settings-translation-source.mjs';

function unique(values) {
  const out=[];
  for (const value of values || []) {
    const item=String(value || '').trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}
function localeValues(profile) { return unique((Array.isArray(profile?.webuiLocales) ? profile.webuiLocales : []).map((item) => typeof item === 'string' ? item : item?.value)); }
function languageBase(value) { return String(value || '').trim().replace('-', '_').split('_')[0].toLowerCase(); }
function stableJson(value) { return JSON.stringify(value); }
function contentHash(value) { return crypto.createHash('sha256').update(stableJson(value)).digest('hex'); }
function englishSourceMessages(preferences) {
  const out=[];
  const seen=new Set();
  for (const item of Object.values(preferences || {})) {
    for (const ref of [item?.title,item?.description]) {
      if (!ref?.source || !ref?.context) continue;
      const identity=`${ref.context}\u0000${ref.source}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      out.push({context:ref.context,source:ref.source,comment:null,translation:ref.source,numerus:false});
    }
  }
  return out;
}

export function buildQbSettingsTranslationOverlay(catalog, readReleaseSources) {
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('qB Settings translation overlay requires a non-empty exact-release catalog.');
  if (typeof readReleaseSources !== 'function') throw new Error('qB Settings translation overlay requires an exact-release source loader.');
  const profiles=[];
  const sets={};
  const seen=new Set();
  for (const profile of catalog) {
    const qbVersion=String(profile?.qbVersion || '').trim();
    const sourceSha=String(profile?.sourceSha || '').trim();
    const tag=String(profile?.tag || (qbVersion ? `release-${qbVersion}` : '')).trim();
    if (!qbVersion || !sourceSha || !tag) throw new Error('Each qB Settings translation profile must bind qbVersion + sourceSha + tag.');
    const identity=`${qbVersion}\u0000${sourceSha}`;
    if (seen.has(identity)) throw new Error(`Duplicate qB Settings translation profile identity: ${qbVersion} ${sourceSha}`);
    seen.add(identity);
    const releaseSources=readReleaseSources({profile,qbVersion,sourceSha,tag}) || {};
    const preferenceKeys=(profile.preferenceDescriptors || []).map((item) => item?.key).filter(Boolean);
    const preferences=extractQbPreferenceUiFacts(releaseSources.preferencesSource || '', preferenceKeys);
    const sourceStrings=translationSourcesForPreferenceUi(preferences);
    const contexts=unique(Object.values(preferences).flatMap((item) => [item?.title?.context,item?.description?.context]).filter(Boolean));
    const locales=localeValues(profile);
    if (!locales.length) throw new Error(`${qbVersion}: exact WebUI locale facts are unresolved.`);
    const translations={};
    for (const locale of locales) {
      const source=typeof releaseSources.translationSource === 'function' ? releaseSources.translationSource(locale) : '';
      let payload;
      if (!source && languageBase(locale) === 'en') {
        payload={messages:englishSourceMessages(preferences)};
      }
      else {
        if (!source) throw new Error(`${qbVersion}: missing official WebUI translation source for ${locale}.`);
        const facts=extractQbSettingsTranslationFacts({qbVersion,sourceSha,locale,translationSource:source,contexts,sources:sourceStrings});
        payload={messages:facts.messages};
      }
      const hash=contentHash(payload);
      if (!sets[hash]) sets[hash]=payload;
      else if (stableJson(sets[hash]) !== stableJson(payload)) throw new Error(`Settings translation hash collision: ${hash}`);
      translations[locale]=hash;
    }
    profiles.push({qbVersion,sourceSha,source:'qb-upstream-preferences-ui',mappedPreferences:Object.keys(preferences).length,totalPreferences:preferenceKeys.length,preferences,translations});
  }
  return {schemaVersion:1,source:'qb-upstream-preferences-ui+webui-ts',profiles,sets};
}

export function applyQbSettingsTranslationOverlay(catalog, overlay) {
  if (!Array.isArray(catalog)) throw new Error('qB release catalog must be an array.');
  if (!overlay || overlay.schemaVersion !== 1 || !Array.isArray(overlay.profiles) || !overlay.sets) throw new Error('Invalid qB Settings translation overlay.');
  const overlayByIdentity=new Map(overlay.profiles.map((item)=>[`${item.qbVersion}\u0000${item.sourceSha}`,item]));
  const emitted=new Set();
  return catalog.map((profile)=>{
    const identity=`${profile?.qbVersion || ''}\u0000${profile?.sourceSha || ''}`;
    const item=overlayByIdentity.get(identity);
    if (!item) throw new Error(`${profile?.qbVersion || 'unknown'}: missing exact Settings translation overlay profile.`);
    const localSets={};
    for (const hash of Object.values(item.translations || {})) {
      if (emitted.has(hash)) continue;
      if (!overlay.sets[hash]) throw new Error(`${profile.qbVersion}: missing Settings translation set ${hash}.`);
      emitted.add(hash);
      localSets[hash]=overlay.sets[hash];
    }
    return {
      ...profile,
      settingsUiSource:item.source,
      settingsUiMappedPreferences:item.mappedPreferences,
      settingsUiTotalPreferences:item.totalPreferences,
      settingsUi:item.preferences,
      settingsTranslations:item.translations,
      ...(Object.keys(localSets).length ? {settingsTranslationSets:localSets} : {})
    };
  });
}

function git(root,...args) { return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
function showMaybe(root,tag,file) { try { return git(root,'show',`${tag}:${file}`); } catch { return ''; } }
function preferencesSource(root,tag) { return showMaybe(root,tag,'src/webui/www/private/views/preferences.html') || showMaybe(root,tag,'src/webui/www/private/preferences_content.html'); }
function showTranslation(root,tag,locale) { return showMaybe(root,tag,`src/webui/www/translations/webui_${locale}.ts`); }
export function buildQbSettingsTranslationOverlayFromClone(catalog,qbRoot) {
  return buildQbSettingsTranslationOverlay(catalog,({tag})=>({preferencesSource:preferencesSource(qbRoot,tag),translationSource:(locale)=>showTranslation(qbRoot,tag,locale)}));
}

const isMain=process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const qbRoot=path.resolve(process.argv[2] || process.env.QB_UPSTREAM_DIR || '');
    const catalogPath=path.resolve(process.argv[3] || '');
    const outputPath=path.resolve(process.argv[4] || '');
    if (!qbRoot || !fs.existsSync(qbRoot) || !catalogPath || !fs.existsSync(catalogPath) || !outputPath) throw new Error('Usage: node tools/qb-settings-translation-overlay.mjs <qBittorrent-clone> <catalog.json> <output.json>');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    const overlay=buildQbSettingsTranslationOverlayFromClone(catalog,qbRoot);
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});
    fs.writeFileSync(outputPath,JSON.stringify(overlay,null,2)+'\n','utf8');
    const mapped=overlay.profiles.reduce((sum,item)=>sum+item.mappedPreferences,0),total=overlay.profiles.reduce((sum,item)=>sum+item.totalPreferences,0);
    console.log(`Generated exact qB Settings translation overlay for ${overlay.profiles.length} releases; source-proven preference labels ${mapped}/${total}; deduplicated translation sets ${Object.keys(overlay.sets).length}.`);
  } catch (error) { console.error(error?.message || error); process.exitCode=1; }
}
