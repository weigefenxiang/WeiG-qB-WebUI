import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const textExtensions=new Set(['.md','.mjs','.js','.css','.html','.json','.yml','.yaml','.sh','.ps1']);
const ignoredDirs=new Set(['.git','node_modules','release']);
function walk(abs,out=[]){
  if(!fs.existsSync(abs))return out;
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
    if(entry.isDirectory()&&ignoredDirs.has(entry.name))continue;
    const file=path.join(abs,entry.name);
    if(entry.isDirectory())walk(file,out);
    else out.push(file);
  }
  return out;
}

const firstPartyRoots=['webui/private','tests','docs','.github/workflows','installers']
  .map(rel=>path.join(root,rel));
const firstPartyFiles=firstPartyRoots.flatMap(dir=>walk(dir));
const rootTextFiles=['DESIGN.md','README.md','package.json']
  .map(rel=>path.join(root,rel))
  .filter(file=>fs.existsSync(file));
const auditFiles=[...new Set([...firstPartyFiles,...rootTextFiles])];

// Stable responsibility filenames may use docs ordering prefixes, but never WeiG/qB release labels.
const versionedName=/(?:^|[-.])(?:v\d+(?:\.\d+)*|qb\d+)(?=[^0-9]|$)/i;
const versionedPaths=auditFiles
  .map(file=>path.relative(root,file).replaceAll('\\','/'))
  .filter(rel=>versionedName.test(path.basename(rel)));
assert(versionedPaths.length===0,`Version-labelled first-party filenames are forbidden; use stable responsibility names:\n${versionedPaths.join('\n')}`);

// Current semantic rule identifiers are responsibilities, not numeric revision counters.
// Markdown headings catch both one-word and multi-word rules; source/test scanning targets semantic multi-word identifiers
// so protocol/status facts such as HTTP-404 are not misclassified as architecture revisions.
const headingToken='[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\\d{3}';
const codeToken='[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)+-\\d{3}';
const codePattern=new RegExp(`\\b${codeToken}\\b`,'g');
const headingPattern=new RegExp(`^#{2,6}\\s+(${headingToken})\\b`,'gm');
const numberedHits=[];
for(const file of auditFiles){
  const ext=path.extname(file).toLowerCase();
  if(!textExtensions.has(ext))continue;
  const source=fs.readFileSync(file,'utf8');
  const matches=ext==='.md'
    ?[...source.matchAll(headingPattern)].map(match=>match[1])
    :[...source.matchAll(codePattern)].map(match=>match[0]);
  if(matches.length)numberedHits.push(`${path.relative(root,file).replaceAll('\\','/')}: ${[...new Set(matches)].join(', ')}`);
}
assert(numberedHits.length===0,`Numbered current semantic identifiers are forbidden; Git history owns revisions:\n${numberedHits.join('\n')}`);

const design=fs.readFileSync(path.join(root,'DESIGN.md'),'utf8');
assert(!/^Version:\s*/m.test(design),'DESIGN.md must not maintain a parallel document revision number; Git history is the revision archive');
assert(design.includes('### SEMANTIC-NAMING'),'DESIGN.md must define the SEMANTIC-NAMING rule');

console.log(`Naming contract passed for ${auditFiles.length} first-party files: stable filenames, revision-neutral semantic identifiers, and Git-owned document history.`);
