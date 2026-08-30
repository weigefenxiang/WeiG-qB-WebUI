(function(global){
  'use strict';
  var W=global.WeiG,U=W.util;
  var states={
    downloading:['下载中','info'],metaDL:['下载元数据','info'],forcedDL:['强制下载','info'],allocating:['分配空间','info'],checkingDL:['检查中','warning'],checkingUP:['检查中','warning'],checkingResumeData:['检查恢复数据','warning'],moving:['移动中','warning'],
    uploading:['做种','success'],stalledUP:['做种停滞','warning'],forcedUP:['强制作种','success'],queuedUP:['做种排队','muted'],
    pausedDL:['已暂停','muted'],pausedUP:['已暂停','muted'],stoppedDL:['已停止','muted'],stoppedUP:['已停止','muted'],queuedDL:['下载排队','muted'],stalledDL:['下载停滞','warning'],
    error:['错误','danger'],missingFiles:['文件缺失','danger'],unknown:['未知','muted']
  };
  W.Components={};
  W.Components.state=function(code){return states[code]||[String(code||'未知'),'muted'];};
  W.Components.torrentRow=function(t,selected,handlers){var row=document.createElement('article');row.className='torrent-row'+(selected?' is-selected':'');row.role='listitem';row.dataset.hash=t.hash;
    var name=document.createElement('div');name.className='torrent-name-cell';var check=document.createElement('input');check.type='checkbox';check.className='torrent-select';check.checked=selected;check.setAttribute('aria-label','选择 '+U.escapeText(t.name));check.addEventListener('change',function(){handlers.select(t.hash,check.checked);});var title=document.createElement('button');title.type='button';title.className='torrent-title';title.textContent=U.escapeText(t.name)||'(未命名种子)';title.title=U.escapeText(t.name);title.addEventListener('click',function(){handlers.open(t.hash);});var more=document.createElement('button');more.type='button';more.className='row-more';more.textContent='›';more.setAttribute('aria-label','查看详情');more.addEventListener('click',function(){handlers.open(t.hash);});name.append(check,title,more);row.appendChild(name);
    function cell(text,cls){var e=document.createElement('span');e.className='cell '+(cls||'');e.textContent=text;return e;}
    row.appendChild(cell(U.formatBytes(t.size),'size-cell'));
    var pc=document.createElement('div');pc.className='progress-cell';var track=document.createElement('div');track.className='progress-track';var fill=document.createElement('div');fill.className='progress-fill';fill.style.width=U.clamp(U.percent(t.progress),0,100)+'%';track.appendChild(fill);pc.append(track,cell(U.percent(t.progress)+'%'));row.appendChild(pc);
    row.appendChild(cell(U.formatSpeed(t.dlspeed),'speed-dl'));row.appendChild(cell(U.formatSpeed(t.upspeed),'speed-up'));row.appendChild(cell(U.formatEta(t.eta),'eta-cell'));
    var s=W.Components.state(t.state),wrap=document.createElement('div');wrap.className='status-cell';var pill=document.createElement('span');pill.className='status-pill';pill.dataset.tone=s[1];pill.textContent=s[0];wrap.appendChild(pill);row.appendChild(wrap);return row;};
  W.Components.kv=function(label,value){var el=document.createElement('div');el.className='kv';var a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value==null?'—':String(value);el.append(a,b);return el;};
})(window);
