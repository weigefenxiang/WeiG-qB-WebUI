function retryableEvidenceStatus(status){status=Number(status)||0;return status===408||status===429||status>=500;}

export async function fetchJsonEvidence(input,options={}){
  const attempts=Math.max(1,Math.min(5,Number(options.attempts)||3));
  const rawDelay=Number(options.delayMs);
  const delayMs=Math.max(0,Number.isFinite(rawDelay)?rawDelay:250);
  const init={...(options.init||{})};
  const method=String(init.method||'GET').toUpperCase();
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  if(method!=='GET')throw new Error('fetchJsonEvidence is restricted to idempotent GET evidence reads.');
  if(typeof fetchImpl!=='function')throw new Error('fetchJsonEvidence requires a fetch implementation.');
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetchImpl(input,init);
      if(!response||typeof response.ok!=='boolean')throw new Error('fetchJsonEvidence received an invalid Response.');
      if(!response.ok){
        const error=new Error(`${String(input)} returned HTTP ${response.status}`);
        error.status=Number(response.status)||0;
        if(!retryableEvidenceStatus(error.status))throw error;
        last=error;
      }else{
        try{return await response.json();}
        catch(error){last=error;}
      }
    }catch(error){
      if(error&&Number(error.status)&&!retryableEvidenceStatus(error.status))throw error;
      last=error;
    }
    if(attempt<attempts&&delayMs>0)await new Promise(resolve=>setTimeout(resolve,delayMs*attempt));
  }
  throw last||new Error(`Unable to fetch JSON evidence from ${String(input)}`);
}
