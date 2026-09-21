#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),input=process.argv[2]||'full-evidence',sha=process.env.GITHUB_SHA||'';
if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('Exact GITHUB_SHA is required.');
const lkg=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-locale-lkg.json'),'utf8'));
const version=String(lkg.latestAdmittedStable||'');
const profile=lkg.profiles.find(item=>item.qbVersion===version);
if(!profile)throw new Error(`Frozen latest stable profile is missing: ${version}`);
const expected=[...(lkg.localeSets[profile.localeSet]||[])];
if(version==='5.2.3'&&expected.length!==61)throw new Error(`Expected 61 qB 5.2.3 locales, got ${expected.length}.`);
function walk(dir,out=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p,out);else if(entry.name.endsWith('.json'))out.push(p);}return out;}
const evidence=walk(path.resolve(input)).map(file=>JSON.parse(fs.readFileSync(file,'utf8'))).filter(item=>item.module==='real-qb-current-locale'&&item.qbVersion===version&&item.weigSha===sha);
const byLocale=new Map();
for(const item of evidence){
  if(byLocale.has(item.locale))throw new Error(`Duplicate locale evidence: ${item.locale}`);
  byLocale.set(item.locale,item);
}
const failures=[];
for(const locale of expected){
  const item=byLocale.get(locale);
  if(!item)failures.push(`${locale}: missing`);
  else if(item.status!=='PASS')failures.push(`${locale}: ${item.status} ${item.reason||''}`.trim());
  else if(item.restored!==true)failures.push(`${locale}: initial locale was not restored`);
  else if(item.liveLocalePresent!==true)failures.push(`${locale}: not proven by live LANGUAGE_OPTIONS`);
}
for(const locale of byLocale.keys())if(!expected.includes(locale))failures.push(`${locale}: unexpected locale evidence`);
const out={schemaVersion:1,module:'real-qb-current-locale-aggregate',status:failures.length?'FAIL':'PASS',qbVersion:version,weigSha:sha,expectedLocales:expected.length,passed:expected.length-failures.length,failures,testTime:new Date().toISOString()};
const dir=path.join(root,'artifacts/real-qb-locale-aggregate');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${sha}.json`),`${JSON.stringify(out,null,2)}\n`);
if(failures.length)throw new Error(`qB ${version} locale matrix failed:\n${failures.join('\n')}`);
console.log(`qB ${version} real locale matrix PASS: ${expected.length}/${expected.length}, every target present in live LANGUAGE_OPTIONS and original locale restored.`);
