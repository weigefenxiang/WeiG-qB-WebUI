(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.RateValue)return;
  var FACTORS={'KiB/s':1024,'MiB/s':1048576,'GiB/s':1073741824};
  function units(){return Object.keys(FACTORS);}
  function factor(unit){return FACTORS[unit]||FACTORS['MiB/s'];}
  function normalizeBytes(value){var n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n):0;}
  function significant(value){var n=Number(value)||0;if(!n)return'0';var abs=Math.abs(n),power=Math.floor(Math.log10(abs)),decimals=Math.max(0,Math.min(6,2-power));return n.toFixed(decimals);}
  function unitFor(bytes){var n=normalizeBytes(bytes);if(n<FACTORS['MiB/s'])return'KiB/s';if(n<FACTORS['GiB/s'])return'MiB/s';return'GiB/s';}
  function autoUnit(values,fallback){var list=Array.isArray(values)?values:[values],max=0;list.forEach(function(value){max=Math.max(max,normalizeBytes(value));});return max>0?unitFor(max):(fallback&&FACTORS[fallback]?fallback:'MiB/s');}
  function bytesTo(value,unit){return significant(normalizeBytes(value)/factor(unit));}
  function toBytes(value,unit){if(String(value==null?'':value).trim()==='∞')return 0;var n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n*factor(unit)):0;}
  function isUnlimited(value){return normalizeBytes(value)===0;}
  function display(value,unit,unlimitedText){return isUnlimited(value)?String(unlimitedText==null?'∞':unlimitedText):bytesTo(value,unit);}
  function unitOptions(){return units().map(function(unit){return{value:unit,label:unit};});}
  W.RateValue={FACTORS:Object.freeze(Object.assign({},FACTORS)),units:units,factor:factor,normalizeBytes:normalizeBytes,unitFor:unitFor,autoUnit:autoUnit,bytesTo:bytesTo,toBytes:toBytes,isUnlimited:isUnlimited,display:display,unitOptions:unitOptions};
})(window);
