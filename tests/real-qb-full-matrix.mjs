#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const repoRoot=process.env.WEIG_REPO_ROOT?path.resolve(process.env.WEIG_REPO_ROOT):process.cwd();
const norm=v=>String(v??'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sameNumericVersion=(a,b)=>{const aa=norm(a).split('.'),bb=norm(b).split('.');if(!aa.every(x=>/^\d+$/.test(x))||!bb.every(x=>/^\d+$/.test(x)))return norm(a)===norm(b);const n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++)if(Number(aa[i]||0)!==Number(bb[i]||0))return false;return true;};
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=m=>{throw new Error(m);};

function frozen(){
  const manifestPath=path.join(repoRoot,'tools/data/qb-stable-lkg.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const catalogPath=path.join(repoRoot,manifest.catalogPath);
  const bytes=fs.readFileSync(catalogPath);
  const digest=sha256(bytes);
  if(digest!==manifest.catalogSha256)fail(`Frozen LKG digest mismatch: expected ${manifest.catalogSha256}, got ${digest}`);
  const catalog=JSON.parse(bytes);
  if(!Array.isArray(catalog)||catalog.length!==manifest.profileCount)fail(`Frozen LKG profile count mismatch: expected ${manifest.profileCount}, got ${Array.isArray(catalog)?catalog.length:'non-array'}`);
  const versions=catalog.map(x=>norm(x?.qbVersion));
  if(versions.some(v=>!/^[0-9]+(?:\.[0-9]+){2,3}$/.test(v)))fail('Frozen LKG contains an invalid qB version identity.');
  if(new Set(versions).size!==versions.length)fail('Frozen LKG contains duplicate qB versions.');
  if(versions[0]!==norm(manifest.supportFloor)||versions.at(-1)!==norm(manifest.latestAdmittedStable))fail('Frozen LKG boundaries diverged from manifest.');
  return {manifest,catalog,digest,versions};
}

function walk(dir){
  const out=[];
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(file));
    else if(entry.isFile()&&entry.name.endsWith('.json'))out.push(file);
  }
  return out.sort();
}

function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(e){return {__parse_error:String(e?.message||e),__file:file};}
}

