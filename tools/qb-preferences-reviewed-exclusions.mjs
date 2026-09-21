function hasPreferenceBinding(inventory,key){return (inventory?.bindings||[]).some(item=>(item?.preferenceKeys||[]).map(String).includes(String(key)));}
function descriptorByKey(descriptors,key){return (descriptors||[]).find(item=>String(item?.key||'')===String(key))||null;}

export function reviewedQbPreferencesExclusions({source='',preferenceDescriptors=[],inventory=null,manifest=null}={}){
  const exclusions={tabs:[],preferences:[],bindings:[]},key='current_interface_name',descriptor=descriptorByKey(preferenceDescriptors,key),mapped=!!manifest?.preferences?.[key],bound=hasPreferenceBinding(inventory,key),text=String(source||'');
  const helperUse=/\bupdateNetworkInterfaces\s*\([^)]*\bpref\s*\.\s*current_interface_name\b[^)]*\)/.test(text);
  const writeUse=/\bsettings\s*\.\s*set\s*\(\s*["']current_interface_name["']|\bsettings\s*\[\s*["']current_interface_name["']\s*\]\s*=|\b(?:settings|preferences)\s*\.\s*current_interface_name\s*=/.test(text);
  if(!mapped&&!bound&&helperUse&&!writeUse&&descriptor?.getterPresent===true&&descriptor?.setterPresent===false){
    exclusions.preferences.push({key,reason:'Reviewed upstream auxiliary metadata: current_interface_name is getter-only, has no independent native control/write binding, and is consumed only as display metadata by updateNetworkInterfaces alongside the actual network-interface preference.'});
  }
  return exclusions;
}
