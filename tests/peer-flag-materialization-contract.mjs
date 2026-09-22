import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {materializeQbPeerFlags,QB_PEER_FLAGS_SOURCE} from '../tools/qb-release-catalog-peer-flags.mjs';

const uiSource=fs.readFileSync(new URL('../webui/private/scripts/ui.js',import.meta.url),'utf8');
const coreSource=fs.readFileSync(new URL('../webui/private/scripts/core.js',import.meta.url),'utf8');
assert.ok(!uiSource.includes('countryFlag')&&!coreSource.includes('U.countryFlag'),'peer renderer must not retain emoji as a second flag truth beside materialized local SVG assets');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weig-peer-flags-'));
try{
  const sourceRoot=path.join(temp,'upstream'),privateRoot=path.join(temp,'private');
  const renderer=path.join(sourceRoot,QB_PEER_FLAGS_SOURCE.renderer);
  const flagsDir=path.join(sourceRoot,QB_PEER_FLAGS_SOURCE.flags);
  fs.mkdirSync(path.dirname(renderer),{recursive:true});
  fs.mkdirSync(flagsDir,{recursive:true});
  fs.mkdirSync(path.join(privateRoot,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(privateRoot,'css'),{recursive:true});
  fs.writeFileSync(path.join(privateRoot,'scripts','ui.js'),"function peer(){return 'peer-country-flag';}\n");
  fs.writeFileSync(renderer,"const flag = 'images/flags/' + peer.country_code.toLowerCase() + '.svg';\n");

  const names=new Set(['cn','tw','us','de','jp','sg']);
  outer:for(let a=0;a<26;a++)for(let b=0;b<26;b++){
    names.add(String.fromCharCode(97+a)+String.fromCharCode(97+b));
    if(names.size>=220)break outer;
  }
  for(const iso of names)fs.writeFileSync(path.join(flagsDir,iso+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="11"/>\n');

  const result=materializeQbPeerFlags(privateRoot,{sourceRoot});
  assert.equal(result.materialized,true,'peer flag materializer must activate when the shared renderer is present');
  assert.ok(result.flagCount>=200,'peer flag materializer must preserve the bounded local ISO inventory');
  const css=fs.readFileSync(path.join(privateRoot,'css','qb-peer-flags.css'),'utf8');
  for(const iso of ['cn','tw','us']){
    assert.ok(css.includes(`.peer-country-flag.flag.${iso}{`),`missing generated ${iso.toUpperCase()} peer flag selector`);
    assert.ok(css.includes(`url('../images/flags/${iso}.svg')`),`missing local ${iso.toUpperCase()} SVG binding`);
    assert.ok(fs.existsSync(path.join(privateRoot,'images','flags',iso+'.svg')),`missing copied local ${iso.toUpperCase()} SVG asset`);
  }
  assert.ok(!/https?:\/\//.test(css.replace(/^\/\*[^\n]*\*\/\n?/,'')||''),'generated peer flag CSS must not add a CDN/remote image fallback');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

console.log('Peer flag materialization contract passed: representative CN/TW/US country codes bind to copied local SVG assets through the single generated CSS owner.');
