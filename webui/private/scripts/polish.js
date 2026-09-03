(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util;
  if(!W||!U||W.PolishRuntime)return;

  var initialized=false,tooltipNode=null;
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function tooltipText(target){if(!target)return'';var id=target.id;if(id==='theme-btn')return label('Toggle theme','切换主题');if(/logout/i.test(id)||target.dataset.action==='logout')return label('Log out','注销');return target.dataset.tooltip||target.getAttribute('aria-label')||target.title||'';}
  function ensureTooltip(){if(tooltipNode)return tooltipNode;tooltipNode=document.createElement('div');tooltipNode.id='polish-tooltip';tooltipNode.className='tooltip polish-tooltip';tooltipNode.setAttribute('role','tooltip');document.body.appendChild(tooltipNode);return tooltipNode;}
  function positionTooltip(target){var tip=ensureTooltip(),r=target.getBoundingClientRect(),box=tip.getBoundingClientRect(),left=Math.min(innerWidth-box.width-8,Math.max(8,r.left+(r.width-box.width)/2)),top=r.bottom+8;if(top+box.height>innerHeight-8)top=Math.max(8,r.top-box.height-8);tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(top)+'px';}
  function showTooltip(target){var text=tooltipText(target);if(!text)return;var tip=ensureTooltip();tip.textContent=text;tip.classList.add('is-visible');tip.dataset.for=target.id||'';requestAnimationFrame(function(){positionTooltip(target);});}
  function hideTooltip(){if(tooltipNode)tooltipNode.classList.remove('is-visible');}
  function triggerFrom(event){return event.target&&event.target.closest&&event.target.closest('.icon-btn[data-polish-tooltip],#theme-btn,[data-action="logout"],[data-tooltip]');}
  function installTooltips(){if(document.documentElement.dataset.polishTooltips==='1')return;document.documentElement.dataset.polishTooltips='1';var theme=document.getElementById('theme-btn');if(theme){theme.dataset.polishTooltip='1';if(theme.title)theme.removeAttribute('title');}document.addEventListener('mouseover',function(e){var t=triggerFrom(e);if(t)showTooltip(t);});document.addEventListener('mouseout',function(e){var t=triggerFrom(e);if(t)hideTooltip();});document.addEventListener('focusin',function(e){var t=triggerFrom(e);if(t)showTooltip(t);});document.addEventListener('focusout',function(e){var t=triggerFrom(e);if(t)hideTooltip();});}

  function init(){if(initialized)return;initialized=true;installTooltips();}
  W.PolishRuntime={init:init};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
