(function(global){
  'use strict';
  var W=global.WeiG;
  if(!W||!W.util)return;
  var U=W.util,T=W.t||function(k){return k;};

  var FACETS=[
    {id:'tracker-section',nav:'tracker-nav',label:'sidebar.trackers'},
    {id:'savepath-section',nav:'savepath-nav',label:'sidebar.savePath'},
    {id:'category-section',nav:'category-nav',label:'sidebar.categories'},
    {id:'tag-section',nav:'tag-nav',label:'sidebar.tags'}
  ];

  function installBranding(){
    var icon='/Wei.G.ico';
    var favicon=document.querySelector('link[rel~="icon"]');
    if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon);}
    favicon.type='image/png';favicon.href=icon;
    var mark=document.querySelector('.brand__mark');
    if(mark){
      mark.textContent='';
      mark.style.borderRadius='50%';
      mark.style.overflow='hidden';
      mark.style.padding='2px';
      var img=document.createElement('img');
      img.src=icon;img.alt='Wei.G';
      img.style.display='block';img.style.width='100%';img.style.height='100%';img.style.objectFit='cover';img.style.borderRadius='50%';
      mark.appendChild(img);
    }
  }

  function closeAllFacets(except){
    U.$$('.facet-filter').forEach(function(wrap){
      if(except&&wrap===except)return;
      var trigger=wrap.querySelector('.facet-trigger'),panel=wrap.querySelector('.facet-popover');
      if(trigger)trigger.setAttribute('aria-expanded','false');
      if(panel)panel.hidden=true;
    });
  }

  function activeLabel(nav){
    var active=nav&&nav.querySelector('.nav-item.is-active');
    if(!active)return T('filter.all');
    return String(active.textContent||'').replace(/\s·\s\d+$/,'').trim()||T('filter.all');
  }

  function updateFacetTrigger(wrap,nav,labelKey){
    var value=wrap.querySelector('.facet-trigger__value');
    if(value)value.textContent=activeLabel(nav);
    var label=wrap.querySelector('.facet-trigger__label');
    if(label)label.textContent=T(labelKey);
  }

  function addFacetSearch(panel,nav){
    var input=document.createElement('input');
    input.type='search';
    input.className='facet-search';
    input.autocomplete='off';
    input.placeholder=T('nav.search')+'…';
    input.setAttribute('aria-label',T('nav.search'));
    input.addEventListener('input',function(){
      var q=input.value.trim().toLocaleLowerCase();
      Array.from(nav.querySelectorAll('.nav-item')).forEach(function(btn){
        btn.hidden=!!q&&String(btn.textContent||'').toLocaleLowerCase().indexOf(q)<0;
      });
    });
    panel.insertBefore(input,panel.firstChild);
  }

  function createFacet(def,shelf){
    var section=U.$(def.id),nav=U.$(def.nav);
    if(!section||!nav)return null;
    var wrap=document.createElement('div');
    wrap.className='facet-filter';
    wrap.dataset.facet=def.id;

    var trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='facet-trigger';
    trigger.setAttribute('aria-expanded','false');
    var label=document.createElement('span');label.className='facet-trigger__label';label.textContent=T(def.label);
    var value=document.createElement('span');value.className='facet-trigger__value';value.textContent=activeLabel(nav);
    var chevron=document.createElement('span');chevron.className='facet-trigger__chevron';chevron.textContent='▾';
    trigger.append(label,value,chevron);

    var panel=document.createElement('div');
    panel.className='facet-popover surface surface--floating';
    panel.hidden=true;
    panel.appendChild(section);
    addFacetSearch(panel,nav);
    wrap.append(trigger,panel);
    shelf.appendChild(wrap);

    trigger.addEventListener('click',function(e){
      e.stopPropagation();
      var open=panel.hidden;
      closeAllFacets(wrap);
      panel.hidden=!open;
      trigger.setAttribute('aria-expanded',open?'true':'false');
      if(open){var search=panel.querySelector('.facet-search');if(search){search.value='';Array.from(nav.querySelectorAll('.nav-item')).forEach(function(b){b.hidden=false;});setTimeout(function(){search.focus();},30);}}
    });
    panel.addEventListener('click',function(e){e.stopPropagation();});
    nav.addEventListener('click',function(e){
      if(!e.target.closest('.nav-item'))return;
      setTimeout(function(){updateFacetTrigger(wrap,nav,def.label);panel.hidden=true;trigger.setAttribute('aria-expanded','false');},0);
    });

    var observer=new MutationObserver(function(){
      updateFacetTrigger(wrap,nav,def.label);
      wrap.hidden=!!section.hidden;
    });
    observer.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    observer.observe(section,{attributes:true,attributeFilter:['hidden']});
    wrap.hidden=!!section.hidden;
    return wrap;
  }

  function installFilterShelf(){
    var list=U.$('list-view');
    if(!list||U.$('filter-shelf'))return;
    var header=list.querySelector('.workspace__header');
    if(!header)return;
    var shelf=document.createElement('div');
    shelf.id='filter-shelf';
    shelf.className='filter-shelf';
    FACETS.forEach(function(def){createFacet(def,shelf);});
    var spacer=document.createElement('span');spacer.className='filter-shelf__spacer';
    var summary=document.createElement('span');summary.className='filter-shelf__summary';summary.textContent='qBittorrent';
    shelf.append(spacer,summary);
    header.insertAdjacentElement('afterend',shelf);
  }

  function installConnectionDock(){
    if(document.querySelector('.connection-dock'))return;
    var meta=document.querySelector('.sidebar__meta'),statusbar=document.querySelector('.statusbar'),old=U.$('status-connection');
    if(!meta||!statusbar||!old)return;

    var dock=document.createElement('span');dock.className='connection-dock';
    var trigger=document.createElement('button');
    trigger.type='button';trigger.className='connection-dock__trigger';trigger.id='status-connection';
    trigger.textContent=old.textContent||'● —';trigger.setAttribute('aria-expanded','false');
    old.replaceWith(dock);dock.appendChild(trigger);

    var panel=document.createElement('div');panel.className='connection-dock__popover surface surface--floating';panel.hidden=true;
    panel.appendChild(meta);dock.appendChild(panel);
    trigger.addEventListener('click',function(e){
      e.stopPropagation();
      var open=panel.hidden;panel.hidden=!open;trigger.setAttribute('aria-expanded',open?'true':'false');
      closeAllFacets();
    });
    panel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');});
  }

  function polishSettingCards(){
    U.$$('#settings-content .setting-card,#settings-content .settings-control').forEach(function(card){
      var title=card.querySelector('strong');
      if(title&&!title.title)title.title=title.textContent.trim();
    });
  }

  function observeSettings(){
    var root=U.$('settings-content');
    if(!root||root.__v022Observed)return;
    root.__v022Observed=true;
    var pending=false;
    new MutationObserver(function(){
      if(pending)return;pending=true;
      requestAnimationFrame(function(){pending=false;polishSettingCards();});
    }).observe(root,{childList:true,subtree:true});
    polishSettingCards();
  }

  function syncLocale(){
    U.$$('.facet-filter').forEach(function(wrap){
      var def=FACETS.find(function(x){return x.id===wrap.dataset.facet;});
      if(!def)return;
      updateFacetTrigger(wrap,U.$(def.nav),def.label);
      var search=wrap.querySelector('.facet-search');if(search){search.placeholder=T('nav.search')+'…';search.setAttribute('aria-label',T('nav.search'));}
    });
  }

  function init(){
    if(document.documentElement.dataset.spatialV022==='1')return;
    document.documentElement.dataset.spatialV022='1';
    installBranding();
    installFilterShelf();
    installConnectionDock();
    observeSettings();
    document.addEventListener('click',function(){closeAllFacets();});
    global.addEventListener('hashchange',function(){closeAllFacets();setTimeout(polishSettingCards,80);});
    global.addEventListener('weigg:languagechange',syncLocale);
    setTimeout(function(){syncLocale();polishSettingCards();},900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0);});
  else setTimeout(init,0);
})(window);
