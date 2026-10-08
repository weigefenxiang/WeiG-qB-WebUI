import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {materializeScriptBundles} from '../tools/js-bundle-materializer.mjs';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'weig-script-bundle-'));
try{
  const pr=path.join(folder,'private'),pu=path.join(folder,'public');
  for(const d of [path.join(pr,'scripts'),path.join(pu,'scripts')])fs.mkdirSync(d,{recursive:true});
  const write=(root,name,body)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body,'utf8');};
  const wrap=text=>'(function(window){window.order.push("'+text+'");})(window);\n';
  write(pu,'scripts/brand-favicon.js',wrap('brand'));
  write(pu,'storage-migration.js',wrap('migration'));
  write(pu,'session-contract.js','(function(window){var src=document.currentScript;window.order.push("session");})(window);\n');
  write(pr,'scripts/helper.js',wrap('helper'));
  write(pr,'scripts/extra.js',wrap('extra'));
  write(pr,'scripts/app.js',wrap('app'));
  const plan={schemaVersion:1,styles:[],phases:[
    {name:'foundation',scripts:['scripts/brand-favicon.js','storage-migration.js']},
    {name:'platform',scripts:['session-contract.js','scripts/helper.js','scripts/extra.js']},
    {name:'application',scripts:['scripts/app.js']}
  ]};
  write(pr,'bootstrap-plan.json',JSON.stringify(plan));
  const output=materializeScriptBundles(pr,pu),built=JSON.parse(fs.readFileSync(path.join(pr,'bootstrap-plan.json'),'utf8'));
  assert.equal(output.startupScripts,4);
  assert.deepEqual(built.phases.map(phase=>phase.scripts.length),[1,2,1]);
  assert.deepEqual(built.phases[1].scripts.slice(0,1),['session-contract.js'],'document.currentScript must remain independent');
  assert.deepEqual(built.phases.at(-1).scripts,['scripts/app.js'],'large/final App remains independent');
  const firstBundle=fs.readFileSync(path.join(pr,built.phases[0].scripts[0]),'utf8');
  assert.ok(firstBundle.indexOf('brand')<firstBundle.indexOf('migration'),'dependency order inside physical bundle is stable');
  const context={order:[]};new Function('window',firstBundle)(context);
  assert.deepEqual(context.order,['brand','migration'],'the merged script must execute the original IIFE bodies in order');
  for(const name of ['scripts/brand-favicon.js','storage-migration.js','session-contract.js'])assert.equal(fs.existsSync(path.join(pu,name)),true,'shared public-entry source must not be retired');
  for(const name of ['scripts/helper.js','scripts/extra.js'])assert.equal(fs.existsSync(path.join(pr,name)),false,'unreferenced private materialized source must be retired');
  assert.throws(()=>materializeScriptBundles(pr,pu),/already materialized/);
  console.log('JS bundle materializer contract passed: dependency phase, special scripts, execution order and public-entry preservation.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
