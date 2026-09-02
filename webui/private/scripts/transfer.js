(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},last=null,samples=[],MAX=900;
  if(!W.QBClient)return;
  var p=W.QBClient.prototype;if(!p.__transferEvents){p.__transferEvents=true;var original=p.getTransferInfo;p.getTransferInfo=function(){return original.apply(this,arguments).then(function(info){last=info||last;if(info){samples.push({t:Date.now(),dl:Number(info.dl_info_speed)||0,up:Number(info.up_info_speed)||0});if(samples.length>MAX)samples.splice(0,samples.length-MAX);}global.dispatchEvent(new CustomEvent('weigg:transfer',{detail:info}));return info;});};}
  W.TransferRuntime={last:function(){return last;},samples:function(){return samples.slice();}};
})(window);
