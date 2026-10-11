import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const repository=process.env.GITHUB_REPOSITORY;
const sha=process.env.GITHUB_SHA;
const token=process.env.GH_TOKEN;
const base='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev';
const root=join(process.env.RUNNER_TEMP||'/tmp','weig-a73-release');
const tag='dev-A73';
const names=['weig-qb-webui.zip','weig-qb-webui-A73.zip','weig-qb-webui.tar.gz','install.sh','install.ps1','manifest.json','SHA256SUMS','GIT_SHA','VERSION'];
const retiredNames=['A73.zip'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const cli=(...args)=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:8388608}).trim();
const api=(path,...args)=>JSON.parse(cli('api','repos/'+repository+'/'+path,...args));
const head=()=>api('branches/dev').commit.sha;
const checkHead=()=>assert.equal(head(),sha,'A73 refuses stale dev promotion');
const list=id=>api('releases/'+id+'/assets?per_page=100');
const rename=(id,name)=>cli('api','--method','PATCH','repos/'+repository+'/releases/assets/'+id,'-f','name='+name);
const drop=id=>cli('api','--method','DELETE','repos/'+repository+'/releases/assets/'+id);
const ref=()=>api('git/ref/tags/'+tag).object.sha;

async function prepare(){
  assert.equal(repository,'weigefenxiang/WeiG-qB-WebUI');
  assert.match(sha||'',/^[0-9a-f]{40}$/);
  assert(token,'GH_TOKEN is required');
  checkHead();
  await mkdir(root,{recursive:true});
  const files={};
  for(const name of ['weig-qb-webui.zip','weig-qb-webui.tar.gz','install.sh','install.ps1','manifest.json','SHA256SUMS','GIT_SHA','VERSION','A73/preview.json','A73/weig-qb-webui.zip','A73/weig-qb-webui-A73.zip']){
    const result=await fetch(base+'/'+name+'?release='+sha,{signal:AbortSignal.timeout(90000),cache:'no-store'});
    assert(result.ok,'Pages asset unavailable: '+name+' HTTP '+result.status);
    files[name]=Buffer.from(await result.arrayBuffer());
    assert(files[name].length>0,'Empty Pages file '+name);
  }
  const manifest=JSON.parse(files['manifest.json'].toString());
  const preview=JSON.parse(files['A73/preview.json'].toString());
  assert.equal(manifest.schemaVersion,6);
  assert.equal(manifest.kind,'materialized-webui-dist');
  assert.equal(manifest.gitSha,sha);
  assert.equal(manifest.version,'1.2.1');
  assert.equal(files.GIT_SHA.toString().trim(),sha);
  assert.equal(files.VERSION.toString().trim(),'1.2.1');
  assert.equal(preview.plan,'A73');assert.equal(preview.mutable,true);
  assert.equal(preview.gitSha,sha);assert.equal(preview.version,'1.2.1');
  assert.deepEqual(preview.archives,['weig-qb-webui.zip','weig-qb-webui-A73.zip']);
  assert.equal(preview.sha256,hash(files['weig-qb-webui.zip']));
  for(const name of preview.archives)assert.equal(hash(files['A73/'+name]),preview.sha256,'Pages alias bytes differ: '+name);
  assert.equal(manifest.artifacts.zip.sha256,preview.sha256);
  assert.equal(manifest.artifacts.zip.bytes,files['weig-qb-webui.zip'].length);
  assert.equal(manifest.artifacts.tarGz.sha256,hash(files['weig-qb-webui.tar.gz']));
  assert.equal(manifest.artifacts.tarGz.bytes,files['weig-qb-webui.tar.gz'].length);
  for(const line of files.SHA256SUMS.toString().trim().split(/\r?\n/)){
    const match=/^([0-9a-f]{64})  ([\w.-]+)$/.exec(line);
    assert(match,'Bad SHA256SUMS entry');
    assert.equal(hash(files[match[2]]),match[1],'Bad checksum '+match[2]);
  }
  files['weig-qb-webui-A73.zip']=files['A73/weig-qb-webui-A73.zip'];
  files.SHA256SUMS=Buffer.from(files.SHA256SUMS.toString().trimEnd()+'\n'+hash(files['weig-qb-webui-A73.zip'])+'  weig-qb-webui-A73.zip\n');
  for(const name of names)await writeFile(join(root,name),files[name]);
  checkHead();
  return files;
}

