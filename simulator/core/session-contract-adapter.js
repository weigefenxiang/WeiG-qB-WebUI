const SESSION_CONTRACT_PATH='session-contract.js';
const TARGET_ANCHOR="var url=new URL('index.html',BASE);";
const PATCH_MARKER='__weig_virtual_sim_query__';

export function adaptSessionContractSource(source,path='session-contract.js'){
  const text=String(source||''),name=String(path||'').replace(/^.*\//,'');
  if(name!==SESSION_CONTRACT_PATH||text.includes(PATCH_MARKER))return text;
  if(!text.includes('function authenticatedEntryUrl')||!text.includes(TARGET_ANCHOR))return text;
  const patch=TARGET_ANCHOR+"/*"+PATCH_MARKER+"*/try{var virtualSim=new URL(global.location.href).searchParams.get('sim');if(virtualSim)url.searchParams.set('sim',virtualSim);}catch(_e){}";
  return text.replace(TARGET_ANCHOR,patch);
}
