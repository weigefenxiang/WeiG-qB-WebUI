#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=message=>{throw new Error(message);};
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const match=arg.match(/^--([^=]+)=(.*)$/s);
  if(!match)fail(`Invalid argument: ${arg}`);
  return [match[1],match[2]];
}));

const sha=String(args.sha||'').trim().toLowerCase();
const version=String(args.version||'').trim();
const gfmFile=path.resolve(args.gfm||'');
const localeFile=path.resolve(args.locale||'');
if(!/^[0-9a-f]{40}$/.test(sha))fail('--sha must be an exact 40-character hexadecimal commit SHA.');
if(!/^\d+\.\d+\.\d+$/.test(version))fail('--version must be an exact three-component WeiG version.');
if(!args.gfm||!fs.existsSync(gfmFile))fail(`Missing G-FM aggregate evidence: ${args.gfm||'(unset)'}`);
if(!args.locale||!fs.existsSync(localeFile))fail(`Missing Locale aggregate evidence: ${args.locale||'(unset)'}`);

const frozenManifest=readJson(path.join(root,'tools/data/qb-stable-lkg.json'));
const frozenBytes=fs.readFileSync(path.join(root,frozenManifest.catalogPath));
const frozenDigest=sha256(frozenBytes);
if(frozenDigest!==frozenManifest.catalogSha256)fail('Committed Frozen LKG digest does not match its manifest.');
if(frozenManifest.profileCount!==65)fail(`Release-grade G-FM requires 65 Frozen profiles, got ${frozenManifest.profileCount}.`);

const localeLkg=readJson(path.join(root,'tools/data/qb-locale-lkg.json'));
if(localeLkg.profileCount!==65||localeLkg.latestAdmittedStable!==frozenManifest.latestAdmittedStable)fail('Frozen Locale LKG identity diverged from the stable LKG.');
const localeProfile=localeLkg.profiles.find(item=>item.qbVersion===localeLkg.latestAdmittedStable);
const expectedLocales=localeLkg.localeSets[localeProfile?.localeSet]||[];
if(expectedLocales.length!==61)fail(`Current-stable Locale gate requires 61 locales, got ${expectedLocales.length}.`);

const gfm=readJson(gfmFile);
if(gfm.schemaVersion!==1)fail('G-FM schemaVersion must be 1.');
if(gfm.phase!=='G-FM'||gfm.module!=='aggregate'||gfm.status!=='PASS')fail('G-FM aggregate must be a PASS release-grade aggregate.');
if(String(gfm.weig_sha||'').toLowerCase()!==sha)fail('G-FM exact SHA mismatch.');
if(gfm.webui_version!==version)fail('G-FM WeiG VERSION mismatch.');
if(gfm.frozen_catalog_sha256!==frozenDigest)fail('G-FM Frozen catalog digest mismatch.');
if(gfm.expected_stable_count!==65||gfm.executed_runtime_count!==65)fail('G-FM did not execute the exact 65-version Frozen matrix.');
if(gfm.PASS!==65||gfm.FAIL!==0||gfm.BLOCKED!==0)fail('G-FM aggregate is not 65/65 PASS.');
for(const key of ['missing_versions','duplicate_versions','unexpected_runtime_versions']){
  if(!Array.isArray(gfm[key])||gfm[key].length!==0)fail(`G-FM ${key} must be empty.`);
}
if(!Array.isArray(gfm.results)||gfm.results.length!==65)fail('G-FM results length must be 65.');
const seen=new Set();
for(const result of gfm.results){
  const qb=String(result?.qb_version||'');
  if(seen.has(qb))fail(`G-FM duplicate result for qB ${qb}.`);
  seen.add(qb);
  if(result.status!=='PASS')fail(`G-FM qB ${qb} did not PASS.`);
  if(qb!==String(result.runtime_version||''))fail(`G-FM qB ${qb} runtime identity is not exact.`);
  if(!String(result.resolved_image||'').match(/@sha256:[0-9a-f]{64}$/))fail(`G-FM qB ${qb} runtime image is not immutable digest-pinned.`);
}
const frozenCatalog=JSON.parse(frozenBytes);
const expectedVersions=frozenCatalog.map(item=>String(item.qbVersion));
if(expectedVersions.some(qb=>!seen.has(qb)))fail('G-FM results do not cover every Frozen qB version exactly once.');

const locale=readJson(localeFile);
if(locale.schemaVersion!==1)fail('Locale aggregate schemaVersion must be 1.');
if(locale.module!=='real-qb-current-locale-aggregate'||locale.status!=='PASS')fail('Locale aggregate must be PASS.');
if(String(locale.weigSha||'').toLowerCase()!==sha)fail('Locale exact SHA mismatch.');
if(locale.qbVersion!==localeLkg.latestAdmittedStable)fail(`Locale aggregate must target current Frozen stable qB ${localeLkg.latestAdmittedStable}.`);
if(locale.expectedLocales!==expectedLocales.length||locale.passed!==expectedLocales.length)fail(`Locale aggregate must be ${expectedLocales.length}/${expectedLocales.length} PASS.`);
if(!Array.isArray(locale.failures)||locale.failures.length!==0)fail('Locale aggregate contains failures.');

console.log(`Release compatibility evidence PASS: G-FM 65/65 + qB ${locale.qbVersion} Locale ${locale.passed}/${locale.expectedLocales}, exact WeiG SHA ${sha}.`);
