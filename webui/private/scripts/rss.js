(function(global){
  'use strict';
  var W=global.WeiG;
  if(!W||!W.QBClient||W.RSSRules)return;
  var R=W.CapabilityRegistry,own=Object.prototype.hasOwnProperty;
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function text(en,cn){return zh()?cn:en;}
  function hasAction(name){return !!(R&&typeof R.hasAction==='function'&&R.hasAction(name));}
  function canWrite(name){return !!(R&&typeof R.supportsWriteAction==='function'&&R.supportsWriteAction(name));}
  var state={rules:{},selected:'',draft:null,matching:{},busy:false,root:null,list:null,editor:null,status:null,disabledNote:null,matchingRoot:null,manifest:null,manifestTask:null,controls:{}};
  function clone(value){if(value===undefined)return undefined;try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
  function button(copyText,kind){var el=document.createElement('button');el.type='button';el.className='btn '+(kind||'btn--ghost');el.textContent=copyText;return el;}
  function input(type,value){var el=document.createElement('input');el.type=type||'text';el.className='field-input';if(type==='checkbox')el.checked=!!value;else el.value=value==null?'':String(value);return el;}
  function field(labelText,control){var label=document.createElement('label');label.className=control.type==='checkbox'?'check-row':'field';var span=document.createElement('span');span.textContent=labelText;label.appendChild(control);if(control.type==='checkbox')label.appendChild(span);else label.insertBefore(span,control);return label;}
  function ownKey(obj,key){return !!obj&&own.call(obj,key);}
  function setStatus(message,error){if(!state.status)return;state.status.textContent=message||'';state.status.classList.toggle('danger-text',!!error);}
  function currentClient(){return W.AppState&&W.AppState.client;}
  function sourceText(ref,fallback){var source=String(ref&&ref.source||fallback||'');return W.I18n&&W.I18n.qbSourceText?W.I18n.qbSourceText(ref,source):source;}
  function nativeCopy(key,fallback){return sourceText(state.manifest&&state.manifest.copy&&state.manifest.copy[key],fallback);}
  function autoDownloadEnabled(){var prefs=W.AppState&&W.AppState.preferences;return !prefs||prefs.rss_auto_downloading_enabled!==false;}
  function renderAutoDownloadState(){if(!state.root)return;if(!state.disabledNote){state.disabledNote=document.createElement('p');state.disabledNote.className='text-description rss-downloader-disabled';state.disabledNote.hidden=true;var head=state.root.querySelector('.workspace__header');if(head&&head.nextSibling)state.root.insertBefore(state.disabledNote,head.nextSibling);else state.root.appendChild(state.disabledNote);}var disabled=!autoDownloadEnabled();state.disabledNote.hidden=!disabled;state.disabledNote.textContent=disabled?nativeCopy('disabled','Auto downloading of RSS torrents is disabled now! You can enable it in application settings.'):'';}
  function resolveTimeline(changes,qb){if(!Array.isArray(changes)||!changes.length||!R||typeof R.compareVersions!=='function')return null;var hit=null;for(var i=0;i<changes.length;i++){if(R.compareVersions(changes[i].from,qb)<=0)hit=changes[i].value;else break;}return clone(hit);}
  async function ensureManifest(){
    if(state.manifestTask)return state.manifestTask;
    state.manifestTask=Promise.resolve().then(async function(){
      if(!R||typeof R.ensure!=='function'||typeof R.domain!=='function'||typeof R.releaseIdentity!=='function')return null;
      await R.ensure('rss');
      var release=R.releaseIdentity();
      if(!release||release.certified!==true)return null;
      var domain=R.domain('rss'),changes=domain&&domain.sourceFacts&&domain.sourceFacts.rssDownloaderUi;
      var value=resolveTimeline(changes,release.qbVersion);
      return value&&value.available===true&&Array.isArray(value.fields)?value:null;
    }).then(function(value){state.manifest=value;return value;}).catch(function(){state.manifest=null;return null;}).finally(function(){state.manifestTask=null;});
    return state.manifestTask;
  }
  function readPath(rule,path){if(!Array.isArray(path)||path.length!==2)return undefined;var obj=path[0]==='torrentParams'?rule&&rule.torrentParams:rule;return obj?obj[path[1]]:undefined;}
  function writePath(rule,path,value){if(!Array.isArray(path)||path.length!==2)return;var obj;if(path[0]==='torrentParams'){obj=rule.torrentParams&&typeof rule.torrentParams==='object'?rule.torrentParams:(rule.torrentParams={});}else obj=rule;obj[path[1]]=clone(value);}
  function sameValue(a,b){if(a===b)return true;if(a==null||b==null)return a==null&&b==null;try{return JSON.stringify(a)===JSON.stringify(b);}catch(_e){return false;}}
  function selectedOption(fieldDef,value){var options=Array.isArray(fieldDef.options)?fieldDef.options:[];for(var i=0;i<options.length;i++)if(sameValue(options[i].writeValue,value))return i;return 0;}
  function controlFor(fieldDef,rule){
    var value=readPath(rule,fieldDef.path),control;
    if(fieldDef.kind==='checkbox')control=input('checkbox',value);
    else if(fieldDef.kind==='number'){control=input('number',value);if(Number.isFinite(Number(fieldDef.min)))control.min=String(fieldDef.min);}
    else if(fieldDef.kind==='feeds'){control=document.createElement('textarea');control.className='field-input';control.rows=4;control.value=Array.isArray(value)?value.join('\n'):'';}
    else if(fieldDef.kind==='triState'||fieldDef.kind==='select'){
      control=document.createElement('select');control.className='field-input';var options=Array.isArray(fieldDef.options)?fieldDef.options:[];
      options.forEach(function(item,index){var op=document.createElement('option');op.value=String(index);op.textContent=sourceText(item.translation,item.value);control.appendChild(op);});
      control.value=String(selectedOption(fieldDef,value));
    }else if(fieldDef.kind==='tags')control=input('text',Array.isArray(value)?value.join(', '):(value==null?'':value));
    else control=input('text',value);
    control.dataset.rssRuleField=String(fieldDef.controlId||fieldDef.key||'');
    return control;
  }
  function valueFromControl(fieldDef,control,current){
    if(fieldDef.kind==='checkbox')return !!control.checked;
    if(fieldDef.kind==='number')return Math.max(Number.isFinite(Number(fieldDef.min))?Number(fieldDef.min):0,Number(control.value)||0);
    if(fieldDef.kind==='feeds')return String(control.value||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
    if(fieldDef.kind==='triState'||fieldDef.kind==='select'){var options=Array.isArray(fieldDef.options)?fieldDef.options:[],item=options[Number(control.value)||0];return item&&ownKey(item,'writeValue')?clone(item.writeValue):current;}
    if(fieldDef.kind==='tags'){var raw=String(control.value||'');return Array.isArray(current)?raw.split(',').map(function(x){return x.trim();}).filter(Boolean):raw;}
    return String(control.value||'');
  }
  function defaultValue(fieldDef){
    if(fieldDef.kind==='checkbox')return false;
    if(fieldDef.kind==='number')return Number.isFinite(Number(fieldDef.min))?Number(fieldDef.min):0;
    if(fieldDef.kind==='feeds'||fieldDef.kind==='tags')return [];
    if(fieldDef.kind==='triState'||fieldDef.kind==='select'){var options=Array.isArray(fieldDef.options)?fieldDef.options:[];var preferred=options.find(function(item){return item.value==='default'||item.value==='Default';})||options[0];return preferred&&ownKey(preferred,'writeValue')?clone(preferred.writeValue):null;}
    return'';
  }
  function emptyDraft(){var rule={enabled:true};(state.manifest&&state.manifest.fields||[]).forEach(function(fieldDef){writePath(rule,fieldDef.path,defaultValue(fieldDef));});return rule;}
  async function selectRule(name){state.selected=name;state.draft=clone(state.rules[name]||{});state.matching={};render();await loadMatchingArticles();}
  function renderList(){
    if(!state.list)return;state.list.textContent='';var title=document.createElement('div');title.className='settings-tabs__title';title.textContent=nativeCopy('rules','Download Rules');state.list.appendChild(title);
    var names=Object.keys(state.rules||{}).sort(function(a,b){return a.localeCompare(b);});
    if(!names.length){var empty=document.createElement('p');empty.className='text-description';empty.textContent=text('No download rules.','暂无下载规则。');state.list.appendChild(empty);return;}
    names.forEach(function(name){var row=button(name,'btn--ghost');row.classList.toggle('is-active',name===state.selected);row.addEventListener('click',function(){selectRule(name);});state.list.appendChild(row);});
  }
  function renderMatchingArticles(){
    var root=state.matchingRoot;if(!root)return;root.textContent='';if(!state.selected||!hasAction('rsscontroller.h:matchingArticlesAction'))return;
    var title=document.createElement('h3');title.textContent=nativeCopy('matching','Matching RSS Articles');root.appendChild(title);var feeds=Object.keys(state.matching||{});
    if(!feeds.length){var empty=document.createElement('p');empty.className='text-description';empty.textContent=text('No matching articles.','没有匹配的文章。');root.appendChild(empty);return;}
    feeds.forEach(function(feed){var block=document.createElement('div');block.className='rss-rule-matches';var name=document.createElement('strong');name.textContent=feed;block.appendChild(name);var list=document.createElement('ul');(Array.isArray(state.matching[feed])?state.matching[feed]:[]).forEach(function(article){var li=document.createElement('li');li.textContent=String(article);list.appendChild(li);});block.appendChild(list);root.appendChild(block);});
  }
  async function loadMatchingArticles(){var client=currentClient();if(!client||!state.selected||!hasAction('rsscontroller.h:matchingArticlesAction')){state.matching={};renderMatchingArticles();return;}try{var data=await client.rssMatchingArticles(state.selected);state.matching=data&&typeof data==='object'&&!Array.isArray(data)?data:{};renderMatchingArticles();}catch(error){state.matching={};renderMatchingArticles();setStatus(text('Failed to load matching articles: ','读取匹配文章失败：')+(error&&error.message||error),true);}}
  function renderEditor(){
    var root=state.editor;if(!root)return;root.textContent='';state.matchingRoot=null;state.controls={};
    if(!state.draft){var p=document.createElement('p');p.className='text-description';p.textContent=text('Select a rule or create a new one.','选择一个规则或新建规则。');root.appendChild(p);return;}
    var rule=state.draft,heading=document.createElement('h3');heading.textContent=nativeCopy('definition','Rule Definition');root.appendChild(heading);
    var form=document.createElement('div');form.className='settings-grid';var nameControl=input('text',state.selected||text('New rule','新规则'));nameControl.dataset.rssRuleField='name';form.appendChild(field(text('Rule name','规则名称'),nameControl));state.controls.name=nameControl;
    (state.manifest.fields||[]).forEach(function(fieldDef){var control=controlFor(fieldDef,rule),labelText=sourceText(fieldDef.translation,fieldDef.key);state.controls[fieldDef.controlId||fieldDef.key]=control;form.appendChild(field(labelText,control));});
    root.appendChild(form);
    var actions=document.createElement('div');actions.className='dialog__actions';var saveBtn=button(nativeCopy('save','Save'),'btn--primary');saveBtn.disabled=!canWrite('rsscontroller.h:setRuleAction');saveBtn.addEventListener('click',saveRule);actions.appendChild(saveBtn);
    if(state.selected){var del=button(text('Delete','删除'),'btn--danger-ghost');del.disabled=!canWrite('rsscontroller.h:removeRuleAction');del.addEventListener('click',removeRule);actions.appendChild(del);}root.appendChild(actions);
    if(ownKey(rule,'lastMatch')&&rule.lastMatch){var last=document.createElement('p');last.className='text-description';last.textContent=text('Last Match: ','上次匹配：')+String(rule.lastMatch);root.appendChild(last);}
    state.matchingRoot=document.createElement('section');state.matchingRoot.className='rss-matching-articles';root.appendChild(state.matchingRoot);renderMatchingArticles();
  }
  function collect(){
    var rule=clone(state.draft||emptyDraft()),name=String(state.controls.name&&state.controls.name.value||'').trim();
    (state.manifest&&state.manifest.fields||[]).forEach(function(fieldDef){var control=state.controls[fieldDef.controlId||fieldDef.key];if(!control)return;var current=readPath(rule,fieldDef.path),next=valueFromControl(fieldDef,control,current);writePath(rule,fieldDef.path,next);});
    return{name:name,rule:rule};
  }
  async function saveRule(){
    if(state.busy)return;var client=currentClient(),value=collect();if(!client||!value.name)return setStatus(text('Rule name is required.','必须填写规则名称。'),true);
    if(!state.manifest||!canWrite('rsscontroller.h:setRuleAction'))return setStatus(text('This RSS rule write is not source-proven for the current qBittorrent release.','当前 qBittorrent 版本没有源码证明支持 RSS 规则写入。'),true);
    state.busy=true;setStatus(text('Saving rule…','正在保存规则…'));
    try{if(state.selected&&state.selected!==value.name){if(!canWrite('rsscontroller.h:renameRuleAction'))throw new Error(text('This qBittorrent release cannot safely rename RSS rules.','当前 qBittorrent 版本无法安全重命名 RSS 规则。'));await client.rssRenameRule(state.selected,value.name);}await client.rssSetRule(value.name,value.rule);state.selected=value.name;await loadRules();await loadMatchingArticles();setStatus(text('RSS rule saved.','RSS 规则已保存。'));}catch(error){setStatus(text('Failed to save RSS rule: ','保存 RSS 规则失败：')+(error&&error.message||error),true);}finally{state.busy=false;}
  }
  async function removeRule(){if(state.busy||!state.selected)return;var client=currentClient();if(!client||!state.manifest||!canWrite('rsscontroller.h:removeRuleAction'))return;state.busy=true;setStatus(text('Removing rule…','正在删除规则…'));try{await client.rssRemoveRule(state.selected);state.selected='';state.draft=null;state.matching={};await loadRules();setStatus(text('RSS rule removed.','RSS 规则已删除。'));}catch(error){setStatus(text('Failed to remove RSS rule: ','删除 RSS 规则失败：')+(error&&error.message||error),true);}finally{state.busy=false;}}
  function render(){renderAutoDownloadState();renderList();renderEditor();}
  async function loadRules(){var client=currentClient();if(!state.root||!state.manifest||!client||!hasAction('rsscontroller.h:rulesAction'))return;try{var rules=await client.rssRules();state.rules=rules&&typeof rules==='object'&&!Array.isArray(rules)?rules:{};if(state.selected&&ownKey(state.rules,state.selected))state.draft=clone(state.rules[state.selected]);else if(state.selected){state.selected='';state.draft=null;state.matching={};}render();}catch(error){setStatus(text('Failed to load RSS rules: ','读取 RSS 规则失败：')+(error&&error.message||error),true);}}
  function teardown(){if(state.root)state.root.remove();state.root=null;state.list=null;state.editor=null;state.status=null;state.disabledNote=null;state.matchingRoot=null;state.controls={};}
  async function install(){
    var view=document.getElementById('rss-view');if(!view||document.getElementById('rss-rules-panel'))return;
    var manifest=await ensureManifest();if(!manifest||!hasAction('rsscontroller.h:rulesAction'))return;
    var panel=document.createElement('div');panel.id='rss-rules-panel';panel.className='tool-page surface surface--panel';var head=document.createElement('div');head.className='workspace__header';var title=document.createElement('h2');title.textContent='RSS Downloader';head.appendChild(title);
    var actions=document.createElement('div');actions.className='inline-form';var add=button(text('New rule','新建规则'),'btn--primary');add.disabled=!canWrite('rsscontroller.h:setRuleAction');add.addEventListener('click',function(){state.selected='';state.draft=emptyDraft();state.matching={};render();});var refresh=button(text('Refresh rules','刷新规则'),'btn--ghost');refresh.addEventListener('click',loadRules);actions.appendChild(add);actions.appendChild(refresh);head.appendChild(actions);panel.appendChild(head);
    var layout=document.createElement('div');layout.className='settings-layout';state.list=document.createElement('nav');state.list.id='rss-rules-list';state.list.className='settings-tabs';state.editor=document.createElement('div');state.editor.id='rss-rule-editor';state.editor.className='settings-content';layout.appendChild(state.list);layout.appendChild(state.editor);panel.appendChild(layout);state.status=document.createElement('p');state.status.className='text-description';panel.appendChild(state.status);var existing=view.querySelector('.tool-page');if(existing&&existing.parentNode)existing.parentNode.insertBefore(panel,existing.nextSibling);else view.appendChild(panel);state.root=panel;renderAutoDownloadState();await loadRules();
  }
  async function open(){if(W.Router&&W.Router.go)W.Router.go('rss');else location.hash='#/rss';await install();renderAutoDownloadState();if(state.root&&state.root.scrollIntoView)state.root.scrollIntoView({block:'start'});}
  async function refresh(){await ensureManifest();if(!state.root)await install();else{renderAutoDownloadState();if(location.hash.replace(/^#\/?/,'').split('/')[0]==='rss')await loadRules();}}
  function resetForEnvironment(){state.manifest=null;state.manifestTask=null;teardown();install();}
  W.RSSRules={install:install,open:open,refresh:refresh,loadRules:loadRules,loadMatchingArticles:loadMatchingArticles,state:function(){return{selected:state.selected,rules:Object.keys(state.rules||{}),matching:clone(state.matching||{}),manifest:clone(state.manifest||null),autoDownloadEnabled:autoDownloadEnabled()};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  global.addEventListener('hashchange',refresh);global.addEventListener('weigg:capabilities-ready',resetForEnvironment);global.addEventListener('weigg:languagechange',function(){teardown();install();});
})(window);
