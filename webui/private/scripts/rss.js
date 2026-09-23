(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components;
  if(!W||!W.QBClient||!C||!C.selectControl||W.RSSRules)return;
  var R=W.CapabilityRegistry,own=Object.prototype.hasOwnProperty;
  function tr(key,vars){return W.I18n&&W.I18n.t?W.I18n.t(key,vars):String(key||'');}
  function hasAction(name){return !!(R&&typeof R.hasAction==='function'&&R.hasAction(name));}
  function canWrite(name){return !!(R&&typeof R.supportsWriteAction==='function'&&R.supportsWriteAction(name));}
  var state={rules:{},selected:'',draft:null,newDraft:false,matching:{},busy:false,root:null,dialog:null,list:null,editor:null,status:null,disabledNote:null,matchingRoot:null,manifest:null,manifestTask:null,manifestStatus:'IDLE',manifestError:null,controls:{}};
  var workspace={status:'IDLE',feeds:[],selectedPath:'',error:''};
  function clone(value){if(value===undefined)return undefined;try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
  function button(copyText,kind){var el=document.createElement('button');el.type='button';el.className='btn '+(kind||'btn--ghost');el.textContent=copyText;return el;}
  function input(type,value){var el=document.createElement('input');el.type=type||'text';el.className='field-input';if(type==='checkbox')el.checked=!!value;else el.value=value==null?'':String(value);return el;}
  function field(labelText,control){var label=document.createElement('label');label.className=control.type==='checkbox'?'check-row':'field';var span=document.createElement('span');span.textContent=labelText;label.appendChild(control);if(control.type==='checkbox')label.appendChild(span);else label.insertBefore(span,control);return label;}
  function ownKey(obj,key){return !!obj&&own.call(obj,key);}
  function setStatus(message,error){if(!state.status)return;state.status.textContent=message||'';state.status.classList.toggle('danger-text',!!error);}
  function currentClient(){return W.AppState&&W.AppState.client;}
  function workspaceRoot(){return document.getElementById('rss-content');}
  function collectWorkspaceFeeds(obj,path,out){Object.keys(obj||{}).forEach(function(key){var value=obj[key],next=path?path+'\\'+key:key;if(value&&typeof value==='object'&&!Array.isArray(value)&&(typeof value.url==='string'||Array.isArray(value.articles)))out.push({name:key,path:next,data:value});else if(value&&typeof value==='object'&&!Array.isArray(value))collectWorkspaceFeeds(value,next,out);});return out;}
  function workspaceFeed(){for(var i=0;i<workspace.feeds.length;i++)if(workspace.feeds[i].path===workspace.selectedPath)return workspace.feeds[i];return workspace.feeds[0]||null;}
  function workspaceEmpty(host,message){var node=document.createElement('p');node.className='text-description rss-workspace__empty';node.textContent=message;host.appendChild(node);}
  function workspaceAction(copyText,handler,kind){var el=button(copyText,kind||'btn--ghost');el.addEventListener('click',handler);return el;}
  function renderWorkspace(){var root=workspaceRoot();if(!root)return;root.classList.add('rss-workspace');root.dataset.rssState=workspace.status;root.textContent='';
    var feedsPane=document.createElement('section');feedsPane.className='rss-workspace__pane rss-workspace__feeds';var feedsHead=document.createElement('header');feedsHead.className='rss-workspace__pane-head';var feedsTitle=document.createElement('strong');feedsTitle.textContent=tr('rss.workspace.subscriptions');var feedsActions=document.createElement('span');feedsActions.className='rss-workspace__pane-actions';feedsHead.append(feedsTitle,feedsActions);var feedList=document.createElement('div');feedList.className='rss-workspace__list rss-feed-list';feedsPane.append(feedsHead,feedList);
    var articlesPane=document.createElement('section');articlesPane.className='rss-workspace__pane rss-workspace__articles';var articlesHead=document.createElement('header');articlesHead.className='rss-workspace__pane-head';var articlesTitle=document.createElement('strong');articlesTitle.textContent=tr('rss.workspace.articles');var articleActions=document.createElement('span');articleActions.className='rss-workspace__pane-actions';if(hasAction('rsscontroller.h:rulesAction')){var downloader=workspaceAction('RSS Downloader',function(){});if(W.ActionRegistry)W.ActionRegistry.bind(downloader,'rss.downloader.open');else downloader.disabled=true;articleActions.appendChild(downloader);}articlesHead.append(articlesTitle,articleActions);var articleList=document.createElement('div');articleList.className='rss-workspace__list rss-article-list';articlesPane.append(articlesHead,articleList);var horizontalDivider=document.createElement('span');horizontalDivider.className='rss-workspace__divider rss-workspace__divider--horizontal';horizontalDivider.setAttribute('aria-hidden','true');var verticalDivider=document.createElement('span');verticalDivider.className='rss-workspace__divider rss-workspace__divider--vertical';verticalDivider.setAttribute('aria-hidden','true');root.append(feedsPane,articlesPane,horizontalDivider,verticalDivider);
    if(workspace.status==='LOADING'){workspaceEmpty(feedList,tr('rss.workspace.loadingSubscriptions'));workspaceEmpty(articleList,tr('rss.workspace.loadingArticles'));return;}
    if(workspace.status==='UNSUPPORTED'){workspaceEmpty(feedList,tr('rss.workspace.itemsUnsupported'));workspaceEmpty(articleList,tr('rss.workspace.browseUnavailable'));return;}
    if(workspace.status==='ERROR'){workspaceEmpty(feedList,tr('rss.workspace.loadFailed'));workspaceEmpty(articleList,workspace.error||tr('rss.workspace.requestFailed'));return;}
    if(!workspace.feeds.length){workspaceEmpty(feedList,tr('rss.workspace.noSubscriptions'));workspaceEmpty(articleList,tr('rss.workspace.addFeedHint'));return;}
    workspace.feeds.forEach(function(feed){var value=feed.data||{},articles=Array.isArray(value.articles)?value.articles:[],unread=articles.filter(function(article){return article&&article.isRead!==true;}).length,item=document.createElement('button');item.type='button';item.className='rss-feed-item tool-row';item.classList.toggle('is-active',feed.path===workspace.selectedPath);item.dataset.rssFeedPath=feed.path;var copy=document.createElement('span');copy.className='rss-feed-item__copy';var name=document.createElement('strong');name.textContent=String(value.title||feed.name);var path=document.createElement('small');path.textContent=feed.path;copy.append(name,path);var count=document.createElement('span');count.className='rss-feed-item__count';count.textContent=unread+'/'+articles.length;item.append(copy,count);item.addEventListener('click',function(){workspace.selectedPath=feed.path;renderWorkspace();});feedList.appendChild(item);});
    var selected=workspaceFeed();if(!selected)return;workspace.selectedPath=selected.path;var selectedArticles=Array.isArray(selected.data&&selected.data.articles)?selected.data.articles:[],selectedUnread=selectedArticles.filter(function(article){return article&&article.isRead!==true;}).length;
    if(canWrite('rsscontroller.h:refreshItemAction'))feedsActions.appendChild(workspaceAction(tr('rss.workspace.refreshSelected'),async function(){var client=currentClient();if(!client)return;await client.rssRefreshItem(selected.path);await loadWorkspace();}));
    if(canWrite('rsscontroller.h:markAsReadAction')&&selectedUnread>0)feedsActions.appendChild(workspaceAction(tr('rss.workspace.markFeedRead'),async function(){var client=currentClient();if(!client)return;await client.rssMarkAsRead(selected.path);await loadWorkspace();}));
    if(canWrite('rsscontroller.h:removeItemAction'))feedsActions.appendChild(workspaceAction(tr('tracker.remove'),async function(){if(!global.confirm(tr('rss.workspace.removeSubscriptionConfirm')))return;var client=currentClient();if(!client)return;await client.rssRemoveItem(selected.path);workspace.selectedPath='';await loadWorkspace();},'btn--danger-ghost'));
    articlesTitle.textContent=String(selected.data&&selected.data.title||selected.name||tr('rss.workspace.articles'));
    if(!selectedArticles.length){workspaceEmpty(articleList,tr('rss.workspace.noArticles'));return;}
    selectedArticles.forEach(function(article){article=article&&typeof article==='object'?article:{};var row=document.createElement('article');row.className='rss-article-row tool-row';row.dataset.read=article.isRead===true?'true':'false';var copy=document.createElement('span');copy.className='rss-article-row__copy';var title;if(article.link){title=document.createElement('a');title.href=String(article.link);title.target='_blank';title.rel='noopener noreferrer';title.textContent=String(article.title||article.id||tr('rss.workspace.untitledArticle'));}else{title=document.createElement('strong');title.textContent=String(article.title||article.id||tr('rss.workspace.untitledArticle'));}var meta=document.createElement('small');meta.textContent=[article.author,article.date].filter(Boolean).join(' · ');copy.append(title,meta);var actions=document.createElement('span');actions.className='rss-article-row__actions';var read=document.createElement('span');read.className='rss-article-row__state';read.textContent=article.isRead===true?tr('rss.workspace.read'):tr('rss.workspace.unread');actions.appendChild(read);if(canWrite('rsscontroller.h:markAsReadAction')&&article.isRead!==true&&article.id!=null)actions.appendChild(workspaceAction(tr('rss.workspace.markArticleRead'),async function(){var client=currentClient();if(!client)return;await client.rssMarkAsRead(selected.path,article.id);await loadWorkspace();}));row.append(copy,actions);articleList.appendChild(row);});
    if(W.RSS&&typeof W.RSS.apply==='function')W.RSS.apply(root);
  }
  async function loadWorkspace(){var client=currentClient();if(!hasAction('rsscontroller.h:itemsAction')){workspace.status='UNSUPPORTED';workspace.feeds=[];workspace.error='';renderWorkspace();return false;}if(!client){workspace.status='ERROR';workspace.error=tr('runtime.clientNotReady');renderWorkspace();return false;}workspace.status='LOADING';workspace.error='';renderWorkspace();try{var data=await client.rssItems(true),feeds=collectWorkspaceFeeds(data||{},'',[]),selected=workspace.selectedPath;workspace.feeds=feeds;if(!selected||!feeds.some(function(feed){return feed.path===selected;}))workspace.selectedPath=feeds[0]&&feeds[0].path||'';workspace.status=feeds.length?'READY':'EMPTY';renderWorkspace();return true;}catch(error){workspace.status='ERROR';workspace.error=String(error&&error.message||error);workspace.feeds=[];renderWorkspace();return false;}}
  async function addWorkspaceFeed(url,path){var client=currentClient();if(!client)throw new Error(tr('runtime.clientNotReady'));if(!canWrite('rsscontroller.h:addFeedAction'))throw new Error(tr('rss.workspace.addFeedUnproven'));await client.rssAddFeed(String(url||''),String(path||''));return loadWorkspace();}
  function workspaceSnapshot(){return{status:workspace.status,feeds:workspace.feeds.map(function(feed){return{path:feed.path,name:feed.name};}),selectedPath:workspace.selectedPath,error:workspace.error};}
  function sourceText(ref,fallback){var source=String(ref&&ref.source||fallback||'');return W.I18n&&W.I18n.qbSourceText?W.I18n.qbSourceText(ref,source):source;}
  function nativeCopy(key,fallback){return sourceText(state.manifest&&state.manifest.copy&&state.manifest.copy[key],fallback);}
  function autoDownloadEnabled(){var prefs=W.AppState&&W.AppState.preferences;return !prefs||prefs.rss_auto_downloading_enabled!==false;}
  function renderAutoDownloadState(){if(!state.root)return;if(!state.disabledNote){state.disabledNote=document.createElement('p');state.disabledNote.className='text-description rss-downloader-disabled';state.disabledNote.hidden=true;var head=state.root.querySelector('.workspace__header');if(head&&head.nextSibling)state.root.insertBefore(state.disabledNote,head.nextSibling);else state.root.appendChild(state.disabledNote);}var disabled=!autoDownloadEnabled();state.disabledNote.hidden=!disabled;state.disabledNote.textContent=disabled?nativeCopy('disabled','Auto downloading of RSS torrents is disabled now! You can enable it in application settings.'):'';}
  function resolveTimeline(changes,qb){if(!Array.isArray(changes)||!changes.length||!R||typeof R.compareVersions!=='function')return null;var hit=null;for(var i=0;i<changes.length;i++){if(R.compareVersions(changes[i].from,qb)<=0)hit=changes[i].value;else break;}return clone(hit);}
  async function ensureManifest(){
    if(state.manifestTask)return state.manifestTask;
    state.manifestStatus='LOADING';state.manifestError=null;
    state.manifestTask=Promise.resolve().then(async function(){
      if(!R||typeof R.ensure!=='function'||typeof R.domain!=='function'||typeof R.domainResolution!=='function')return null;
      await R.ensure('rss');
      var release=R.domainResolution('rss');
      if(!release||release.fallback===true)return null;
      var domain=R.domain('rss'),changes=domain&&domain.sourceFacts&&domain.sourceFacts.rssDownloaderUi;
      var value=resolveTimeline(changes,release.qbVersion);
      return value&&value.available===true&&Array.isArray(value.fields)?value:null;
    }).then(function(value){state.manifest=value;state.manifestStatus=value?'AVAILABLE':'UNSUPPORTED';return value;}).catch(function(error){state.manifest=null;state.manifestStatus='ERROR';state.manifestError=error;return null;}).finally(function(){state.manifestTask=null;});
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
    else if(fieldDef.kind==='triState'||fieldDef.kind==='select'){var options=Array.isArray(fieldDef.options)?fieldDef.options:[];control=C.selectControl({value:String(selectedOption(fieldDef,value)),options:options.map(function(item,index){return{value:String(index),label:sourceText(item.translation,item.value)};}),ariaLabel:sourceText(fieldDef.translation,fieldDef.key)});}else if(fieldDef.kind==='tags')control=input('text',Array.isArray(value)?value.join(', '):(value==null?'':value));
    else control=input('text',value);
    control.dataset.rssRuleField=String(fieldDef.controlId||fieldDef.key||'');control.dataset.rssRuleKey=String(fieldDef.key||'');if(fieldDef.kind==='triState'||fieldDef.kind==='select')control.dataset.rssCanonicalSelect='1';
    return control;
  }
  function valueFromControl(fieldDef,control,current){
    if(fieldDef.kind==='checkbox')return !!control.checked;
    if(fieldDef.kind==='number')return Math.max(Number.isFinite(Number(fieldDef.min))?Number(fieldDef.min):0,Number(control.value)||0);
    if(fieldDef.kind==='feeds')return String(control.value||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
    if(fieldDef.kind==='triState'||fieldDef.kind==='select'){var options=Array.isArray(fieldDef.options)?fieldDef.options:[],selected=control&&typeof control.getValue==='function'?control.getValue():control.value,item=options[Number(selected)||0];return item&&ownKey(item,'writeValue')?clone(item.writeValue):current;}
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
  function collectionAvailable(){var collection=state.manifest&&state.manifest.collection||{};return !!(collection.listControlId&&collection.addControlId&&collection.removeControlId);}
  function startNewRule(){if(state.busy||!collectionAvailable()||!canWrite('rsscontroller.h:setRuleAction'))return;state.selected='';state.draft=emptyDraft();state.newDraft=true;state.matching={};render();}
  async function selectRule(name){state.selected=name;state.draft=clone(state.rules[name]||{});state.newDraft=false;state.matching={};render();await loadMatchingArticles();}
  function renderList(){
    if(!state.list)return;state.list.textContent='';
    var head=document.createElement('div');head.className='rss-rule-collection__head';var title=document.createElement('strong');title.className='rss-rule-collection__title';title.textContent=nativeCopy('rules','Download Rules');var actions=document.createElement('span');actions.className='rss-rule-collection__actions';
    var add=button('+','btn--ghost');add.classList.add('rss-rule-collection__action');add.dataset.rssRuleCollectionAction='add';add.setAttribute('aria-label',tr('rss.rule.addNew'));add.title=tr('rss.rule.addNew');add.disabled=!collectionAvailable()||!canWrite('rsscontroller.h:setRuleAction');add.addEventListener('click',startNewRule);
    var remove=button('−','btn--ghost');remove.classList.add('rss-rule-collection__action');remove.dataset.rssRuleCollectionAction='remove';remove.setAttribute('aria-label',tr('rss.rule.delete'));remove.title=tr('rss.rule.delete');remove.disabled=!state.newDraft&&(!state.selected||!collectionAvailable()||!canWrite('rsscontroller.h:removeRuleAction'));remove.addEventListener('click',removeRule);actions.append(remove,add);head.append(title,actions);state.list.appendChild(head);
    var list=document.createElement('div');list.className='rss-rule-collection__list';var names=Object.keys(state.rules||{}).sort(function(a,b){return a.localeCompare(b);});
    if(state.newDraft){var draftRow=button(tr('rss.rule.new'),'btn--ghost');draftRow.classList.add('is-active');draftRow.dataset.rssRuleDraft='new';draftRow.disabled=true;list.appendChild(draftRow);}
    names.forEach(function(name){var row=button(name,'btn--ghost');row.dataset.rssRuleName=name;row.classList.toggle('is-active',!state.newDraft&&name===state.selected);row.addEventListener('click',function(){selectRule(name);});list.appendChild(row);});
    if(!names.length&&!state.newDraft){var empty=document.createElement('p');empty.className='text-description';empty.textContent=tr('rss.rule.none');list.appendChild(empty);}state.list.appendChild(list);
  }
  function renderMatchingArticles(){
    var root=state.matchingRoot;if(!root)return;root.textContent='';if(!state.selected||!hasAction('rsscontroller.h:matchingArticlesAction'))return;
    var title=document.createElement('h3');title.textContent=nativeCopy('matching','Matching RSS Articles');root.appendChild(title);var feeds=Object.keys(state.matching||{});
    if(!feeds.length){var empty=document.createElement('p');empty.className='text-description';empty.textContent=tr('rss.rule.noMatchingArticles');root.appendChild(empty);return;}
    feeds.forEach(function(feed){var block=document.createElement('div');block.className='rss-rule-matches';var name=document.createElement('strong');name.textContent=feed;block.appendChild(name);var list=document.createElement('ul');(Array.isArray(state.matching[feed])?state.matching[feed]:[]).forEach(function(article){var li=document.createElement('li');li.textContent=String(article);list.appendChild(li);});block.appendChild(list);root.appendChild(block);});
  }
  async function loadMatchingArticles(){var client=currentClient();if(!client||!state.selected||!hasAction('rsscontroller.h:matchingArticlesAction')){state.matching={};renderMatchingArticles();return;}try{var data=await client.rssMatchingArticles(state.selected);state.matching=data&&typeof data==='object'&&!Array.isArray(data)?data:{};renderMatchingArticles();}catch(error){state.matching={};renderMatchingArticles();setStatus(tr('rss.rule.matchLoadFailedPrefix')+(error&&error.message||error),true);}}
  function renderEditor(){
    var root=state.editor;if(!root)return;root.textContent='';state.matchingRoot=null;state.controls={};
    if(!state.draft){var p=document.createElement('p');p.className='text-description';p.textContent=tr('rss.rule.selectOrCreate');root.appendChild(p);return;}
    var rule=state.draft,heading=document.createElement('h3');heading.textContent=nativeCopy('definition','Rule Definition');root.appendChild(heading);
    var form=document.createElement('div');form.className='settings-grid';var nameControl=input('text',state.newDraft?'':state.selected);nameControl.placeholder=tr('rss.rule.newName');nameControl.dataset.rssRuleField='name';form.appendChild(field(tr('rss.rule.name'),nameControl));state.controls.name=nameControl;
    (state.manifest.fields||[]).forEach(function(fieldDef){var control=controlFor(fieldDef,rule),labelText=sourceText(fieldDef.translation,fieldDef.key);state.controls[fieldDef.controlId||fieldDef.key]=control;form.appendChild(field(labelText,control));});
    root.appendChild(form);
    var actions=document.createElement('div');actions.className='dialog__actions';var saveBtn=button(nativeCopy('save','Save'),'btn--primary');saveBtn.dataset.rssRuleSave='1';saveBtn.disabled=!canWrite('rsscontroller.h:setRuleAction');saveBtn.addEventListener('click',saveRule);actions.appendChild(saveBtn);
    root.appendChild(actions);
    if(ownKey(rule,'lastMatch')&&rule.lastMatch){var last=document.createElement('p');last.className='text-description';last.textContent=tr('rss.rule.lastMatchPrefix')+String(rule.lastMatch);root.appendChild(last);}
    state.matchingRoot=document.createElement('section');state.matchingRoot.className='rss-matching-articles';root.appendChild(state.matchingRoot);renderMatchingArticles();
  }
  function collect(){
    var rule=clone(state.draft||emptyDraft()),name=String(state.controls.name&&state.controls.name.value||'').trim();
    (state.manifest&&state.manifest.fields||[]).forEach(function(fieldDef){var control=state.controls[fieldDef.controlId||fieldDef.key];if(!control)return;var current=readPath(rule,fieldDef.path),next=valueFromControl(fieldDef,control,current);writePath(rule,fieldDef.path,next);});
    return{name:name,rule:rule};
  }
  async function saveRule(){
    if(state.busy)return;var client=currentClient(),value=collect();if(!client||!value.name)return setStatus(tr('rss.rule.nameRequired'),true);
    if(!state.manifest||!canWrite('rsscontroller.h:setRuleAction'))return setStatus(tr('rss.rule.writeUnproven'),true);
    state.busy=true;setStatus(tr('rss.rule.saving'));
    try{if(state.selected&&state.selected!==value.name){if(!canWrite('rsscontroller.h:renameRuleAction'))throw new Error(tr('rss.rule.renameUnproven'));await client.rssRenameRule(state.selected,value.name);}await client.rssSetRule(value.name,value.rule);state.selected=value.name;state.newDraft=false;await loadRules();await loadMatchingArticles();setStatus(tr('rss.rule.saved'));}catch(error){setStatus(tr('rss.rule.saveFailedPrefix')+(error&&error.message||error),true);}finally{state.busy=false;}
  }
  async function removeRule(){if(state.busy)return;if(state.newDraft&&!state.selected){state.newDraft=false;state.draft=null;state.matching={};render();setStatus(tr('rss.rule.draftDiscarded'));return;}if(!state.selected)return;var client=currentClient();if(!client||!state.manifest||!collectionAvailable()||!canWrite('rsscontroller.h:removeRuleAction'))return;state.busy=true;setStatus(tr('rss.rule.removing'));try{await client.rssRemoveRule(state.selected);state.selected='';state.draft=null;state.newDraft=false;state.matching={};await loadRules();setStatus(tr('rss.rule.removed'));}catch(error){setStatus(tr('rss.rule.removeFailedPrefix')+(error&&error.message||error),true);}finally{state.busy=false;}}
  function render(){renderAutoDownloadState();renderList();renderEditor();}
  async function loadRules(){var client=currentClient();if(!state.root||!state.manifest||!client||!hasAction('rsscontroller.h:rulesAction'))return;try{var rules=await client.rssRules();state.rules=rules&&typeof rules==='object'&&!Array.isArray(rules)?rules:{};if(state.selected&&ownKey(state.rules,state.selected))state.draft=clone(state.rules[state.selected]);else if(state.selected){state.selected='';state.draft=null;state.matching={};}render();}catch(error){setStatus(tr('rss.rule.loadFailedPrefix')+(error&&error.message||error),true);}}
  function teardown(){if(state.dialog&&W.DialogRuntime)W.DialogRuntime.remove(state.dialog);else if(state.root)state.root.remove();state.root=null;state.dialog=null;state.list=null;state.editor=null;state.status=null;state.disabledNote=null;state.matchingRoot=null;state.newDraft=false;state.controls={};}
  async function install(){
    var view=document.getElementById('rss-view');if(!view||document.getElementById('rss-rules-dialog'))return;
    var manifest=await ensureManifest();if(!manifest||!hasAction('rsscontroller.h:rulesAction'))return;
    var dialog=W.DialogRuntime.create({id:'rss-rules-dialog',className:'dialog surface surface--modal rss-rules-dialog',draggable:true});var panel=document.createElement('div');panel.id='rss-rules-panel';panel.className='rss-downloader-workspace';var head=document.createElement('div');head.className='workspace__header';var title=document.createElement('h2');title.textContent='RSS Downloader';head.appendChild(title);
    var actions=document.createElement('div');actions.className='inline-form';var refresh=button(tr('rss.rule.refresh'),'btn--ghost');refresh.addEventListener('click',loadRules);var close=button(tr('app.close'),'btn--ghost');close.addEventListener('click',function(){W.DialogRuntime.close(dialog);});actions.append(refresh,close);head.appendChild(actions);panel.appendChild(head);
    var layout=document.createElement('div');layout.className='settings-layout';state.list=document.createElement('nav');state.list.id='rss-rules-list';state.list.className='settings-tabs';state.editor=document.createElement('div');state.editor.id='rss-rule-editor';state.editor.className='settings-content';layout.appendChild(state.list);layout.appendChild(state.editor);panel.appendChild(layout);state.status=document.createElement('p');state.status.className='text-description';panel.appendChild(state.status);dialog.appendChild(panel);state.root=panel;state.dialog=dialog;renderAutoDownloadState();await loadRules();
  }
  async function openResolved(){if(W.Router&&W.Router.go)W.Router.go('rss');else location.hash='#/rss';await install();renderAutoDownloadState();if(!state.dialog)throw new Error(tr('rss.rule.downloaderUnavailable'));W.DialogRuntime.open(state.dialog,{draggable:true});return true;}
  async function open(){return W.ActionRegistry?W.ActionRegistry.invoke('rss.downloader.open'):false;}
  function registerDownloaderAction(){if(!W.ActionRegistry)return;W.ActionRegistry.register('rss.downloader.open',{resolve:async function(){await ensureManifest();if(state.manifestStatus==='ERROR')return{state:'ERROR',reason:tr('rss.rule.compatLoadFailed'),error:state.manifestError};if(!state.manifest||!hasAction('rsscontroller.h:rulesAction'))return{state:'UNSUPPORTED',reason:tr('rss.rule.downloaderUnproven')};return{state:'AVAILABLE'};},run:openResolved});}
  async function refresh(){await ensureManifest();if(!state.root)await install();else{renderAutoDownloadState();if(location.hash.replace(/^#\/?/,'').split('/')[0]==='rss')await loadRules();}}
  function resetForEnvironment(){state.manifest=null;state.manifestTask=null;state.manifestStatus='IDLE';state.manifestError=null;teardown();if(W.ActionRegistry)W.ActionRegistry.invalidate('rss.downloader.open');install();}
  registerDownloaderAction();
  W.RSSWorkspace={load:loadWorkspace,refresh:loadWorkspace,addFeed:addWorkspaceFeed,render:renderWorkspace,state:workspaceSnapshot};
  W.RSSRules={install:install,open:open,refresh:refresh,loadRules:loadRules,loadMatchingArticles:loadMatchingArticles,state:function(){return{selected:state.selected,newDraft:state.newDraft,rules:Object.keys(state.rules||{}),matching:clone(state.matching||{}),manifest:clone(state.manifest||null),autoDownloadEnabled:autoDownloadEnabled()};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  global.addEventListener('hashchange',refresh);global.addEventListener('weig:capabilities-ready',resetForEnvironment);global.addEventListener('weig:languagechange',function(){teardown();install();});
})(window);