function aggregate(dir){
  const f=frozen();
  const docs=walk(dir).map(file=>({file,data:readJson(file)}));
  const runtimeDocs=docs.filter(x=>x.data?.phase==='G-FM'&&x.data?.module==='runtime-resolver');
  const byRuntimeVersion=new Map();
  for(const x of runtimeDocs){
    const v=norm(x.data.expected_qb_version);
    if(!byRuntimeVersion.has(v))byRuntimeVersion.set(v,[]);
    byRuntimeVersion.get(v).push(x);
  }
  const expectedSha=String(process.env.GITHUB_SHA||process.env.WEIG_GIT_SHA||'').trim().toLowerCase();
  const results=[];
  let pass=0,failCount=0,blocked=0;
  const missing=[],duplicates=[];
  for(const version of f.versions){
    const records=byRuntimeVersion.get(version)||[];
    if(records.length===0){missing.push(version);results.push({qb_version:version,status:'FAIL',reason:'missing runtime evidence'});failCount++;continue;}
    if(records.length!==1){duplicates.push(version);results.push({qb_version:version,status:'FAIL',reason:`duplicate runtime evidence: ${records.length}`});failCount++;continue;}
    const runtime=records[0].data;
    let status=String(runtime.status||'FAIL').toUpperCase();
    const issues=[];
    if(!['PASS','FAIL','BLOCKED'].includes(status)){issues.push(`invalid runtime status ${status}`);status='FAIL';}
    if(runtime.frozen_catalog_sha256!==f.digest)issues.push('runtime evidence Frozen catalog digest mismatch');
    if(expectedSha&&String(runtime.weig_sha||'').toLowerCase()!==expectedSha)issues.push('runtime evidence WeiG SHA mismatch');
    if(status==='PASS'){
      if(runtime.cleanup_result!=='PASS')issues.push(`runtime cleanup did not PASS: ${runtime.cleanup_result||'missing'}`);
      const core=docs.filter(x=>x.data?.phase==='G'&&!x.data?.module&&norm(x.data?.qb_version)===version);
      const search=docs.filter(x=>x.data?.phase==='G'&&x.data?.module==='search-lifecycle'&&norm(x.data?.qb_version)===version);
      if(core.length!==1)issues.push(`expected one core semantic evidence, got ${core.length}`);
      if(search.length!==1)issues.push(`expected one Search evidence, got ${search.length}`);
      const profile=f.catalog.find(x=>norm(x.qbVersion)===version);
      for(const [label,list] of [['core',core],['search',search]])for(const item of list){
        const d=item.data;
        if(d.frozen_catalog_sha256!==f.digest)issues.push(`${label} Frozen catalog digest mismatch`);
        if(expectedSha&&String(d.weig_sha||'').toLowerCase()!==expectedSha)issues.push(`${label} WeiG SHA mismatch`);
        if(!sameNumericVersion(d.webapi_version,profile.webApiVersion))issues.push(`${label} WebAPI identity mismatch`);
        if(Number(d.summary?.FAIL||0)!==0)issues.push(`${label} semantic FAIL count is non-zero`);
      }
      if(issues.length)status='FAIL';
    }
    if(status==='PASS')pass++;
    else if(status==='BLOCKED')blocked++;
    else failCount++;
    results.push({
      qb_version:version,
      status,
      provider:runtime.provider||null,
      resolved_image:runtime.resolved_image||null,
      runtime_version:runtime.runtime_version||null,
      issues,
      reason:runtime.reason||null
    });
  }
  const unexpectedRuntime=[...byRuntimeVersion.keys()].filter(v=>!f.versions.includes(v));
  if(unexpectedRuntime.length)failCount+=unexpectedRuntime.length;
  const status=(results.length===f.manifest.profileCount&&missing.length===0&&duplicates.length===0&&unexpectedRuntime.length===0&&pass===f.manifest.profileCount&&failCount===0&&blocked===0)?'PASS':'FAIL';
  const out={
    schemaVersion:1,
    phase:'G-FM',
    module:'aggregate',
    status,
    weig_sha:expectedSha||null,
    webui_version:fs.readFileSync(path.join(repoRoot,'VERSION'),'utf8').trim(),
    frozen_catalog_sha256:f.digest,
    expected_stable_count:f.manifest.profileCount,
    executed_runtime_count:runtimeDocs.length,
    PASS:pass,
    FAIL:failCount,
    BLOCKED:blocked,
    missing_versions:missing,
    duplicate_versions:duplicates,
    unexpected_runtime_versions:unexpectedRuntime,
    results
  };
  const outDir=path.join(repoRoot,'artifacts/real-qb-full-aggregate');
  fs.mkdirSync(outDir,{recursive:true});
  const outFile=path.join(outDir,`${expectedSha||'unknown'}.json`);
  fs.writeFileSync(outFile,`${JSON.stringify(out,null,2)}\n`);
  console.log(`G-FM aggregate evidence: ${path.relative(repoRoot,outFile)}`);
  console.log(JSON.stringify({status,expected:out.expected_stable_count,executed:out.executed_runtime_count,PASS:pass,FAIL:failCount,BLOCKED:blocked,missing:missing.length,duplicates:duplicates.length}));
  if(status!=='PASS')process.exitCode=1;
}

const args=process.argv.slice(2);
const f=frozen();
if(args[0]==='--matrix'){
  process.stdout.write(JSON.stringify(f.versions));
}else if(args[0]==='--assert-version'){
  const version=norm(args[1]);
  if(!f.versions.includes(version))fail(`qB ${version} is not in Frozen LKG.`);
  process.stdout.write(`${version}\n`);
}else if(args[0]==='--aggregate'){
  aggregate(path.resolve(args[1]||path.join(repoRoot,'full-evidence')));
}else{
  fail('Usage: real-qb-full-matrix.mjs --matrix | --assert-version <version> | --aggregate <evidence-dir>');
}
