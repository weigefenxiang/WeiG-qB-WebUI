(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var U=W.util={};
  U.$=function(id){return document.getElementById(id);};
  U.clamp=function(v,min,max){return Math.min(max,Math.max(min,v));};
  U.escapeText=function(v){return v==null?'':String(v);};
  U.formatBytes=function(value){var n=Number(value)||0;if(n<1024)return n+' B';var units=['KiB','MiB','GiB','TiB','PiB'],i=-1;do{n/=1024;i++;}while(n>=1024&&i<units.length-1);return (n>=100?n.toFixed(0):n>=10?n.toFixed(1):n.toFixed(2))+' '+units[i];};
  U.formatSpeed=function(value){return U.formatBytes(value)+'/s';};
  U.formatEta=function(value){var s=Number(value);if(!isFinite(s)||s<0||s>=8640000)return '∞';if(s===0)return '0s';var d=Math.floor(s/86400);s%=86400;var h=Math.floor(s/3600);s%=3600;var m=Math.floor(s/60);if(d)return d+'d '+h+'h';if(h)return h+'h '+m+'m';if(m)return m+'m';return Math.floor(s)+'s';};
  U.formatRatio=function(v){var n=Number(v);return isFinite(n)&&n>=0?n.toFixed(2):'—';};
  U.percent=function(v){return Math.round((Number(v)||0)*1000)/10;};
  U.form=function(obj){var p=new URLSearchParams();Object.keys(obj||{}).forEach(function(k){if(obj[k]!==undefined&&obj[k]!==null)p.append(k,String(obj[k]));});return p.toString();};
  U.debounce=function(fn,wait){var t;return function(){var a=arguments,c=this;clearTimeout(t);t=setTimeout(function(){fn.apply(c,a);},wait);};};
  U.isMobile=function(){return matchMedia('(max-width: 820px)').matches;};
  U.time=function(){return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});};
  U.hashes=function(set){return Array.from(set).join('|');};

  W.toast=function(message,tone){var region=U.$('toast-region');if(!region)return;var el=document.createElement('div');el.className='toast';if(tone)el.dataset.tone=tone;el.textContent=message;region.appendChild(el);setTimeout(function(){el.remove();},3600);};
  W.fatal=function(error){var box=U.$('fatal'),msg=U.$('fatal-message');if(msg)msg.textContent=(error&&error.message)||String(error||'未知错误');if(box)box.classList.remove('is-hidden');};

  W.Router={
    route:function(){var raw=(location.hash||'#/').replace(/^#/,'');var parts=raw.split('/').filter(Boolean);return {name:parts[0]||'home',id:parts[1]||'',tab:parts[2]||''};},
    home:function(){location.hash='#/';},
    detail:function(hash,tab){location.hash='#/torrent/'+encodeURIComponent(hash)+(tab?'/'+tab:'');},
    back:function(){if(history.length>1)history.back();else this.home();}
  };

  W.VirtualList=function(container,options){this.el=container;this.rowHeight=options.rowHeight||44;this.overscan=options.overscan||5;this.renderRow=options.renderRow;this.items=[];this.spacer=document.createElement('div');this.spacer.className='virtual-list__spacer';this.el.classList.add('virtual-list');this.el.appendChild(this.spacer);var self=this;this.el.addEventListener('scroll',function(){self.render();},{passive:true});};
  W.VirtualList.prototype.setItems=function(items){this.items=items||[];this.spacer.style.height=(this.items.length*this.rowHeight)+'px';this.el.scrollTop=0;this.render();};
  W.VirtualList.prototype.render=function(){var h=this.el.clientHeight||360,top=this.el.scrollTop,start=Math.max(0,Math.floor(top/this.rowHeight)-this.overscan),end=Math.min(this.items.length,Math.ceil((top+h)/this.rowHeight)+this.overscan);this.spacer.textContent='';for(var i=start;i<end;i++){var row=this.renderRow(this.items[i],i);row.classList.add('virtual-row');row.style.height=this.rowHeight+'px';row.style.transform='translateY('+(i*this.rowHeight)+'px)';this.spacer.appendChild(row);}};

  document.addEventListener('mouseover',function(e){var target=e.target.closest('[data-tooltip]');if(!target||target.__tip)return;var tip=document.createElement('div');tip.textContent=target.dataset.tooltip;tip.style.cssText='position:fixed;z-index:500;padding:6px 8px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface-floating);box-shadow:var(--shadow-md);font-size:11px;color:var(--text-secondary);pointer-events:none;opacity:0;transition:opacity 120ms,transform 120ms;transform:translateY(3px)';document.body.appendChild(tip);target.__tip=tip;setTimeout(function(){if(!target.__tip)return;var r=target.getBoundingClientRect(),tr=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-tr.width-8,r.left+r.width/2-tr.width/2))+'px';tip.style.top=Math.max(8,r.bottom+7)+'px';tip.style.opacity='1';tip.style.transform='none';},320);});
  document.addEventListener('mouseout',function(e){var target=e.target.closest('[data-tooltip]');if(target&&target.__tip){target.__tip.remove();target.__tip=null;}});
})(window);
