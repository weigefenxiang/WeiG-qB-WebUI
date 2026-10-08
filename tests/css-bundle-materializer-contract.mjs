import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {materializeCssBundles} from '../tools/css-bundle-materializer.mjs';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'weig-css-bundle-'));
try{
  const privateRoot=path.join(folder,'private');
  fs.mkdirSync(path.join(privateRoot,'css'),{recursive:true});
  const stylesheetNames=['base','table','settings','logs'];
  const contents=stylesheetNames.map((name,i)=>'@charset "UTF-8";\n/* '+name+' */\n:root{--layer-'+i+':"✓";}\n');
  stylesheetNames.forEach((name,i)=>fs.writeFileSync(path.join(privateRoot,'css',name+'.css'),contents[i],'utf8'));
  const plan={schemaVersion:1,styleConcurrency:4,styles:stylesheetNames.map(name=>'css/'+name+'.css'),phases:[{name:'shell',scripts:['scripts/app.js'],requiresStyles:true}]};
  fs.writeFileSync(path.join(privateRoot,'bootstrap-plan.json'),JSON.stringify(plan));
  const result=materializeCssBundles(privateRoot);
  assert.equal(result.sourceCount,4);
  assert.equal(result.bundleCount,1);
  const builtPlan=JSON.parse(fs.readFileSync(path.join(privateRoot,'bootstrap-plan.json'),'utf8'));
  assert.deepEqual(builtPlan.phases,plan.phases,'materializer must not change JS dependency owners');
  assert.equal(builtPlan.styleConcurrency,1);
  assert.deepEqual(builtPlan.styles,['css/startup-01.css']);
  const actual=fs.readFileSync(path.join(privateRoot,builtPlan.styles[0]),'utf8');
  assert.equal(actual,'@charset "UTF-8";\n'+contents.map(x=>x.slice('@charset "UTF-8";\n'.length)).join('\n'));
  assert.equal((actual.match(/@charset/g)||[]).length,1,'bundled CSS needs exactly one top-level charset');
  assert.ok(actual.includes('✓'),'UTF-8 glyphs must survive byte-level concatenation');
  for(const name of stylesheetNames)assert.equal(fs.existsSync(path.join(privateRoot,'css',name+'.css')),false,'distribution must retire unreferenced old stylesheets');
  assert.throws(()=>materializeCssBundles(privateRoot),/already bundled/,'bundle materializer must not silently process generated output as canonical source');
  console.log('CSS bundle materializer contract passed: ordered non-minified CSS, UTF-8, deterministic plan and retired distribution duplicates.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
