import fs from 'node:fs';
import path from 'node:path';

// Shared build-time JS materializer. Only files in one canonical dependency phase
// may share an output; Route-module loading remains owned by W.Navigation.
const MAX_BUNDLE_BYTES=96*1024;
const INDEPENDENT=new Set(['session-contract.js','scripts/i18n.js','scripts/core.js','scripts/floating.js','scripts/selection.js','scripts/ui.js','scripts/app.js']);
const VALID=/^(?:scripts\/)?[a-z0-9-]+\.js$/;

export function materializeScriptBundles(privateRoot,publicRoot){
  const root=path.resolve(privateRoot),shared=path.resolve(publicRoot),planPath=path.join(root,'bootstrap-plan.json');
  const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
  if(plan.schemaVersion!==1||!Array.isArray(plan.phases))throw new Error('Canonical dependency plan required for JS bundling');
  const kept=new Set(),bundledSource=new Map(),owners=[];
  const load=(relative)=>{
    if(!VALID.test(relative)||relative.startsWith('scripts/startup-'))throw new Error('Unsafe or already materialized JS path: '+relative);
    if(kept.has(relative))throw new Error('Duplicate script lifecycle owner: '+relative);
    kept.add(relative);
    const privateFile=path.join(root,relative),publicFile=path.join(shared,relative);
    const file=fs.existsSync(privateFile)?privateFile:fs.existsSync(publicFile)?publicFile:null;
    if(!file)throw new Error('Missing canonical script source: '+relative);
    const code=fs.readFileSync(file,'utf8');
    if(!code.startsWith('(function(')||!code.trimEnd().endsWith('})(window);'))throw new Error('Cannot bundle non-IIFE script: '+relative);
    return {relative,file,code,canMerge:!INDEPENDENT.has(relative)&&!code.includes('document.currentScript')};
  };
  for(const phase of plan.phases){
    if(!phase||!Array.isArray(phase.scripts)||!phase.scripts.length)throw new Error('Empty dependency phase');
    const source=phase.scripts.map(load),groups=[];let current=[],size=0;
    function flush(){if(current.length)groups.push(current);current=[];size=0;}
    for(const item of source){
      const bytes=Buffer.byteLength(item.code,'utf8')+3;
      if(!item.canMerge||bytes>MAX_BUNDLE_BYTES){flush();groups.push([item]);continue;}
      if(current.length&&size+bytes>MAX_BUNDLE_BYTES)flush();
      current.push(item);size+=bytes;
    }
    flush();
    let serial=0;
    const newScripts=groups.map(group=>{
      if(group.length===1)return group[0].relative;
      const relative='scripts/startup-'+phase.name+'-'+String(++serial).padStart(2,'0')+'.js';
      const target=path.join(root,relative),code=group.map(x=>x.code).join('\n;\n');
      if(Buffer.byteLength(code,'utf8')>MAX_BUNDLE_BYTES)throw new Error('JS bundle size exceeded: '+relative);
      fs.writeFileSync(target,code,'utf8');
      for(const item of group){bundledSource.set(item.relative,item.file);owners.push({source:item.relative,bundle:relative});}
      return relative;
    });
    phase.scripts=newScripts;
  }
  fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n','utf8');
  // Public entry scripts are separately used by login/selection pages; retain
  // those physical files even if also embedded in a startup bundle.
  for(const file of bundledSource.values())if(file.startsWith(root+path.sep))fs.rmSync(file);
  return {startupScripts:plan.phases.reduce((n,phase)=>n+phase.scripts.length,0),bundledFiles:owners};
}
