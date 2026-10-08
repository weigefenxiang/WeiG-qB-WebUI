import fs from 'node:fs';
import path from 'node:path';

// One distribution-only materializer for both installer artifacts and Virtual Pages.
// Sources remain modular; RuntimeAssets alone owns browser-side stylesheet transport.
const CSS_HEADER='@charset "UTF-8";\n';
const MAX_BUNDLE_BYTES=96*1024;

export function materializeCssBundles(privateRoot){
  const root=path.resolve(privateRoot);
  const planPath=path.join(root,'bootstrap-plan.json');
  const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
  if(plan.schemaVersion!==1||!Array.isArray(plan.styles)||!Array.isArray(plan.phases))throw new Error('Invalid canonical CSS bootstrap plan');
  const originals=plan.styles.slice();
  if(!originals.length||new Set(originals).size!==originals.length||originals.some(name=>!/^css\/[a-z0-9-]+\.css$/.test(name)||name.startsWith('css/startup-')))throw new Error('CSS source inventory is invalid or already bundled');
  const groups=[];
  let current=[],currentBytes=Buffer.byteLength(CSS_HEADER);
  for(const relative of originals){
    const source=fs.readFileSync(path.join(root,relative),'utf8');
    if(!source.startsWith(CSS_HEADER)||source.charCodeAt(0)===0xfeff)throw new Error('CSS charset contract invalid: '+relative);
    const body=source.slice(CSS_HEADER.length);
    if(/@import\s/i.test(body)||/@charset\s/i.test(body))throw new Error('CSS contains unsupported import or nested charset: '+relative);
    const size=Buffer.byteLength(body+'\n','utf8');
    if(current.length&&currentBytes+size>MAX_BUNDLE_BYTES){groups.push(current);current=[];currentBytes=Buffer.byteLength(CSS_HEADER);}
    if(currentBytes+size>MAX_BUNDLE_BYTES)throw new Error('CSS source exceeds bounded bundle size: '+relative);
    current.push({relative,body});currentBytes+=size;
  }
  if(current.length)groups.push(current);
  const bundled=groups.map((group,index)=>{
    const name='css/startup-'+String(index+1).padStart(2,'0')+'.css';
    const text=CSS_HEADER+group.map(item=>item.body).join('\n');
    if(Buffer.byteLength(text,'utf8')>MAX_BUNDLE_BYTES)throw new Error('CSS bundle size exceeded: '+name);
    fs.writeFileSync(path.join(root,name),text,'utf8');
    return name;
  });
  plan.styles=bundled;
  plan.styleConcurrency=Math.min(plan.styleConcurrency||2,bundled.length);
  fs.writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n','utf8');
  for(const name of originals)fs.rmSync(path.join(root,name));
  return {sourceCount:originals.length,bundleCount:bundled.length,bundled,groups:groups.map(group=>group.map(item=>item.relative))};
}
