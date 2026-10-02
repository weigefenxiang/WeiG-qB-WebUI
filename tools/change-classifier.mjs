import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const normalizePath=value=>String(value||'').trim().replaceAll('\\','/').replace(/^\.\//,'');
const any=(paths,predicate)=>paths.some(predicate);
const starts=(path,prefix)=>path.startsWith(prefix);
const isMarkdown=path=>path.endsWith('.md');

export function isDocsOnlyPath(path){
  path=normalizePath(path);
  return starts(path,'docs/')||isMarkdown(path)||path==='LICENSE';
}

export function isPagesLiveVerifierPath(path){
  path=normalizePath(path);
  return /^tests\/pages-live-.*\.mjs$/.test(path);
}

export function isSettingsSourcePath(path){
  path=normalizePath(path);
  return /^tools\/qb-settings-.*\.mjs$/.test(path)
    || /^tools\/qb-locale-.*\.mjs$/.test(path)
    || /^tools\/qb-release-catalog.*\.mjs$/.test(path)
    || [
      'tools/qb-native-qm-recovery.mjs',
      'tools/qb-owned-ui-source.mjs',
      'tools/qb-preference-semantics.mjs',
      'tools/qb-qm-provisioning-source.mjs',
      'tools/qb-source-parsers.mjs',
      'tools/qb-cpp-literals.mjs',
      'tools/qb-webui-catalog.mjs',
      'tools/data/qb-stable-lkg.json',
      'tools/data/qb-locale-lkg.json',
      'tools/data/qb-translator-behavior-lkg.json',
      'tests/fixtures/qb-release-catalog.lkg.json'
    ].includes(path);
}

export function isNativeSourcePath(path){
  path=normalizePath(path);
  return [
    'tools/qb-detail-surface-parsers.mjs',
    'tools/qb-release-torrent-surface.mjs',
    'tools/qb-statistics-source.mjs',
    'tools/qb-torrent-fields-parser.mjs',
    'tools/qb-translator-behavior-source.mjs'
  ].includes(path)
    || /^tests\/qb-(?:detail|torrent|statistics|tracker)-.*\.mjs$/.test(path);
}

export function isInstallerPath(path){
  path=normalizePath(path);
  return starts(path,'installers/')
    || /^tests\/(?:installer|a38-installer)-.*\.(?:mjs|sh|ps1)$/.test(path);
}

export function isSettingsUiPath(path){
  path=normalizePath(path);
  return [
    'webui/private/scripts/settings.js',
    'webui/private/scripts/settings-schema.js',
    'webui/private/scripts/session.js',
    'webui/private/scripts/i18n.js',
    'webui/private/data/settings-compat.json',
    'webui/private/data/qb-settings-native.txt'
  ].includes(path)
    || starts(path,'webui/translations/')
    || /^tests\/(?:settings|native-webui-return|locale|qb-preference|browser-settings)-.*\.mjs$/.test(path);
}

export function isUiPath(path){
  path=normalizePath(path);
  return starts(path,'webui/')
    || /^tests\/browser-.*\.mjs$/.test(path)
    || /^tests\/pages-live-.*\.mjs$/.test(path)
    || /^tests\/(?:theme|navigation|feedback|logs-ui|torrent-workspace|sidebar-layout|telemetry-visual|transfer-session-layout|mobile-).*\.mjs$/.test(path);
}

export function isPagesPayloadPath(path){
  path=normalizePath(path);
  if([
    '.github/workflows/pages-source.yml',
    '.github/workflows/pages.yml',
    '.github/workflows/ci.yml',
    '.github/workflows/session-handshake.yml',
    'tests/real-qb-session-race.sh',
    'tests/real-qb-full-runner.sh',
    'tests/real-qb-full-provider-lib.sh',
    'tests/ci-contract.mjs',
    'tests/qb-runtime-copy-materialization-contract.mjs',
    'VERSION',
    'tools/build-webui-dist.mjs',
    'tools/product-identity.mjs'
  ].includes(path))return true;
  return starts(path,'webui/')
    || starts(path,'simulator/')
    || starts(path,'installers/')
    || isSettingsSourcePath(path)
    || isNativeSourcePath(path);
}

export function classifyChangedPaths(values){
  const paths=[...new Set((values||[]).map(normalizePath).filter(Boolean))].sort();
  const docsOnly=paths.length>0&&paths.every(isDocsOnlyPath);
  const result={
    paths,
    changed:paths.length>0,
    docsOnly,
    ciRelevant:paths.length===0||!docsOnly,
    pagesPayload:any(paths,isPagesPayloadPath),
    pagesLive:any(paths,isPagesLiveVerifierPath),
    installer:any(paths,isInstallerPath),
    ui:any(paths,isUiPath),
    settingsUi:any(paths,isSettingsUiPath),
    settingsSource:any(paths,isSettingsSourcePath),
    nativeSource:any(paths,isNativeSourcePath),
    workflowPolicy:any(paths,path=>starts(path,'.github/workflows/')||path==='tools/change-classifier.mjs'||path==='tests/change-classifier-contract.mjs')
  };
  result.pagesRelevant=result.pagesPayload||result.pagesLive;
  result.fast=result.ciRelevant;
  return result;
}

function parseCli(argv){
  return{
    stdin0:argv.includes('--stdin0'),
    pretty:argv.includes('--pretty'),
    has:(argv.find(value=>value.startsWith('--has='))||'').slice('--has='.length)
  };
}

const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){
  const options=parseCli(process.argv.slice(2));
  const input=fs.readFileSync(0);
  const text=input.toString('utf8');
  const paths=options.stdin0?text.split('\0'):text.split(/\r?\n/);
  const result=classifyChangedPaths(paths);
  if(options.has){
    if(!(options.has in result))throw new Error('Unknown classifier field: '+options.has);
    process.exit(result[options.has]?0:1);
  }
  process.stdout.write(JSON.stringify(result,null,options.pretty?2:0)+'\n');
}
