(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},S=W.SettingsSchema,state={client:null,values:{},ready:false,loading:null,revision:0},viewports=new Set();
  function own(obj,key){return Object.prototype.hasOwnProperty.call(obj||{},key);}
  function meta(key){return S&&typeof S.clientDataForKey==='function'?S.clientDataForKey(String(key||'')):null;}
  function supports(key){return !!meta(key);}
  function keys(){return S&&typeof S.clientDataKeys==='function'?S.clientDataKeys():[];}
  function normalize(item,value){
    if(!item)return undefined;
    var type=String(item.type||'');
    if(type==='boolean')value=value===true;
    else if(type==='number'){value=Number(value);if(!Number.isFinite(value))return undefined;}
    else if(type==='string')value=String(value==null?'':value);
    else return undefined;
    if(Array.isArray(item.options)&&item.options.length&&type==='string'&&!item.options.some(function(option){return String(option&&option.value)===String(value);}))return undefined;
    return value;
  }
  function defaultValue(item){return item&&own(item,'defaultValue')?normalize(item,item.defaultValue):undefined;}
  function value(key,fallback){
    var item=meta(key);if(!item||!state.ready)return fallback;
    if(own(state.values,key)){var current=normalize(item,state.values[key]);if(current!==undefined)return current;}
    var def=defaultValue(item);return def===undefined?fallback:def;
  }
  function snapshot(){return Object.assign({},state.values);}
  function syncViewport(viewport){if(!viewport)return;try{if(viewport._sourceManagedVirtualize===true&&typeof viewport.setVirtualize==='function')viewport.setVirtualize(virtualizeTables());if(typeof viewport.refreshRenderedRows==='function')viewport.refreshRenderedRows();}catch(_e){}}
  function syncViewports(){viewports.forEach(syncViewport);}
  function emit(changed){
    syncViewports();
    try{global.dispatchEvent(new CustomEvent('weig:clientdatachange',{detail:{values:snapshot(),keys:(changed||[]).slice(),revision:state.revision,ready:state.ready}}));}catch(_e){}
  }
  function apply(data,replace){
    data=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    var next=replace?{}:Object.assign({},state.values),changed=[];
    keys().forEach(function(key){var item=meta(key);if(!own(data,key))return;var normalized=normalize(item,data[key]);if(normalized===undefined)return;if(!own(next,key)||next[key]!==normalized)changed.push(key);next[key]=normalized;});
    if(replace)Object.keys(state.values).forEach(function(key){if(!own(next,key))changed.push(key);});
    state.values=next;state.ready=true;
    if(changed.length||replace){state.revision++;emit(Array.from(new Set(changed)));}
    return snapshot();
  }
  async function bind(client){
    state.client=client||state.client;if(state.loading)return state.loading;
    state.loading=(async function(){
      if(S&&typeof S.loadCompatibility==='function')await S.loadCompatibility();
      var wanted=keys();if(!wanted.length){state.values={};state.ready=true;state.revision++;emit([]);return snapshot();}
      if(!state.client||typeof state.client.getClientData!=='function'){state.ready=false;return snapshot();}
      try{return apply(await state.client.getClientData(wanted),true);}catch(error){state.ready=false;try{console.warn('[WeiG ClientData]',error);}catch(_e){}return snapshot();}
    })().finally(function(){state.loading=null;});
    return state.loading;
  }
  function merge(data){return apply(data,false);}
  function dateFormat(){var item=meta('date_format');if(!item||!state.ready)return null;return String(value('date_format',item.defaultValue==null?'default':item.defaultValue));}
  function trackerText(raw){var normalized=W.util&&W.util.normalizeTracker?W.util.normalizeTracker(raw):String(raw||''),fallback=W.util&&W.util.trackerLabel?W.util.trackerLabel(raw):normalized;return supports('full_url_tracker_column')&&state.ready&&value('full_url_tracker_column',false)===true?(normalized||fallback):fallback;}
  function virtualizeTables(){return supports('use_virtual_list')&&state.ready?value('use_virtual_list',false)===true:true;}
  function actionEnabled(key){return supports(key)&&state.ready&&String(value(key,'1'))==='1';}
  function hideZeroStatusFilters(){return supports('hide_zero_status_filters')&&state.ready&&value('hide_zero_status_filters',false)===true;}
  function registerViewport(viewport){if(!viewport)return function(){};viewports.add(viewport);syncViewport(viewport);return function(){viewports.delete(viewport);};}
  W.ClientDataRuntime={bind:bind,merge:merge,ready:function(){return state.ready;},supports:supports,keys:keys,get:value,snapshot:snapshot,revision:function(){return state.revision;},dateFormat:dateFormat,trackerText:trackerText,virtualizeTables:virtualizeTables,actionEnabled:actionEnabled,hideZeroStatusFilters:hideZeroStatusFilters,registerViewport:registerViewport};
})(window);
