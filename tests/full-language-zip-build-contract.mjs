import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildWebuiDist} from '../tools/build-webui-dist.mjs';
import {expectedExtendedLocales,inspectExtendedLocaleSources,canonicalEnglishTranslationKeys,canonicalEnglishSourceSha256,canonicalEnglishMessages} from '../tools/external-weig-locale-assets.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'weig-locale-dist-test-'));
const sourceDir=path.join(scratch,'language-sources'),outDir=path.join(scratch,'output');
const sha='a'.repeat(40),version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
function readEntry(zip,entry){
  const result=spawnSync('unzip',['-p',zip,'weig-qb-webui/'+entry],{encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(result.status,0,'Missing ZIP entry '+entry);
  return result.stdout;
}
try{
  fs.mkdirSync(sourceDir,{recursive:true});
  for(const locale of expectedExtendedLocales){
    const fixture={schemaVersion:1,source:'WeiG-runtime-locale-overlay',locale,
      translationStatus:'approved',englishSourceSha256:canonicalEnglishSourceSha256,
      messages:Object.fromEntries(canonicalEnglishTranslationKeys.map(key=>[key,'Packaging test '+locale+': '+canonicalEnglishMessages[key]])),
      reviewedEnglishFallbackKeys:[]};
    fs.writeFileSync(path.join(sourceDir,locale+'.json'),JSON.stringify(fixture)+'\n');
  }
  const damagedFile=path.join(sourceDir,'ca.json'),validBytes=fs.readFileSync(damagedFile);
  const sparseApproved=JSON.parse(validBytes);
  sparseApproved.messages={'app.back':'Packaging test ca'};
  sparseApproved.reviewedEnglishFallbackKeys=canonicalEnglishTranslationKeys.filter(key=>key!=='app.back');
  fs.writeFileSync(damagedFile,JSON.stringify(sparseApproved));
  assert.throws(()=>inspectExtendedLocaleSources({sourceDir,requireComplete:true}),/10% English fallback/);
  fs.writeFileSync(damagedFile,validBytes);
  const incomplete=JSON.parse(validBytes);
  delete incomplete.reviewedEnglishFallbackKeys;
  fs.writeFileSync(damagedFile,JSON.stringify(incomplete));
  assert.throws(()=>inspectExtendedLocaleSources({sourceDir,requireComplete:true}),/reviewed English fallback/);
  fs.writeFileSync(damagedFile,validBytes);
  fs.writeFileSync(damagedFile,'0'.repeat(5*1024*1024));
  assert.throws(()=>inspectExtendedLocaleSources({sourceDir}),/single-file limit/);
  fs.writeFileSync(damagedFile,validBytes);
  const inspection=inspectExtendedLocaleSources({sourceDir,requireComplete:true});
  assert.equal(inspection.ready,48);
  const built=buildWebuiDist({webuiRoot:path.join(root,'webui'),outDir,sha,version,extendedLocaleDir:sourceDir});
  const allZip=path.join(outDir,'weig-qb-webui-all-languages.zip');
  assert(fs.existsSync(built.zipPath)&&fs.existsSync(allZip));
  const manifest=JSON.parse(fs.readFileSync(path.join(outDir,'manifest.json'),'utf8'));
  const stdLocales=JSON.parse(readEntry(built.zipPath,'private/data/weig-i18n/extended-manifest.json'));
  const allLocales=JSON.parse(readEntry(allZip,'private/data/weig-i18n/extended-manifest.json'));
  assert.deepEqual(stdLocales.locales,[]);
  assert.equal(allLocales.locales.length,48);
  assert.equal(manifest.artifacts.allLanguagesZip.extendedLocaleCount,48);
  assert.equal(readEntry(allZip,'GIT_SHA').trim(),sha);
  assert.equal(readEntry(allZip,'VERSION').trim(),version);
  assert.match(readEntry(allZip,'private/data/weig-i18n/ca.json'),/Packaging test ca/);
  const zipList=spawnSync('unzip',['-Z1',built.zipPath],{encoding:'utf8'});
  assert.equal(zipList.status,0);
  assert(!zipList.stdout.includes('/private/data/weig-i18n/ca.json'));
  const digest=crypto.createHash('sha256').update(fs.readFileSync(allZip)).digest('hex');
  assert.equal(manifest.artifacts.allLanguagesZip.sha256,digest);
  assert.equal(manifest.artifacts.allLanguagesZip.bytes,fs.statSync(allZip).size);
  assert(fs.readFileSync(path.join(outDir,'SHA256SUMS'),'utf8').includes(digest+'  weig-qb-webui-all-languages.zip'));
  console.log('Full ZIP isolated build gate passed: 48 generated test assets, exact identity, manifest and checksum.');
}finally{
  fs.rmSync(scratch,{recursive:true,force:true});
}
