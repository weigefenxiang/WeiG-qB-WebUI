import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const configUrl=new URL('./dev-stage.json',import.meta.url);
export function validateDevStage(value){
  assert(value&&value.schemaVersion===1&&value.kind==='weig-dev-stage','Unknown Dev stage configuration');
  assert(/^A[1-9][0-9]*$/.test(value.plan||''),'Invalid Dev stage plan');
  assert(/^\d+\.\d+\.\d+$/.test(value.version||''),'Invalid Dev stage version');
  return Object.freeze({plan:value.plan,version:value.version,tag:'dev-'+value.plan,namedZip:'weig-qb-webui-'+value.plan+'.zip'});
}
export async function readDevStage(){return validateDevStage(JSON.parse(await fs.readFile(configUrl,'utf8')));}
