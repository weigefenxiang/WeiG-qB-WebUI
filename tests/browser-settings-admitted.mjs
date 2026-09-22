(async function(){
  'use strict';
  const fs=await import('node:fs/promises');
  const path=await import('node:path');
  const http=await import('node:http');
  const {fileURLToPath}=await import('node:url');
  const here=path.dirname(fileURLToPath(import.meta.url));
  const root=path.resolve(here,'..');
  const fixturePath=path.join(root,'tests/fixtures/qb-release-catalog.lkg.json');
  const catalog=JSON.parse(await fs.readFile(fixturePath,'utf8'));
  const admitted=catalog.filter(item=>item&&item.officialWeiGSupport!==false&&item.fallback!==true);
  function assert(ok,msg){if(!ok)throw new Error(msg);}
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function versions(){return admitted.map(item=>String(item.qbVersion||''));}
  assert(admitted.length>0&&versions()[0]==='4.1.0','Admitted Settings browser matrix must start at exact qB 4.1.0.');

  async function jsonFiles(dir){
    const out=[];
    async function walk(current){
      for(const entry of await fs.readdir(current,{withFileTypes:true})){
        const file=path.join(current,entry.name);
        if(entry.isDirectory())await walk(file);
        else if(entry.name.endsWith('.json'))out.push(file);
      }
    }
    await walk(dir);return out.sort();
  }
  if(process.argv[2]==='--aggregate'){
    const dir=path.resolve(root,process.argv[3]||'settings-browser-shards');
    const shardFiles=await jsonFiles(dir);
    assert(shardFiles.length>0,'A5 admitted Settings browser aggregate found no shard artifacts.');
    const shardResults=[];
    for(const file of shardFiles)shardResults.push(JSON.parse(await fs.readFile(file,'utf8')));
    const executed=shardResults.flatMap(item=>item.releases||[]);
    const expected=versions(),actual=executed.map(item=>String(item.qbVersion||''));
    const duplicates=actual.filter((value,index)=>actual.indexOf(value)!==index);
    const missing=expected.filter(value=>!actual.includes(value));
    const unexpected=actual.filter(value=>!expected.includes(value));
    assert(executed.length===expected.length&&missing.length===0&&duplicates.length===0&&unexpected.length===0,
      'A5 admitted Settings browser completeness failed: expected='+expected.length+' executed='+executed.length+' missing='+JSON.stringify(missing)+' duplicate='+JSON.stringify(duplicates)+' unexpected='+JSON.stringify(unexpected));
    const byVersion=new Map(admitted.map(item=>[String(item.qbVersion||''),item]));
    const totals={tabs:0,rows:0,fieldsets:0,controls:0,helpers:0,optionDomainChecks:0,interactions:0,writes:0,rereads:0};
    const familyCounts={};
    for(const row of executed){
      const profile=byVersion.get(String(row.qbVersion||''));
      assert(profile&&String(profile.sourceSha||'')===String(row.sourceSha||''),'A5 browser shard source identity mismatch for '+row.qbVersion);
      for(const key of ['silentDrop','unexplainedReadOnly','falsePositiveWritable','stateMismatch','domainFailure'])assert(Number(row[key]||0)===0,'A5 browser '+row.qbVersion+' '+key+'='+row[key]);
      assert(Array.isArray(row.errors)&&row.errors.length===0,'A5 browser '+row.qbVersion+' errors: '+JSON.stringify(row.errors));
      assert(Number(row.interactions||0)>0&&Number(row.writes||0)>0&&Number(row.rereads||0)>0,'A5 browser '+row.qbVersion+' did not prove pointer/keyboard -> write -> reread.');
      for(const key of Object.keys(totals))totals[key]+=Number(row[key]||0);
      for(const family of row.interactionFamilies||[])familyCounts[family]=(familyCounts[family]||0)+1;
    }
    for(const family of ['checkbox','select','number','text'])assert((familyCounts[family]||0)>0,'A5 browser aggregate never exercised semantic family '+family);
    console.log('A5 admitted Settings browser aggregate passed: expected='+expected.length+' executed='+executed.length+' missing=0 duplicate=0 unexpected=0 silentDrop=0 unexplainedReadOnly=0 falsePositiveWritable=0 domainFailure=0 interactions='+totals.interactions+' families='+JSON.stringify(familyCounts)+'.');
    return;
  }

  const {readWebuiStatic}=await import('./browser-driver.mjs');
  const shardIndex=Number(process.env.WEIG_SETTINGS_SHARD_INDEX||0);
  const shardCount=Number(process.env.WEIG_SETTINGS_SHARD_COUNT||1);
  assert(Number.isInteger(shardIndex)&&Number.isInteger(shardCount)&&shardCount>0&&shardIndex>=0&&shardIndex<shardCount,'Invalid admitted Settings browser shard '+shardIndex+'/'+shardCount);
  const assigned=admitted.filter((_,index)=>index%shardCount===shardIndex);
  assert(assigned.length>0,'Admitted Settings browser shard '+shardIndex+' is empty.');
  const output=path.resolve(root,process.env.WEIG_SETTINGS_MATRIX_OUTPUT||('settings-browser-shard-'+shardIndex+'.json'));
  const privateRoot=path.join(root,'webui/private');
  const publicRoot=path.join(root,'webui/public');
  const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
  const host='127.0.0.1',port=8800+shardIndex;
  let activeProfile=null,variant=null;
  const torrent={hash:'1'.repeat(40),name:'A5 Settings Matrix Fixture',size:1048576,progress:.5,dlspeed:1024,upspeed:128,eta:300,state:'downloading',ratio:.2,tracker:'https://tracker.example/announce',category:'fixture',tags:'a5',added_on:1000,save_path:'/downloads'};
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
  function sendJson(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
  function sendText(res,value,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
  function sendEmpty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
  async function body(req){let value='';for await(const chunk of req)value+=chunk;return value;}
  function initialPrefs(){return{locale:'en',save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weig-qb-webui'};}
  async function api(req,res,p,url){
    if(p==='app/version')return sendText(res,'v'+activeProfile.qbVersion);
    if(p==='app/webapiVersion')return sendText(res,activeProfile.webApiVersion);
    if(p==='app/preferences'&&req.method==='GET'){variant.reads++;return sendJson(res,variant.prefs);}
    if(p==='app/setPreferences'&&req.method==='POST'){
      const form=new URLSearchParams(await body(req)),raw=form.get('json');assert(raw!==null,'app/setPreferences missing json');
      const patch=JSON.parse(raw),readable={...patch};
      if(Object.prototype.hasOwnProperty.call(readable,'web_ui_password')){variant.secrets.push(String(readable.web_ui_password));delete readable.web_ui_password;}
      Object.assign(variant.prefs,readable);variant.writes.push(patch);return sendEmpty(res);
    }
    if(p==='app/networkInterfaceList')return sendJson(res,[{name:'Ethernet',value:'eth0'},{name:'Wi-Fi',value:'wlan0'}]);
    if(p==='app/networkInterfaceAddressList')return sendJson(res,url.searchParams.get('iface')==='eth0'?['192.0.2.20','2001:db8::20']:['198.51.100.10']);
    if(p==='app/buildInfo')return sendJson(res,{});
    if(p==='transfer/info')return sendJson(res,{dl_info_speed:1024,up_info_speed:128,connection_status:'connected',dht_nodes:8,total_peer_connections:2});
    if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return sendText(res,'0');
    if(p==='sync/maindata')return sendJson(res,{rid:1,full_update:true,torrents:{},categories:{},tags:['a5'],server_state:{connection_status:'connected',dl_info_speed:1024,up_info_speed:128,dht_nodes:8,total_peer_connections:2,free_space_on_disk:10737418240}});
    if(p==='torrents/info')return sendJson(res,[torrent]);
    if(p==='torrents/properties')return sendJson(res,{save_path:'/downloads',total_size:1048576,total_downloaded:524288,total_uploaded:131072,share_ratio:.2,nb_connections:2,seeds:1,peers:1,addition_date:1000,completion_date:-1,created_by:'fixture',pieces_num:16,piece_size:65536});
    if(['torrents/files','torrents/trackers','torrents/webseeds','search/plugins','log/main','log/peers'].includes(p))return sendJson(res,[]);
    if(p==='sync/torrentPeers')return sendJson(res,{peers:{}});
    if(p==='torrents/categories')return sendJson(res,{});
    if(p==='torrents/tags')return sendJson(res,['a5']);
    if(p==='rss/items'||p==='rss/rules'||p==='rss/matchingArticles')return sendJson(res,{});
    if(req.method==='POST')return sendEmpty(res);
    return sendJson(res,{});
  }
  const server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://'+host+':'+port),rel=url.pathname.replace(/^\//,'');
    if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);
    if(rel==='data/qb-releases.json')return sendJson(res,[activeProfile]);
    if(rel==='views/preferences.html')return sendText(res,'<!doctype html><select id="localeSelect"><option value="en">English</option><option value="zh_CN">简体中文</option></select>');
    if(rel==='weigg-install.json')return sendJson(res,{version:productVersion,gitSha:'a5-settings-matrix',qbPath:'/config/weig-qb-webui',hostPath:'/srv/qb/config/weig-qb-webui'});
    const requested=rel||'index.html',{file,body:bytes}=await readWebuiStatic([privateRoot,publicRoot],requested);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch(error){res.writeHead(error&&error.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error&&error.stack||error));}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  const {launchBrowser}=await import('./browser-driver.mjs');
  const browser=await launchBrowser();
  function attr(value){return String(value==null?'':value).replaceAll('\\','\\\\').replaceAll('"','\\"');}
  async function openSettings(page){await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>location.hash.includes('settings'));await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]');}
  async function selectTab(page,tab){await page.locator('#settings-tabs [data-settings-tab="'+attr(tab)+'"]').click();await page.waitForFunction(value=>document.querySelector('#settings-tabs [data-settings-tab="'+value+'"]')?.classList.contains('is-active'),tab);await page.waitForFunction(value=>window.WeiG&&WeiG.SettingsState&&WeiG.SettingsState.tab===value,tab);}
  async function seedPrefs(page){return page.evaluate(async()=>{
    const S=WeiG.SettingsSchema,state=WeiG.SettingsState,prefs={...(state.prefs||{})},own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),controls=[];
    for(const tab of S.nativeSurfaces()){const g=S.controlGraph(tab);for(const f of g&&g.fieldsets||[])controls.push(...(f.legendControls||[]));for(const r of g&&g.rows||[])for(const item of r.items||[])if(item&&item.kind==='control')controls.push(item);}
    const coerce=(value,type)=>type==='boolean'?!!value:type==='number'?(Number.isFinite(Number(value))?Number(value):0):type==='object'?(value&&typeof value==='object'&&!Array.isArray(value)?value:{}):type==='array'?(Array.isArray(value)?value:[]):String(value==null?'':value);
    for(const control of controls){
      const key=control&&control.preferenceKey;if(!key||own(prefs,key))continue;const source=S.sourcePreference(key);if(!source)continue;
      const d=source.descriptor||{},type=String(d.readType||d.writeType||''),p=source.projection||{},options=Array.isArray(source.options)?source.options:[];
      let value;
      if(p.kind==='compound-switch-map'&&Array.isArray(p.writeCases)&&p.writeCases.length)value=p.writeCases[0].raw;
      else if((p.kind==='switch-map'||p.kind==='compound-switch-map')&&Array.isArray(p.values)&&p.values.length)value=p.values[0][0];
      else if(p.kind==='boolean-select')value=false;
      else if(p.kind==='sentinel-gate')value=p.disabledValue;
      else if(p.kind==='presence-gate')value='';
      else if(source.structured&&source.structured.kind==='keyed-map')value={};
      else if(options.length)value=S.toRaw(key,options[0].value,prefs,{});
      else if(type==='boolean')value=false;
      else if(type==='number'){const min=Number(source.attributes&&source.attributes.min);value=Number.isFinite(min)?min:0;}
      else if(type==='object')value={};
      else if(type==='array')value=[];
      else value='';
      prefs[key]=coerce(value,type);
    }
    state.prefs=prefs;if(WeiG.AppState)WeiG.AppState.preferences=prefs;state.draft={};state.auxDraft={};await WeiG.SettingsRenderer.open(state.tab);return{prefs,tabs:S.nativeSurfaces()};
  });}
  async function auditTab(page,tab){return page.evaluate(value=>{
    const S=WeiG.SettingsSchema,R=WeiG.CapabilityRegistry,prefs=WeiG.SettingsState.prefs||{},aux=WeiG.SettingsState.auxDraft||{},state=Object.assign({},prefs,WeiG.SettingsState.draft||{}),g=S.controlGraph(value),own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(!g)return{error:'missing graph'};
    const helperTarget=item=>item&&item.action&&item.action.targetControlId&&S.preferenceKeyForControl?S.preferenceKeyForControl(item.action.targetControlId):null;
    const relevant=item=>{if(!item)return false;if(item.kind==='content')return !!(item.label||(item.items&&item.items.length));if(item.kind==='helper'){const key=helperTarget(item);return !!(key&&own(prefs,key))||item.action&&item.action.kind==='source-action';}if(item.kind==='control'&&S.projectionAuxForControl){const p=S.projectionAuxForControl(item.id,state,aux);if(p&&own(prefs,p.key))return true;}if(item.preferenceKey)return own(prefs,item.preferenceKey);if(item.kind==='control'&&item.writeOnly&&S.writeOnlyForControl)return !!S.writeOnlyForControl(item.id);if(item.kind==='control'&&S.gateForControl){const gate=S.gateForControl(item.id,state);return !!(gate&&own(prefs,gate.key));}return false;};
    const rows=(g.rows||[]).filter(row=>(row.items||[]).some(relevant)),rowByField=new Map();
    for(const row of rows){const key=row.parentFieldsetId||'';if(!rowByField.has(key))rowByField.set(key,[]);rowByField.get(key).push(row.id);}
    const memo=new Map(),fields=g.fieldsets||[],fieldRelevant=field=>{if(memo.has(field.id))return memo.get(field.id);const direct=(field.legendControls||[]).some(item=>relevant(Object.assign({kind:'control'},item)))||(rowByField.get(field.id)||[]).length>0,child=fields.some(candidate=>candidate.parentId===field.id&&fieldRelevant(candidate)),yes=direct||child;memo.set(field.id,yes);return yes;};
    const expectedRows=rows.map(row=>row.id).filter(Boolean),expectedFieldsets=fields.filter(fieldRelevant).map(field=>field.id).filter(Boolean),expectedControls=[],expectedHelpers=[],items=[];
    for(const field of fields)for(const raw of field.legendControls||[]){const item=Object.assign({kind:'control'},raw);if(relevant(item)&&item.id){expectedControls.push(item.id);items.push(item);}}
    const familyChecks=[];
        for(const row of g.rows||[]){
          const family=row&&row.family;
          if(family?.kind==='time-range'){
            const specs=[family.from,family.to],keys=specs.flatMap(spec=>[String(spec?.hourPreference||''),String(spec?.minutePreference||'')]);
            const sourceItems=(row.items||[]).filter(item=>item?.kind==='control'&&keys.includes(String(item.preferenceKey||'')));
            if(keys.length!==4||new Set(keys).size!==4||sourceItems.length!==4){familyChecks.push({row:row.id,ok:false,reason:'invalid-source-family',keys,sourceControls:sourceItems.map(item=>item.id)});continue;}
            if(!(row.items||[]).some(relevant))continue;
            const node=[...document.querySelectorAll('#settings-content [data-native-row]')].find(n=>n.dataset.nativeRow===row.id);
            const inputs=node?[...node.querySelectorAll('input[type="time"]')]:[],labels=node?[...node.querySelectorAll('.setting-time-label')].map(n=>String(n.textContent||'').trim()):[];
            const expectedValues=specs.map(spec=>{const h=Number(state[spec.hourPreference]),m=Number(state[spec.minutePreference]);return Number.isInteger(h)&&Number.isInteger(m)?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'):'';});
            const actualValues=inputs.map(input=>String(input.value||''));
            const ok=!!node&&node.dataset.nativeFamily==='time-range'&&inputs.length===2&&actualValues.every(value=>/^\d{2}:\d{2}$/.test(value))&&JSON.stringify(actualValues)===JSON.stringify(expectedValues);
            familyChecks.push({row:row.id,ok,kind:'time-range',keys,labels,expectedValues,actualValues,count:inputs.length,nativeFamily:node?.dataset.nativeFamily||''});
            continue;
          }
          for(const item of row.items||[]){if(item.kind==='control'&&relevant(item)&&item.id){expectedControls.push(item.id);items.push(item);}if(item.kind==='helper'&&relevant(item)&&item.id)expectedHelpers.push(item.id);}
        }
    const actualRows=[...document.querySelectorAll('#settings-content [data-native-row]')].map(n=>n.dataset.nativeRow).filter(Boolean),actualFieldsets=[...document.querySelectorAll('#settings-content [data-native-fieldset]')].map(n=>n.dataset.nativeFieldset).filter(Boolean),actualControls=[...document.querySelectorAll('#settings-content [data-native-control]')].map(n=>n.dataset.nativeControl).filter(Boolean),actualHelpers=[...document.querySelectorAll('#settings-content [data-native-helper]')].map(n=>n.dataset.nativeHelper).filter(Boolean);
    const sort=a=>[...a].sort((x,y)=>String(x).localeCompare(String(y))),duplicates=a=>a.filter((x,i)=>a.indexOf(x)!==i);
    let silentDrop=0,stateMismatch=0,unexplainedReadOnly=0,falsePositiveWritable=0,domainFailure=0,optionDomainChecks=0,intrinsicWritable=0,stateMismatchDetails=[];for(const check of familyChecks)if(!check.ok)domainFailure++;const stateCheck=(item,family,editable,locked,interactive)=>{if(editable!==locked)return;stateMismatch++;stateMismatchDetails.push({id:item.id||'',key:item.preferenceKey||item.writeOnly&&item.writeOnly.key||'',family,editable:!!editable,locked:!!locked,tag:interactive&&interactive.tagName||'',disabled:!!(interactive&&interactive.disabled),readOnly:!!(interactive&&interactive.readOnly),ariaDisabled:interactive&&interactive.getAttribute?String(interactive.getAttribute('aria-disabled')||''):''});};
    if(!same(sort(actualRows),sort(expectedRows)))silentDrop++;
    if(!same(sort(actualFieldsets),sort(expectedFieldsets)))silentDrop++;
    if(!same(sort(actualControls),sort(expectedControls)))silentDrop++;
    if(!same(sort(actualHelpers),sort(expectedHelpers)))silentDrop++;
    if(duplicates(actualControls).length||duplicates(actualHelpers).length)silentDrop++;
    for(const item of items){
      const node=[...document.querySelectorAll('#settings-content [data-native-control]')].find(n=>n.dataset.nativeControl===item.id);if(!node){silentDrop++;continue;}
      const interactive=node.matches('input,textarea,button')?node:node.querySelector('.ui-select__trigger,input,textarea,button'),locked=!interactive||interactive.disabled===true||interactive.readOnly===true||interactive.getAttribute('aria-disabled')==='true';
      const projectionAux=S.projectionAuxForControl&&S.projectionAuxForControl(item.id,state,aux);
      if(projectionAux){
        const on=S.projectionAuxValue(item.id,true,state,Object.assign({},aux,{[item.id]:true})),off=S.projectionAuxValue(item.id,false,state,Object.assign({},aux,{[item.id]:false})),enabled=!S.controlEnabled||S.controlEnabled(item,prefs,state,aux),onOk=on&&(!S.isWritable||S.isWritable(on.key,on.value,prefs,Object.assign({},state,{[on.key]:on.value}),Object.assign({},aux,{[item.id]:true}))),offOk=off&&(!S.isWritable||S.isWritable(off.key,off.value,prefs,Object.assign({},state,{[off.key]:off.value}),Object.assign({},aux,{[item.id]:false}))),editable=projectionAux.available&&enabled&&!!onOk&&!!offOk;stateCheck(item,'projection-aux',editable,locked,interactive);continue;
      }
      if(!item.preferenceKey&&item.writeOnly&&S.writeOnlyForControl){
        const meta=S.writeOnlyForControl(item.id),editable=!!(meta&&S.writeOnlyEnabled(meta,prefs,state,aux)&&S.isWritable(meta.key,'a5-secret',prefs,Object.assign({},state,{[meta.key]:'a5-secret'}),aux));stateCheck(item,'write-only',editable,locked,interactive);continue;
      }
      if(item.preferenceKey&&own(prefs,item.preferenceKey)){
        const key=item.preferenceKey,source=S.sourcePreference(key),info=S.describeValue(key,state[key],prefs,state,aux),enabled=!S.controlEnabled||S.controlEnabled(item,prefs,state,aux),editable=!!(info.editable&&enabled),d=source&&source.descriptor||{},p=source&&source.projection||{},intrinsic=!!(source&&R.supportsWriteAction('appcontroller.h:setPreferencesAction')&&d.setterPresent===true&&d.writable===true&&d.typeAgreement==='EXACT'&&d.writeType&&p.safeWrite===true);if(intrinsic)intrinsicWritable++;stateCheck(item,'mapped',editable,locked,interactive);if(intrinsic&&enabled&&info.dependencySatisfied!==false&&!editable)unexplainedReadOnly++;if(!intrinsic&&editable)falsePositiveWritable++;
        if(intrinsic&&Array.isArray(source.options)&&source.options.length){
          for(const option of source.options){const raw=S.toRaw(key,option.value,state,aux),back=S.toDisplay(key,raw);optionDomainChecks++;if(String(back)!==String(option.value))domainFailure++;if(enabled&&info.dependencySatisfied!==false&&!S.isWritable(key,raw,prefs,Object.assign({},state,{[key]:raw}),aux))domainFailure++;}
        }
        continue;
      }
      const gate=S.gateForControl&&S.gateForControl(item.id,state);
      if(gate){
        const on=S.gateValue(item.id,true,state),off=S.gateValue(item.id,false,state),enabled=!S.controlEnabled||S.controlEnabled(item,prefs,state,aux),valid=plan=>!plan||!S.isWritable||S.isWritable(plan.key,plan.value,prefs,Object.assign({},state,{[plan.key]:plan.value}),aux),editable=enabled&&valid(on)&&valid(off);stateCheck(item,'gate',editable,locked,interactive);
      }
    }
    return{expectedRows:expectedRows.length,expectedFieldsets:expectedFieldsets.length,expectedControls:expectedControls.length,expectedHelpers:expectedHelpers.length,silentDrop,stateMismatch,stateMismatchDetails,unexplainedReadOnly,falsePositiveWritable,domainFailure,optionDomainChecks,intrinsicWritable,familyChecks,silentDropDetails:{rows:{expected:sort(expectedRows),actual:sort(actualRows)},fieldsets:{expected:sort(expectedFieldsets),actual:sort(actualFieldsets)},controls:{expected:sort(expectedControls),actual:sort(actualControls)},helpers:{expected:sort(expectedHelpers),actual:sort(actualHelpers)},duplicateControls:duplicates(actualControls),duplicateHelpers:duplicates(actualHelpers)}};
  },tab);}
  async function candidate(page,tab,family){return page.evaluate(({tab,family})=>{
    const S=WeiG.SettingsSchema,prefs=WeiG.SettingsState.prefs||{},aux=WeiG.SettingsState.auxDraft||{},state=Object.assign({},prefs,WeiG.SettingsState.draft||{}),g=S.controlGraph(tab),own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),controls=[];
    if(!g)return null;for(const f of g.fieldsets||[])for(const item of f.legendControls||[])controls.push(Object.assign({kind:'control'},item));for(const r of g.rows||[])for(const item of r.items||[])if(item&&item.kind==='control')controls.push(item);
    const writable=(key,raw,trialAux=aux)=>S.isWritable&&S.isWritable(key,raw,prefs,Object.assign({},state,{[key]:raw}),trialAux)!==false;
    for(const item of controls){
      if(!item.id)continue;const node=[...document.querySelectorAll('#settings-content [data-native-control]')].find(n=>n.dataset.nativeControl===item.id);if(!node)continue;const has=selector=>!!node.querySelector(selector);
      const paux=S.projectionAuxForControl&&S.projectionAuxForControl(item.id,state,aux);
      if(family==='projection-aux'&&has('input[type="checkbox"]')&&paux&&paux.available&&(!S.controlEnabled||S.controlEnabled(item,prefs,state,aux))){const next=!paux.enabled,trial=Object.assign({},aux,{[item.id]:next}),plan=S.projectionAuxValue(item.id,next,state,trial);if(plan&&writable(plan.key,plan.value,trial))return{family,id:item.id,draftKey:plan.key};}
      if(family==='write-only'&&has('input:not([type="checkbox"]),textarea')&&!item.preferenceKey&&item.writeOnly&&S.writeOnlyForControl){const meta=S.writeOnlyForControl(item.id),value='weigg-a5-secret';if(meta&&S.writeOnlyEnabled(meta,prefs,state,aux)&&writable(meta.key,value))return{family,id:item.id,draftKey:meta.key,value};}
      if(!item.preferenceKey||!own(prefs,item.preferenceKey)||paux)continue;
      const key=item.preferenceKey,source=S.sourcePreference(key),raw=state[key],info=S.describeValue(key,raw,prefs,state,aux),enabled=!S.controlEnabled||S.controlEnabled(item,prefs,state,aux);if(!source||!info.editable||!enabled)continue;
      const semantic=String(source.semantic||item.semantic||''),display=S.toDisplay(key,raw),options=Array.isArray(source.options)?source.options:[],attrs=source.attributes||{},type=String(source.descriptor&&source.descriptor.writeType||'');
      if(family==='select'&&has('.ui-select__trigger')&&options.length>1){const alt=options.find(option=>String(option.value)!==String(display));if(!alt)continue;const next=S.toRaw(key,alt.value,state,aux);if(writable(key,next))return{family,id:item.id,draftKey:key,value:alt.value};}
      if(family==='checkbox'&&has('input[type="checkbox"]')&&!options.length){const nextDisplay=!Boolean(display),next=S.toRaw(key,nextDisplay,state,aux);if(writable(key,next))return{family,id:item.id,draftKey:key};}
      if(family==='structured'&&has('.setting-structured-map')&&source.structured&&source.structured.kind==='keyed-map'){const next=Object.assign({},raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{});next['/weigg-a5']=0;if(writable(key,next))return{family,id:item.id,draftKey:key,path:'/weigg-a5'};}
      if(family==='number'&&has('input[type="number"]')&&!options.length){let current=Number(display),step=Number(attrs.step);if(!Number.isFinite(step)||step<=0)step=1;if(!Number.isFinite(current))current=0;const min=Number(attrs.min),max=Number(attrs.max);let value=current+step;if(Number.isFinite(max)&&value>max)value=current-step;if(Number.isFinite(min)&&value<min)value=min;if(value===current)continue;const next=S.toRaw(key,value,state,aux);if(writable(key,next))return{family,id:item.id,draftKey:key,value};}
      if(family==='textarea'&&has('textarea')&&semantic==='textarea'){const value=String(display==null?'':display)+(String(display||'')?'\n':'')+'a5';const next=S.toRaw(key,value,state,aux);if(writable(key,next))return{family,id:item.id,draftKey:key,value};}
      if(family==='text'&&has('input:not([type="checkbox"]):not([type="number"]),textarea')&&!options.length&&!source.structured&&semantic!=='textarea'&&type==='string'){let current=String(display==null?'':display),max=Number(attrs.maxlength),value=current?current+'a':'a5';if(Number.isFinite(max)&&max>0&&value.length>max)value=(current.slice(0,Math.max(0,max-1))+'a').slice(0,max);if(value===current)value=(current==='a'?'b':'a');const next=S.toRaw(key,value,state,aux);if(writable(key,next))return{family,id:item.id,draftKey:key,value};}
    }
    if(family==='gate')for(const item of controls){if(!item.id||item.preferenceKey||item.writeOnly)continue;const node=[...document.querySelectorAll('#settings-content [data-native-control]')].find(n=>n.dataset.nativeControl===item.id);if(!node||!node.querySelector('input[type="checkbox"]'))continue;const gate=S.gateForControl&&S.gateForControl(item.id,state);if(!gate)continue;const plan=S.gateValue(item.id,!gate.enabled,state);if(plan&&writable(plan.key,plan.value))return{family,id:item.id,draftKey:plan.key};}
    return null;
  },{tab,family});}
  async function perform(page,plan){
    const rootNode=page.locator('[data-native-control="'+attr(plan.id)+'"]').first();await rootNode.waitFor({state:'visible'});
    if(plan.family==='select'){await rootNode.locator('.ui-select__trigger').click();const option=page.locator('#weigg-floating-layer .ui-select__option[data-value="'+attr(plan.value)+'"]').first();await option.waitFor({state:'visible'});await option.click();}
    else if(plan.family==='checkbox'||plan.family==='projection-aux'||plan.family==='gate')await rootNode.locator('input[type="checkbox"]').first().click();
    else if(plan.family==='structured'){const table=rootNode.locator('.setting-structured-map'),rows=table.locator('.setting-structured-map__row'),count=await rows.count();assert(count>0,'Structured control '+plan.id+' has no editable row');const input=rows.nth(count-1).locator('[data-structured-path]');await input.fill(plan.path);await input.press('Tab');}
    else{const input=rootNode.locator('input:not([type="checkbox"]),textarea').first();await input.fill(String(plan.value==null?'':plan.value));await input.press('Tab');}
    await page.waitForFunction(key=>Object.prototype.hasOwnProperty.call(WeiG.SettingsState.draft||{},key),plan.draftKey);
  }

  const shard={schemaVersion:1,shardIndex,shardCount,expected:assigned.map(item=>item.qbVersion),releases:[]};
  try{
    let done=0;
    for(const profile of assigned){
      activeProfile=profile;variant={prefs:initialPrefs(),writes:[],reads:0,secrets:[]};
      const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-US'}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))errors.push(message.text());});
      await page.goto('http://'+host+':'+port+'/#/',{waitUntil:'networkidle'});await page.waitForSelector('#torrent-list');
      await page.waitForFunction(version=>window.WeiG&&WeiG.CapabilityRegistry&&WeiG.CapabilityRegistry.releaseIdentity&&WeiG.CapabilityRegistry.releaseIdentity()?.qbVersion===version,profile.qbVersion);
      const identity=await page.evaluate(()=>WeiG.CapabilityRegistry.releaseIdentity());assert(identity&&String(identity.sourceSha||'')===String(profile.sourceSha||''),'Browser exact release source mismatch for '+profile.qbVersion+': '+JSON.stringify(identity));
      await openSettings(page);const seeded=await seedPrefs(page);variant.prefs={...seeded.prefs};assert(seeded.tabs.length>0,profile.qbVersion+': no native Settings tabs');
      const domTabs=await page.locator('#settings-qb-tabs [data-settings-tab]').evaluateAll(nodes=>nodes.map(node=>node.dataset.settingsTab));assert(same(domTabs,seeded.tabs),profile.qbVersion+': Settings tab order drifted');
      const metrics={qbVersion:profile.qbVersion,sourceSha:profile.sourceSha,tabs:seeded.tabs.length,rows:0,fieldsets:0,controls:0,helpers:0,optionDomainChecks:0,interactions:0,writes:0,rereads:0,silentDrop:0,stateMismatch:0,unexplainedReadOnly:0,falsePositiveWritable:0,domainFailure:0,intrinsicWritable:0,interactionFamilies:[],errors:[]};
      for(const tab of seeded.tabs){await selectTab(page,tab);const a=await auditTab(page,tab);assert(!a.error,profile.qbVersion+' '+tab+': '+a.error);if(a.silentDrop)console.log('[A6 silent drop] '+profile.qbVersion+' '+tab+' '+JSON.stringify(a.silentDropDetails));if(a.familyChecks?.length)console.log('[A6 family check] '+profile.qbVersion+' '+tab+' '+JSON.stringify(a.familyChecks));if(a.stateMismatchDetails&&a.stateMismatchDetails.length)console.log('[A5 state mismatch] '+profile.qbVersion+' '+tab+' '+JSON.stringify(a.stateMismatchDetails));for(const key of ['expectedRows','expectedFieldsets','expectedControls','expectedHelpers','optionDomainChecks','silentDrop','stateMismatch','unexplainedReadOnly','falsePositiveWritable','domainFailure','intrinsicWritable']){const target={expectedRows:'rows',expectedFieldsets:'fieldsets',expectedControls:'controls',expectedHelpers:'helpers'}[key]||key;metrics[target]+=Number(a[key]||0);}}
      for(const key of ['silentDrop','stateMismatch','unexplainedReadOnly','falsePositiveWritable','domainFailure'])assert(metrics[key]===0,profile.qbVersion+': '+key+'='+metrics[key]);
      const families=['gate','projection-aux','select','checkbox','number','text','textarea','structured','write-only'],doneFamilies=new Set();
      for(let pass=0;pass<3;pass++)for(const tab of seeded.tabs){await selectTab(page,tab);for(const family of families){if(doneFamilies.has(family))continue;const plan=await candidate(page,tab,family);if(!plan)continue;await perform(page,plan);doneFamilies.add(family);metrics.interactions++;metrics.interactionFamilies.push(family);}}
      assert(metrics.interactions>0,profile.qbVersion+': no safe semantic-generated browser interaction was available');
      const draft=await page.evaluate(()=>JSON.parse(JSON.stringify(WeiG.SettingsState.draft||{})));assert(Object.keys(draft).length>0,profile.qbVersion+': interactions produced no Settings draft');
      const writesBefore=variant.writes.length,readsBefore=variant.reads;await page.locator('#save-settings-btn').click();await page.waitForFunction(()=>Object.keys(WeiG.SettingsState.draft||{}).length===0);assert(variant.writes.length>writesBefore,profile.qbVersion+': save did not call app/setPreferences');const rereadDeadline=Date.now()+5000;while(variant.reads<=readsBefore&&Date.now()<rereadDeadline)await new Promise(resolve=>setTimeout(resolve,25));assert(variant.reads>readsBefore,profile.qbVersion+': save did not verify app/preferences reread');
      const patch=variant.writes.at(-1)||{};for(const key of Object.keys(draft))assert(Object.prototype.hasOwnProperty.call(patch,key),profile.qbVersion+': writable draft key '+key+' was silently dropped from setPreferences');
      for(const [key,value] of Object.entries(patch)){if(key==='web_ui_password')continue;assert(same(variant.prefs[key],value),profile.qbVersion+': reread value drifted for '+key);}
      const passwordReadable=(profile.preferenceKeys||[]).includes('web_ui_password');assert(Object.prototype.hasOwnProperty.call(variant.prefs,'web_ui_password')===passwordReadable,profile.qbVersion+': web_ui_password GET surface diverged from exact upstream preferenceKeys');
      metrics.writes=variant.writes.length;metrics.rereads=variant.reads-readsBefore;metrics.errors=errors;assert(errors.length===0,profile.qbVersion+' browser errors: '+errors.join(' | '));
      shard.releases.push(metrics);done++;console.log('[A5 settings browser shard '+shardIndex+'] '+done+'/'+assigned.length+' qB '+profile.qbVersion+' tabs='+metrics.tabs+' controls='+metrics.controls+' interactions='+metrics.interactions+' domains='+metrics.optionDomainChecks);
      await context.close();
    }
    await fs.writeFile(output,JSON.stringify(shard,null,2)+'\n','utf8');
    console.log('A5 admitted Settings browser shard '+shardIndex+' passed: executed='+shard.releases.length+'/'+assigned.length+' -> '+path.basename(output));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
