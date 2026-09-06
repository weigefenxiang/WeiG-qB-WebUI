import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-pages-freshness-'));
const exactSha='0123456789abcdef0123456789abcdef01234567';
const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim();
const result=spawnSync(process.execPath,[
  path.join(root,'simulator/build/build-pages.mjs'),
  '--branch=dev',
  `--webui-root=${path.join(root,'webui')}`,
  `--out=${out}`,
  `--catalog=${path.join(root,'simulator/versions/catalog.bootstrap.json')}`,
  `--exact-sha=${exactSha}`,
  `--product-version=${version}`,
  `--simulator-sha=${exactSha}`
],{cwd:root,encoding:'utf8'});

try{
  if(result.status!==0)throw new Error(`build-pages.mjs failed:\n${result.stdout}\n${result.stderr}`);
  const privateIndex=fs.readFileSync(path.join(out,'__source/private/index.html'),'utf8');
  const publicIndex=fs.readFileSync(path.join(out,'__source/public/index.html'),'utf8');
  const worker=fs.readFileSync(path.join(out,'service-worker.js'),'utf8');
  const meta=JSON.parse(fs.readFileSync(path.join(out,'virtual-qb-build.json'),'utf8'));
  if(privateIndex.includes('__WEIGG_GIT_SHA__'))throw new Error('Virtual Pages private index still exposes the non-versioned Git SHA placeholder');
  if(!privateIndex.includes(`?v=${exactSha}`))throw new Error('Virtual Pages private assets are not keyed by the exact source SHA');
  if(!privateIndex.includes('data-weigg-virtual-sw-refresh')||!publicIndex.includes('data-weigg-virtual-sw-refresh'))throw new Error('Virtual Pages documents must actively refresh an existing Service Worker registration');
  if(!worker.includes(`const WEIGG_BUILD_SHA="${exactSha}";`))throw new Error('Virtual Pages Service Worker bytes must carry the exact source SHA');
  if(!worker.includes("target.searchParams.set('v',WEIGG_BUILD_SHA)"))throw new Error('Virtual Pages Service Worker must cache-bust internal __source fetches with the exact source SHA');
  if(meta.exactSha!==exactSha||meta.pagesAdapted!==true)throw new Error('Virtual Pages build metadata must record exact-SHA cache freshness adaptation');
  console.log('Virtual qB Pages cache freshness contract passed: exact-SHA assets, versioned Service Worker source fetches, and controlled-client update/reload are build-owned.');
}finally{
  fs.rmSync(out,{recursive:true,force:true});
}