async function publish(){
  const files=await prepare();
  const notes='A73 rolling Dev Pre-release (WeiG qB WebUI 1.2.1).\n\nExact Git SHA: '+sha+
    '\n\nAutomatically published after exact-SHA CI and Pages verification. Not Test or Stable.'+
    '\n\nPages ZIP: '+base+'/A73/weig-qb-webui.zip'+
    '\nNamed A73 ZIP: '+base+'/A73/weig-qb-webui-A73.zip';
  const title='WeiG qB WebUI A73 (1.2.1 dev)';
  let release;
  try{release=api('releases/tags/'+tag);}
  catch(error){if(!String(error.stderr||error).includes('404'))throw error;}
  if(!release)release=api('releases?per_page=100').find(item=>item.tag_name===tag&&item.draft);
  if(!release){
    checkHead();
    let tagExists=false;
    try{
      const existing=ref();
      const compare=api('compare/'+existing+'...'+sha);
      assert(['ahead','identical'].includes(compare.status),'Orphan A73 tag is not a Dev ancestor');
      if(existing!==sha)cli('api','--method','PATCH','repos/'+repository+'/git/refs/tags/'+tag,'-f','sha='+sha,'-F','force=true');
      tagExists=true;
    }catch(error){
      if(!String(error.stderr||error).includes('404'))throw error;
    }
    if(!tagExists)cli('api','--method','POST','repos/'+repository+'/git/refs','-f','ref=refs/tags/'+tag,'-f','sha='+sha);
    release=api('releases','--method','POST','-f','tag_name='+tag,'-f','target_commitish=main','-f','name='+title,'-f','body='+notes,'-F','draft=true','-F','prerelease=true','-f','make_latest=false');
  }
  assert.equal(release.tag_name,tag);
  assert.equal(release.prerelease,true,'A73 release is not a prerelease');
  const id=release.id;
  let old=null;
  if(!release.draft){
    old=ref();assert.match(old,/^[a-f0-9]{40}$/);
    if(old!==sha)assert.equal(api('compare/'+old+'...'+sha).status,'ahead','A73 tag cannot move backward');
  }
  const existing=list(id);
  if(old===sha&&retiredNames.every(n=>!existing.some(x=>x.name===n))&&names.every(n=>{const a=existing.find(x=>x.name===n);return a&&a.size===files[n].length&&a.digest==='sha256:'+hash(files[n]);})){
    console.log('A73 already matches the same exact SHA; no-op');return;
  }
  const nonce=sha.slice(0,12), staged=[], backups=[];
  let switched=false;
  const lookup=name=>list(id).find(x=>x.name===name);
  const upload=async(name,temp)=>{
    const result=await fetch('https://uploads.github.com/repos/'+repository+'/releases/'+id+'/assets?name='+encodeURIComponent(temp),{
      method:'POST',headers:{Authorization:'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/octet-stream','X-GitHub-Api-Version':'2022-11-28'},body:files[name],signal:AbortSignal.timeout(120000)});
    const value=await result.json();
    assert(result.ok,'Cannot stage '+temp+': '+result.status+' '+JSON.stringify(value).slice(0,200));
    assert.equal(value.size,files[name].length);
    if(value.digest)assert.equal(value.digest,'sha256:'+hash(files[name]));
    return value.id;
  };
  try{
    for(const name of names){
      checkHead();
      const temp='A73-next-'+nonce+'-'+name;
      const leftover=lookup(temp);if(leftover)drop(leftover.id);
      const assetId=await upload(name,temp);
      staged.push({name,temp,assetId});
    }
    checkHead();
    for(const a of staged){
      const previous=lookup(a.name);
      if(previous){
        const backup='A73-old-'+nonce+'-'+a.name;
        assert(!lookup(backup),'Unresolved earlier publish backup '+backup);
        rename(previous.id,backup);backups.push({name:a.name,backup,id:previous.id});
      }
      rename(a.assetId,a.name);switched=true;
    }
    checkHead();
    if(old!==sha&&!release.draft)cli('api','--method','PATCH','repos/'+repository+'/git/refs/tags/'+tag,'-f','sha='+sha,'-F','force=true');
    cli('release','edit',tag,'--target',sha,'--title',title,'--notes',notes,'--prerelease','--latest=false','--draft=false');
    assert.equal(ref(),sha);
    const latest=list(id);
    for(const name of names){
      const asset=latest.find(x=>x.name===name);
      assert(asset,'Final release missing '+name);
      assert.equal(asset.size,files[name].length);
      if(asset.digest)assert.equal(asset.digest,'sha256:'+hash(files[name]));
    }
    // Retire legacy A73.zip only after the replacement assets verify against the Dev SHA.
    for(const name of retiredNames){const obsolete=lookup(name);if(obsolete)drop(obsolete.id);}
    assert(retiredNames.every(name=>!lookup(name)),'Obsolete A73 ZIP asset still exposed');
    for(const b of backups){try{drop(b.id);}catch(error){console.warn('Deferred old asset cleanup',error.message);}}
    console.log('Updated unique A73 Dev Pre-release: '+sha);
  }catch(error){
    console.error('A73 publish failed; attempting restoration:',error.message);
    if(switched){
      for(const a of staged){
        const canonical=lookup(a.name);
        if(canonical&&canonical.id===a.assetId)try{rename(canonical.id,'A73-failed-'+nonce+'-'+a.name);}catch{}
      }
      for(const b of backups){
        if(lookup(b.backup))try{rename(b.id,b.name);}catch{}
      }
      if(old&&old!==sha)try{cli('api','--method','PATCH','repos/'+repository+'/git/refs/tags/'+tag,'-f','sha='+old,'-F','force=true');}catch{}
    }
    throw error;
  }
}
publish().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
