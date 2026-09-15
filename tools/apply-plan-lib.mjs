import fs from 'node:fs';
import path from 'node:path';
export const root=process.cwd();
export const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
export function write(rel,text){const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,'utf8');}
export function replace(rel,from,to,label='anchor'){const before=read(rel);if(!before.includes(from))throw new Error(`${rel}: missing ${label}`);const after=before.replace(from,to);if(after===before)throw new Error(`${rel}: unchanged ${label}`);write(rel,after);}
export function appendOnce(rel,marker,block){const before=read(rel);if(before.includes(marker))return;write(rel,before.replace(/\s*$/,'')+'\n\n'+block.trim()+'\n');}
export function json(rel,fn){const value=JSON.parse(read(rel));fn(value);write(rel,JSON.stringify(value,null,2)+'\n');}
