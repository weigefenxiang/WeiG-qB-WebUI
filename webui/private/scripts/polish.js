(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util;
  if(!W||!U||W.PolishRuntime)return;

  var initialized=false,tooltipNode=null;
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function connectionState(text){text=String(text||'').toLocaleLowerCase();if(/disconnect|offline|异常|断开|未连接|error/.test(text))return'disconnected';if(/firewall|limited|受限|防火墙/.test(text))return'limited';return'connected';}
  function syncConnectionIndicator(){var node=document.getElementById('status-connection');if(!node)return;var copy=String(node.textContent||'').replace(/^●\s*/,'').trim()||'—';node.classList.add('connection-indicator');node.dataset.connectionState=connectionState(copy);if(node.textContent!==copy)node.textContent=copy;}
  function pulseConnection(){var node=document.getElementById('status-connection');if(!node)return;node.classList.remove('is-refresh-pulse');void node.offsetWidth;node.classList.add('is-refresh-pulse');setTimeout(function(){node.classList.remove('is-refresh-pulse');},620);}

  function tooltipText(target){if(!target)return'';var id=target.id;if(id==='refresh-btn')return label('Refresh data','刷新数据');if(id==='theme-btn')return label('Toggle theme','切换主题');if(/logout/i.test(id)||target.dataset.action==='logout')return label('Log out','注销');return target.dataset.tooltip||target.getAttribute('aria-label')||target.title||'';}
  function ensureTooltip(){if(tooltipNode)return tooltipNode;tooltipNode=document.createElement('div');tooltipNode.id='polish-tooltip';tooltipNode.className='tooltip polish-tooltip';tooltipNode.setAttribute('role','tooltip');document.body.appendChild(tooltipNode);return tooltipNode;}
  function positionTooltip(target){var tip=ensureTooltip(),r=target.getBoundingClientRect(),box=tip.getBoundingClientRect(),left=Math.min(innerWidth-box.width-8,Math.max(8,r.left+(r.width-box.width)/2)),top=r.bottom+8;if(top+box.height>innerHeight-8)top=Math.max(8,r.top-box.height-8);tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(top)+'px';}
  function showTooltip(target){var text=tooltipText(target);if(!text)return;var tip=ensureTooltip();tip.textContent=text;tip.classList.add('is-visible');tip.dataset.for=target.id||'';requestAnimationFrame(function(){positionTooltip(target);});}
  function hideTooltip(){if(tooltipNode)tooltipNode.classList.remove('is-visible');}
  function installTooltips(){if(document.documentElement.dataset.polishTooltips==='1')return;document.documentElement.dataset.polishTooltips='1';['refresh-btn','theme-btn'].forEach(function(id){var node=document.getElementById(id);if(node){node.dataset.polishTooltip='1';if(node.title)node.removeAttribute('title');}});document.addEventListener('mouseover',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)showTooltip(t);});document.addEventListener('mouseout',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)hideTooltip();});document.addEventListener('focusin',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)showTooltip(t);});document.addEventListener('focusout',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)hideTooltip();});}

  function init(){if(initialized)return;initialized=true;installTooltips();syncConnectionIndicator();global.addEventListener('weigg:status-state',syncConnectionIndicator);global.addEventListener('weigg:library-state',function(){syncConnectionIndicator();pulseConnection();});global.addEventListener('weigg:languagechange',syncConnectionIndicator);}
  W.PolishRuntime={init:init,syncConnectionIndicator:syncConnectionIndicator,pulseConnection:pulseConnection};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
