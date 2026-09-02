(function(global){
  'use strict';
  var W=global.WeiG,U=W.util,T=W.t||function(k){return k;};
  var BRAND_ICON_URL='https://raw.githubusercontent.com/weigefenxiang/WeiG-OpenWrt-AutoBuild/main/site/wrt/Wei.G.ico';

  var FACETS=[
    {id:'tracker-section',nav:'tracker-nav',label:'sidebar.trackers',attr:'tracker',shortKey:'v036.facet.tracker',shortFallback:'Tracker'},
    {id:'savepath-section',nav:'savepath-nav',label:'sidebar.savePath',attr:'savepath',shortKey:'v036.facet.path',shortFallback:'Path'},
    {id:'category-section',nav:'category-nav',label:'sidebar.categories',attr:'category',shortKey:'v036.facet.category',shortFallback:'Category'},
    {id:'tag-section',nav:'tag-nav',label:'sidebar.tags',attr:'tag',shortKey:'v036.facet.tag',shortFallback:'Tag'}
  ];

  function installBrandStyles(){
    if(document.querySelector('link[data-weigg-layer="brand-031"]'))return;
    var link=document.createElement('link');
    link.rel='stylesheet';
    link.href=W.buildAssetUrl?W.buildAssetUrl('css/brand-v031.css'):'css/brand-v031.css';
    link.dataset.weiggLayer='brand-031';
    document.head.appendChild(link);
  }

  function ensureFavicon(){
    var favicon=document.querySelector('link[rel~="icon"]');
    if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon);}
    favicon.type='image/png';
    favicon.setAttribute('sizes','64x64');
    return favicon;
  }

  function paintBrandFavicon(img){
    var favicon=ensureFavicon();
    try{
      var canvas=document.createElement('canvas');
      canvas.width=64;canvas.height=64;
      var ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Canvas unavailable');
      ctx.clearRect(0,0,64,64);

      ctx.save();
      ctx.shadowColor='rgba(83,137,255,.52)';
      ctx.shadowBlur=10;
      var ring=ctx.createLinearGradient(8,8,56,56);
      ring.addColorStop(0,'#38d6ff');
      ring.addColorStop(.34,'#7297ff');
      ring.addColorStop(.68,'#816fff');
      ring.addColorStop(1,'#4f8cff');
      ctx.fillStyle=ring;
      ctx.beginPath();ctx.arc(32,32,29,0,Math.PI*2);ctx.fill();
      ctx.restore();

      ctx.fillStyle='#08111f';
      ctx.beginPath();ctx.arc(32,32,25.5,0,Math.PI*2);ctx.fill();

      ctx.save();
      ctx.beginPath();ctx.arc(32,32,23.5,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img,8.5,8.5,47,47);
      var gloss=ctx.createLinearGradient(13,10,48,54);
      gloss.addColorStop(0,'rgba(255,255,255,.22)');
      gloss.addColorStop(.34,'rgba(255,255,255,.045)');
      gloss.addColorStop(.62,'rgba(255,255,255,0)');
      gloss.addColorStop(1,'rgba(56,214,255,.07)');
      ctx.fillStyle=gloss;ctx.fillRect(8,8,48,48);
      ctx.restore();

      ctx.lineWidth=1.35;
      ctx.strokeStyle='rgba(226,236,255,.72)';
      ctx.beginPath();ctx.arc(32,32,25.8,0,Math.PI*2);ctx.stroke();
      favicon.href=canvas.toDataURL('image/png');
    }catch(_e){favicon.href=BRAND_ICON_URL;}
  }

  function syncBrandCopy(){
    var brand=U.$('brand-btn');if(!brand)return;
    var label=T('app.home');
    brand.setAttribute('aria-label',label);
    brand.title=label;
  }

  function installBranding(){
    var favicon=ensureFavicon();
    favicon.href=BRAND_ICON_URL;
    var back=U.$('back-btn');
    if(back){back.textContent='';back.setAttribute('aria-hidden','true');back.tabIndex=-1;}
    var mark=document.querySelector('.brand__mark');
    if(mark){
      mark.textContent='';
      mark.style.borderRadius='50%';
      mark.style.overflow='visible';
      mark.style.padding='2px';
      var img=document.createElement('img');
      img.crossOrigin='anonymous';
      img.alt='Wei.G';
      img.decoding='async';
      img.addEventListener('load',function(){paintBrandFavicon(img);},{once:true});
      img.addEventListener('error',function(){favicon.href=BRAND_ICON_URL;},{once:true});
      img.src=BRAND_ICON_URL;
      mark.appendChild(img);
      if(W.AmbientMark&&W.AmbientMark.install)W.AmbientMark.install(mark);
    }
    syncBrandCopy();
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

  function isMobile(){return !!(global.matchMedia&&global.matchMedia('(max-width: 820px)').matches);}
  function shortFacetLabel(def){
    var value=W.V036I18n&&W.V036I18n.t?W.V036I18n.t(def.shortKey):def.shortFallback;
    return value&&value!==def.shortKey?value:def.shortFallback;
  }
  function facetValue(nav,def){
    var active=nav&&nav.querySelector('.nav-item.is-active');
    if(isMobile()&&active&&def.attr&&(active.dataset[def.attr]===undefined||active.dataset[def.attr]===''))return shortFacetLabel(def);
    return activeLabel(nav);
  }
  function updateFacetTrigger(wrap,nav,def){
    var value=wrap.querySelector('.facet-trigger__value');
    if(value)value.textContent=facetValue(nav,def);
    var label=wrap.querySelector('.facet-trigger__label');
    if(label)label.textContent=T(def.label);
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
    var value=document.createElement('span');value.className='facet-trigger__value';value.textContent=facetValue(nav,def);
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
      setTimeout(function(){updateFacetTrigger(wrap,nav,def);panel.hidden=true;trigger.setAttribute('aria-expanded','false');},0);
    });

    var observer=new MutationObserver(function(){
      updateFacetTrigger(wrap,nav,def);
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

  function syncRouteFrame(){
    var shell=U.$('app');if(!shell)return;
    var route=W.Router&&W.Router.route?W.Router.route():{name:'home'};
    var name=route&&route.name||'home';
    var torrentRoute=name==='home'||name==='torrent';
    shell.classList.toggle('is-tool-route',!torrentRoute);
    if(!torrentRoute){var sidebar=U.$('sidebar'),scrim=U.$('drawer-scrim');if(sidebar)sidebar.classList.remove('is-open');if(scrim)scrim.classList.remove('is-open');}
  }

  function polishSettingCards(){
    U.$$('#settings-content .setting-card,#settings-content .settings-control').forEach(function(card){
      var title=card.querySelector('strong');
      if(title&&!title.title)title.title=title.textContent.trim();
    });
  }

  function syncSettingsTabState(){
    var root=U.$('settings-content');if(!root)return;
    var active=document.querySelector('#settings-tabs [data-settings-tab].is-active');
    var tab=active&&active.dataset.settingsTab||'weigg';
    root.dataset.settingsTab=tab;
    var language=root.querySelector('[data-v021-language]');
    if(language){var hide=tab!=='weigg';if(language.hidden!==hide)language.hidden=hide;}
  }

  function balanceSettingGroup(group){
    var all=Array.from(group.children).filter(function(card){return card.matches&&card.matches('.setting-card,.settings-control');});
    all.forEach(function(card){card.classList.remove('setting-card--half','setting-card--full');});
    if(global.innerWidth<1500)return;
    var cards=all.filter(function(card){return !card.hidden;});
    var n=cards.length;if(!n)return;
    if(n===1){cards[0].classList.add('setting-card--full');return;}
    if(n===2||n===4){cards.forEach(function(card){card.classList.add('setting-card--half');});return;}
    if(n%3===1&&n>4){cards.slice(-4).forEach(function(card){card.classList.add('setting-card--half');});return;}
    if(n%3===2){cards.slice(-2).forEach(function(card){card.classList.add('setting-card--half');});}
  }

  function balanceSettingGroups(){
    U.$$('#settings-content .settings-group').forEach(balanceSettingGroup);
  }

  function syncSettingsPresentation(){
    polishSettingCards();
    syncSettingsTabState();
    balanceSettingGroups();
  }

  function observeSettings(){
    var root=U.$('settings-content');
    if(!root||root.__v022Observed)return;
    root.__v022Observed=true;
    var pending=false;
    new MutationObserver(function(){
      if(pending)return;pending=true;
      requestAnimationFrame(function(){pending=false;syncSettingsPresentation();});
    }).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    syncSettingsPresentation();
  }

  function syncLocale(){
    U.$$('.facet-filter').forEach(function(wrap){
      var def=FACETS.find(function(x){return x.id===wrap.dataset.facet;});
      if(!def)return;
      updateFacetTrigger(wrap,U.$(def.nav),def);
      var search=wrap.querySelector('.facet-search');if(search){search.placeholder=T('nav.search')+'…';search.setAttribute('aria-label',T('nav.search'));}
    });
    syncBrandCopy();
    syncSettingsPresentation();
  }

  function init(){
    if(document.documentElement.dataset.spatialV022==='1')return;
    document.documentElement.dataset.spatialV022='1';
    installBrandStyles();
    installBranding();
    installFilterShelf();
    installConnectionDock();
    syncRouteFrame();
    observeSettings();
    document.addEventListener('click',function(){closeAllFacets();});
    global.addEventListener('hashchange',function(){closeAllFacets();syncRouteFrame();setTimeout(syncSettingsPresentation,80);});
    global.addEventListener('resize',function(){requestAnimationFrame(function(){balanceSettingGroups();syncLocale();});});
    global.addEventListener('weigg:languagechange',syncLocale);
    setTimeout(function(){syncLocale();syncSettingsPresentation();syncRouteFrame();},900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0);});
  else setTimeout(init,0);
})(window);
