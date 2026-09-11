const QBT_TR_RE=/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([A-Za-z_][A-Za-z0-9_]*)\]/g;

function normalizeLocale(value){return String(value||'').trim().replace(/-/g,'_').toLowerCase();}
function markerKey(context,source){return `${context}\u0000${source}`;}
function encodeQbReplacement(value){return String(value??'').replaceAll("'",'&#39;').replaceAll('"','&#34;');}
function firstTranslation(value){return Array.isArray(value)?value[0]:value;}

export function exactCatalogProfile(catalog,qbVersion){
  return (Array.isArray(catalog)?catalog:[]).find(item=>String(item?.qbVersion||'')===String(qbVersion||''))||null;
}

export function exactTranslatorBehavior(behaviorEvidence,profile){
  if(!behaviorEvidence||behaviorEvidence.schemaVersion!==1||!profile)return null;
  const hit=(behaviorEvidence.profiles||[]).find(item=>String(item?.qbVersion||'')===String(profile.qbVersion||''));
  if(!hit||String(hit.sourceSha||'')!==String(profile.sourceSha||''))return null;
  const family=behaviorEvidence.families?.[hit.family];
  return family?{family:hit.family,...family}:null;
}

export function buildTranslationSetIndex(catalog){
  const out=new Map();
  for(const profile of Array.isArray(catalog)?catalog:[]){
    for(const [hash,payload] of Object.entries(profile?.settingsTranslationSets||{})){
      if(!out.has(hash))out.set(hash,payload);
    }
  }
  return out;
}

export function translationIndexForProfile(catalog,profile,locale){
  if(!profile)return new Map();
  const translations=profile.settingsTranslations||{};
  let hash=translations[locale];
  if(!hash){
    const target=normalizeLocale(locale);
    const key=Object.keys(translations).find(item=>normalizeLocale(item)===target);
    if(key)hash=translations[key];
  }
  if(!hash)return new Map();
  const payload=buildTranslationSetIndex(catalog).get(hash);
  const out=new Map();
  for(const item of Array.isArray(payload?.messages)?payload.messages:[]){
    if(!item?.context||!item?.source)continue;
    out.set(markerKey(item.context,item.source),firstTranslation(item.translation));
  }
  return out;
}

export function emulateQbtDocument(source,{catalog,behaviorEvidence,qbVersion,locale='en'}={}){
  const text=String(source||'');
  const markers=[...text.matchAll(new RegExp(QBT_TR_RE.source,'g'))];
  if(!markers.length)return{text,mode:'none',markers:0,translated:0,fallback:0,missing:[],family:null};

  const profile=exactCatalogProfile(catalog,qbVersion);
  const behavior=exactTranslatorBehavior(behaviorEvidence,profile);
  if(!profile||!behavior){
    return{text,mode:'blocked-missing-evidence',markers:markers.length,translated:0,fallback:0,missing:markers.map(item=>({source:item[1],context:item[2]})),family:null};
  }
  if(behavior.altWebuiTranslation!==true){
    return{text,mode:'blocked-by-upstream',markers:markers.length,translated:0,fallback:0,missing:[],family:behavior.family};
  }

  const index=translationIndexForProfile(catalog,profile,locale);
  if(behavior.missingTranslationFallback==='none-explicit'){
    const missingUnsafe=markers.filter(item=>!index.has(markerKey(item[2],item[1]))).map(item=>({source:item[1],context:item[2]}));
    if(missingUnsafe.length)return{text,mode:'blocked-unsafe-fallback',markers:markers.length,translated:0,fallback:0,missing:missingUnsafe,family:behavior.family};
  }
  let translated=0,fallback=0;
  const missing=[];
  const rendered=text.replace(new RegExp(QBT_TR_RE.source,'g'),(_whole,sourceText,context)=>{
    const key=markerKey(context,sourceText);
    const value=index.get(key);
    if(value===undefined||value===null||value===''){
      fallback++;
      missing.push({source:sourceText,context});
      return encodeQbReplacement(sourceText);
    }
    translated++;
    return encodeQbReplacement(value);
  });
  return{text:rendered,mode:'native-qbt-emulation',markers:markers.length,translated,fallback,missing,family:behavior.family};
}
