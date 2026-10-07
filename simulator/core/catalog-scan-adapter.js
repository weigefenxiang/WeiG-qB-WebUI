function normalizedApiPath(url){
  const marker='/api/v2/',pathname=String(url?.pathname||''),index=pathname.indexOf(marker);
  return index>=0?pathname.slice(index+marker.length).replace(/^\/+/, ''):'';
}
export function virtualCatalogTermination(world,request,urlInput){
  if(String(request?.method||'GET').toUpperCase()!=='GET')return false;
  if(Number(world?.profile?.major)>=5)return false;
  const url=urlInput instanceof URL?urlInput:new URL(String(urlInput||request?.url||'https://virtual.invalid/'));
  if(normalizedApiPath(url)!=='torrents/info')return false;
  const params=url.searchParams;
  if(params.get('sort')!=='added_on'||params.get('reverse')!=='true')return false;
  const limit=Number.parseInt(params.get('limit')||'',10),offset=Number.parseInt(params.get('offset')||'',10);
  if(limit!==200||!Number.isInteger(offset)||offset<=0||offset%200!==0)return false;
  const disqualifiers=['filter','category','tag','hashes','private'];
  if(disqualifiers.some(key=>params.has(key)))return false;
  const count=Array.isArray(world?.torrents)?world.torrents.length:0;
  return count>0&&offset>=count;
}
