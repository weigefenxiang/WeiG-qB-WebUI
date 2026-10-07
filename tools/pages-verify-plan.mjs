import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const baseLane=(name,script,extra={})=>({
  name,
  script,
  service_mode:'none',
  pref_mode:'none',
  pref_index:'0',
  pref_total:'1',
  release_mode:'none',
  ...extra
});

const fixed=[
  baseLane('core','tests/pages-live-acceptance.mjs'),
  baseLane('startup-performance','tests/pages-live-startup-performance.mjs'),
  baseLane('auth-session','tests/pages-live-auth.mjs'),
  baseLane('services-modern','tests/pages-live-services-core.mjs',{service_mode:'modern'}),
  baseLane('services-protocol','tests/pages-live-protocol.mjs'),
  baseLane('mobile-layout','tests/pages-live-mobile-layout.mjs')
];
const byName=new Map(fixed.map(item=>[item.name,item]));
const preferenceAnchor=total=>baseLane('preferences-anchor','tests/pages-live-preferences.mjs',{pref_mode:'anchor',pref_total:String(total)});
const preferenceShard=(index,total)=>baseLane(`preferences-${index}`,'tests/pages-live-preferences.mjs',{pref_mode:'shard',pref_index:String(index),pref_total:String(total)});
const pick=names=>names.map(name=>{
  const lane=byName.get(name);
  if(!lane)throw new Error('Unknown Pages verification lane: '+name);
  return {...lane};
});

export const FULL_PAGES_VERIFY_LANES=fixed.map(item=>({...item}));

export function verificationProfileForClassification(value={}){
  if(value.workflowPolicy===true||value.pagesLive===true)return'full';
  if(value.settingsSource===true||value.settingsUi===true)return'settings';
  if(value.nativeSource===true)return'native';
  if(value.ui===true)return'ui';
  if(value.installer===true)return'installer';
  if(value.pagesPayload===true)return'payload';
  return'full';
}

export function pagesVerifyLanes(profile='full'){
  profile=String(profile||'full').trim().toLowerCase();
  switch(profile){
    case'installer': return pick(['core']);
    case'payload': return pick(['core','startup-performance']);
    case'ui': return pick(['core','startup-performance','mobile-layout']);
    case'native': return pick(['core','services-modern']);
    case'settings':
      return[
        baseLane('core','tests/pages-live-acceptance.mjs'),
        baseLane('locale-bootstrap','tests/pages-live-locale-bootstrap.mjs'),
        baseLane('release-profile-settings','tests/pages-live-release-profile.mjs',{release_mode:'settings'}),
        preferenceAnchor(4),
        ...Array.from({length:4},(_,index)=>preferenceShard(index,4))
      ];
    case'full': return FULL_PAGES_VERIFY_LANES.map(item=>({...item}));
    default: throw new Error('Unsupported Pages verification profile: '+profile);
  }
}

export function pagesVerifyMatrix(profile='full'){
  return{include:pagesVerifyLanes(profile)};
}

function optionValue(name){
  const prefix=`--${name}=`;
  const hit=process.argv.slice(2).find(value=>value.startsWith(prefix));
  return hit?hit.slice(prefix.length):'';
}
const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){
  if(process.argv.includes('--classification')){
    const input=JSON.parse(fs.readFileSync(0,'utf8')||'{}');
    process.stdout.write(verificationProfileForClassification(input)+'\n');
  }else{
    const profile=optionValue('profile')||'full';
    process.stdout.write(JSON.stringify(pagesVerifyMatrix(profile))+'\n');
  }
}
