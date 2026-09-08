#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// qBittorrent WebApplication::sendFile limits Alternative WebUI static files to 10 MiB.
export const QB_WEBUI_MAX_STATIC_FILE_BYTES=10*1024*1024;

export function packCatalog(input,output){
  if(!input||!output)throw new Error('Usage: node tools/qb-webui-catalog.mjs <input.json> <output.json>');
  const source=fs.readFileSync(input,'utf8');
  const catalog=JSON.parse(source);
  if(!Array.isArray(catalog)||catalog.length===0)throw new Error('qB release catalog must be a non-empty JSON array.');
  const packed=`${JSON.stringify(catalog)}\n`;
  const bytes=Buffer.byteLength(packed);
  if(bytes>=QB_WEBUI_MAX_STATIC_FILE_BYTES){
    throw new Error(`Packed qB release catalog is ${bytes} bytes; qB WebUI static files must stay below ${QB_WEBUI_MAX_STATIC_FILE_BYTES} bytes.`);
  }
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
  fs.writeFileSync(output,packed);
  const verified=JSON.parse(fs.readFileSync(output,'utf8'));
  if(JSON.stringify(verified)!==JSON.stringify(catalog))throw new Error('Packed qB release catalog changed JSON semantics.');
  return {profiles:catalog.length,sourceBytes:Buffer.byteLength(source),packedBytes:bytes,maxStaticBytes:QB_WEBUI_MAX_STATIC_FILE_BYTES};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const result=packCatalog(process.argv[2],process.argv[3]);
    console.log(JSON.stringify(result));
  }catch(error){
    console.error(error?.message||error);
    process.exitCode=1;
  }
}
