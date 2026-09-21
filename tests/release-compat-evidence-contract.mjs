#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
const catalogText=fs.readFileSync(path.join(root,manifest.catalogPath),'utf8').replace(/\r\n?/g,'\n');
const catalogBytes=Buffer.from(catalogText,'utf8');
const catalog=JSON.parse(catalogText);
const frozenDigest=crypto.createHash('sha256').update(catalogBytes).digest('hex');
const localeLkg=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-locale-lkg.json'),'utf8'));
const latestLocaleProfile=localeLkg.profiles.find(row=>row.qbVersion===localeLkg.latestAdmittedStable);
const localeCount=localeLkg.localeSets[latestLocaleProfile.localeSet].length;
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const sha='0123456789abcdef0123456789abcdef01234567';
const digest='a'.repeat(64);

assert.equal(catalog.length,65,'synthetic release evidence contract expects the current 65-version Frozen catalog');
assert.equal(localeCount,61,'synthetic release evidence contract expects the current 61-locale latest stable surface');
assert.equal(frozenDigest,manifest.catalogSha256,'LF-canonical Frozen catalog digest must match its manifest before synthesizing evidence');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-release-compat-'));
const gfmPath=path.join(tmp,'gfm.json');
const localePath=path.join(tmp,'locale.json');
const verifier=path.join(root,'tests/release-compat-evidence.mjs');
const clone=value=>JSON.parse(JSON.stringify(value));

const validGfm={
  schemaVersion:1,
  phase:'G-FM',
  module:'aggregate',
  status:'PASS',
  weig_sha:sha,
  webui_version:version,
  frozen_catalog_sha256:frozenDigest,
  expected_stable_count:65,
  executed_runtime_count:65,
  PASS:65,
  FAIL:0,
  BLOCKED:0,
  missing_versions:[],
  duplicate_versions:[],
  unexpected_runtime_versions:[],
  results:catalog.map(row=>({
    qb_version:String(row.qbVersion),
    status:'PASS',
    provider:'synthetic-contract',
    resolved_image:`synthetic/qb@sha256:${digest}`,
    runtime_version:String(row.qbVersion),
    issues:[],
    reason:null
  }))
};
const validLocale={
  schemaVersion:1,
  module:'real-qb-current-locale-aggregate',
  status:'PASS',
  qbVersion:localeLkg.latestAdmittedStable,
  weigSha:sha,
  expectedLocales:localeCount,
  passed:localeCount,
  failures:[],
  testTime:'synthetic-contract'
};

const write=(gfm,locale)=>{
  fs.writeFileSync(gfmPath,`${JSON.stringify(gfm)}\n`);
  fs.writeFileSync(localePath,`${JSON.stringify(locale)}\n`);
};
const run=()=>spawnSync(process.execPath,[verifier,`--gfm=${gfmPath}`,`--locale=${localePath}`,`--sha=${sha}`,`--version=${version}`],{
  cwd:root,
  encoding:'utf8'
});
const expectPass=(gfm=validGfm,locale=validLocale)=>{
  write(gfm,locale);
  const result=run();
  assert.equal(result.status,0,`valid release compatibility evidence must pass:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout,/Release compatibility evidence PASS: G-FM 65\/65/);
};
const expectFail=(label,gfm,locale,pattern)=>{
  write(gfm,locale);
  const result=run();
  assert.notEqual(result.status,0,`${label} must fail closed`);
  assert.match(`${result.stdout}\n${result.stderr}`,pattern,`${label} must report the expected rejection`);
};

try{
  expectPass();

  const wrongSha=clone(validGfm);
  wrongSha.weig_sha='f'.repeat(40);
  expectFail('wrong G-FM SHA',wrongSha,validLocale,/G-FM exact SHA mismatch/);

  const wrongRuntime=clone(validGfm);
  wrongRuntime.results[0].runtime_version='9.9.9';
  expectFail('inexact qB runtime identity',wrongRuntime,validLocale,/runtime identity is not exact/);

  const mutableImage=clone(validGfm);
  mutableImage.results[0].resolved_image='synthetic/qb:latest';
  expectFail('mutable runtime image',mutableImage,validLocale,/runtime image is not immutable digest-pinned/);

  const incompleteLocale=clone(validLocale);
  incompleteLocale.passed=localeCount-1;
  expectFail('incomplete Locale aggregate',validGfm,incompleteLocale,/Locale aggregate must be 61\/61 PASS/);

  const wrongLocaleSha=clone(validLocale);
  wrongLocaleSha.weigSha='e'.repeat(40);
  expectFail('wrong Locale SHA',validGfm,wrongLocaleSha,/Locale exact SHA mismatch/);

  console.log('Release compatibility evidence behavioral contract passed: valid exact-SHA G-FM 65/65 + Locale 61/61 is accepted; SHA, qB identity, immutable runtime digest and Locale completeness mutations all fail closed.');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
