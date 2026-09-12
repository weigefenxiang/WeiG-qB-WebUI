import './real-qb-torrent-creator.mjs';
import path from 'node:path';

const target=path.basename(String(process.argv[1]||''));
if(target==='real-qb-harness.mjs'||target==='real-qb-search.mjs'){
  const coreMode=String(process.env.WEIG_GFM_CORE_MODE||'full').trim();
  const searchMode=String(process.env.WEIG_GFM_SEARCH_MODE||'full').trim();
  if(!['full','smoke'].includes(coreMode))throw new Error(`Invalid WEIG_GFM_CORE_MODE: ${coreMode}`);
  if(!['full','skip'].includes(searchMode))throw new Error(`Invalid WEIG_GFM_SEARCH_MODE: ${searchMode}`);
  if(target==='real-qb-harness.mjs'&&coreMode==='smoke')process.exit(0);
  if(target==='real-qb-search.mjs'&&searchMode==='skip')process.exit(0);
}
