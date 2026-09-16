#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function compactProfile(profile){const manifest=profile?.manifest||{};return{tabs:Array.isArray(manifest.tabs)?manifest.tabs:[],preferences:manifest.preferences&&typeof manifest.preferences==='object'?manifest.preferences:{}};}
export function compileQbPreferencesCompact(sourceCatalog){if(!sourceCatalog||sourceCatalog.schemaVersion!==1||!Array.isArray(sourceCatalog.profiles)||!sourceCatalog.profiles.length)throw new Error('Preferences compact compiler requires source catalog schemaVersion 1.');const releases=[],nativeUi=[];let previous;for(const profile of sourceCatalog.profiles){const qbVersion=String(profile?.qbVersion||''),sourceSha=String(profile?.sourceSha||'');if(!qbVersion||!/^[0-9a-f]{40}$/i.test(sourceSha))throw new Error('Preferences compact profile requires exact qbVersion + sourceSha.');releases.push({qbVersion,sourceSha});const value=compactProfile(profile);if(previous===undefined||!same(previous,value)){nativeUi.push({from:qbVersion,value});previous=value;}}return{schemaVersion:1,source:'qb-upstream-preferences-native-surface-compact',releases,nativeUi};}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){try{const input=path.resolve(process.argv[2]||''),output=path.resolve(process.argv[3]||'');if(!input||!fs.existsSync(input)||!output)throw new Error('Usage: node tools/qb-preferences-compact.mjs <source-catalog.json> <output.json>');const source=JSON.parse(fs.readFileSync(input,'utf8')),result=compileQbPreferencesCompact(source);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n','utf8');console.log(`Compiled Preferences compact contract: ${result.releases.length} exact releases, ${result.nativeUi.length} native UI change points.`);}catch(error){console.error(error?.message||error);process.exitCode=1;}}
