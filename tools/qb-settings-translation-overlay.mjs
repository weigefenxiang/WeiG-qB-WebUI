#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractQbSettingsTranslationFacts} from './qb-settings-translation-source.mjs';

function unique(values) {
  const out=[];
  for (const value of values || []) {
    const item=String(value || '').trim();
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

function localeValues(profile) {
  return unique((Array.isArray(profile?.webuiLocales) ? profile.webuiLocales : []).map((item) => typeof item === 'string' ? item : item?.value));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function contentHash(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

export function buildQbSettingsTranslationOverlay(catalog, readTranslationSource, options = {}) {
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('qB Settings translation overlay requires a non-empty exact-release catalog.');
  if (typeof readTranslationSource !== 'function') throw new Error('qB Settings translation overlay requires a source loader.');
  const contexts=Array.isArray(options.contexts) && options.contexts.length ? unique(options.contexts) : ['OptionsDialog'];
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
    const locales=localeValues(profile);
    if (!locales.length) throw new Error(`${qbVersion}: exact WebUI locale facts are unresolved.`);
    const translations={};
    for (const locale of locales) {
      const source=readTranslationSource({profile, qbVersion, sourceSha, tag, locale});
      if (!source) throw new Error(`${qbVersion}: missing official WebUI translation source for ${locale}.`);
      const facts=extractQbSettingsTranslationFacts({qbVersion, sourceSha, locale, translationSource:source, contexts});
      const payload={contexts:facts.contexts,messages:facts.messages};
      const hash=contentHash(payload);
      if (!sets[hash]) sets[hash]=payload;
      else if (stableJson(sets[hash]) !== stableJson(payload)) throw new Error(`Settings translation hash collision: ${hash}`);
      translations[locale]=hash;
    }
    profiles.push({qbVersion,sourceSha,translations});
  }
  return {schema:1,source:'qb-upstream-webui-ts',contexts,profiles,sets};
}

function git(root,...args) {
  return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

function showTranslation(root, tag, locale) {
  const file=`src/webui/www/translations/webui_${locale}.ts`;
  try { return git(root,'show',`${tag}:${file}`); }
  catch { return ''; }
}

export function buildQbSettingsTranslationOverlayFromClone(catalog, qbRoot, options = {}) {
  return buildQbSettingsTranslationOverlay(catalog, ({tag,locale}) => showTranslation(qbRoot,tag,locale), options);
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
    console.log(`Generated exact qB Settings translation overlay for ${overlay.profiles.length} release profiles with ${Object.keys(overlay.sets).length} deduplicated translation sets.`);
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode=1;
  }
}
