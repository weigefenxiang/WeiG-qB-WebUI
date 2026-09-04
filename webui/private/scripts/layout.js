(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.LayoutRuntime)return;
  var initialized=false;
  function normalizeDialog(dialog){
    if(!dialog||dialog.dataset.adaptiveDialog==='1')return;
    dialog.dataset.adaptiveDialog='1';
    var root=dialog.querySelector(':scope > form')||dialog,
        head=root.querySelector(':scope > .dialog__head'),
        actions=root.querySelector(':scope > .dialog__actions'),
        body=root.querySelector(':scope > .dialog__body');
    if(body)return;
    body=document.createElement('div');
    body.className='dialog__body';
    Array.from(root.childNodes).filter(function(node){return node!==head&&node!==actions;}).forEach(function(node){body.appendChild(node);});
    if(head)head.insertAdjacentElement('afterend',body);else root.insertBefore(body,actions||root.firstChild);
  }
  function normalizeDialogs(){Array.from(document.querySelectorAll('dialog.dialog')).forEach(normalizeDialog);}
  function init(){if(initialized)return;initialized=true;normalizeDialogs();}
  W.LayoutRuntime={init:init,normalizeDialogs:normalizeDialogs};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
