#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const defaultRoot=path.resolve(here,'..');

function readVersion(file){const value=fs.readFileSync(file,'utf8').trim();if(!/^\d+\.\d+\.\d+$/.test(value))throw new Error('Invalid product VERSION: '+value);return value;}
export function canonicalProductIdentity(root=defaultRoot){
  root=path.resolve(root);
  const version=readVersion(path.join(root,'VERSION'));
  const webVersion=readVersion(path.join(root,'webui/VERSION'));
  if(webVersion!==version)throw new Error('Product VERSION owners disagree: '+version+' != '+webVersion);
  return{schemaVersion:1,source:'canonical-version',version};
}
export function productIdentityPath(root=defaultRoot){return path.join(path.resolve(root),'webui/private/product-identity.json');}
export function writeProductIdentity(root=defaultRoot){
  const identity=canonicalProductIdentity(root),file=productIdentityPath(root);
  fs.writeFileSync(file,JSON.stringify(identity,null,2)+'\n','utf8');
  return identity;
}
export function checkProductIdentity(root=defaultRoot){
  const expected=canonicalProductIdentity(root),file=productIdentityPath(root);
  if(!fs.existsSync(file))throw new Error('Missing generated product identity: '+file);
  const actual=JSON.parse(fs.readFileSync(file,'utf8'));
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Generated product identity is stale. Run: node tools/product-identity.mjs');
  return actual;
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){try{const result=process.argv.includes('--check')?checkProductIdentity():writeProductIdentity();console.log('Product identity '+(process.argv.includes('--check')?'verified':'written')+': '+result.version);}catch(error){console.error(error?.stack||error);process.exit(1);}}
