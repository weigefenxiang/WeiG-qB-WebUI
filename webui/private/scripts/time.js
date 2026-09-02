(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var KEY='weigg.displayTimeZone';
  var FALLBACK=['UTC','Asia/Shanghai','Asia/Hong_Kong','Asia/Singapore','Asia/Tokyo','Asia/Seoul','Europe/London','Europe/Paris','Europe/Berlin','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Australia/Sydney'];
  function zones(){var list=[];try{if(Intl.supportedValuesOf)list=Intl.supportedValuesOf('timeZone');}catch(_e){}if(!list.length)list=FALLBACK.slice();return [{value:'system',label:'System / Browser'}].concat(list.map(function(x){return{value:x,label:x};}));}
  function getZone(){try{return localStorage.getItem(KEY)||'system';}catch(_e){return'system';}}
  function setZone(zone){zone=zone||'system';try{localStorage.setItem(KEY,zone);}catch(_e){}global.dispatchEvent(new CustomEvent('weigg:timezonechange',{detail:{zone:zone}}));return zone;}
  function resolved(zone){zone=zone||getZone();if(zone==='system')return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';return zone;}
  function offsetMinutes(zone,date){date=date||new Date();zone=resolved(zone);if(zone==='UTC')return 0;try{var parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date),bag={};parts.forEach(function(p){if(p.type!=='literal')bag[p.type]=p.value;});var asUTC=Date.UTC(+bag.year,+bag.month-1,+bag.day,+bag.hour,+bag.minute,+bag.second);return Math.round((asUTC-date.getTime())/60000);}catch(_e){return 0;}}
  function offsetLabel(zone,date){var m=offsetMinutes(zone,date),sign=m>=0?'+':'-',n=Math.abs(m),h=String(Math.floor(n/60)).padStart(2,'0'),mm=String(n%60).padStart(2,'0');return'UTC'+sign+h+':'+mm;}
  function displayLabel(zone){zone=zone||getZone();var r=resolved(zone),off=offsetLabel(zone);return zone==='system'?off+' · System / Browser · '+r:off+' · '+r;}
  function format(value,options){var d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return'';var o=Object.assign({year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'},options||{}, {timeZone:resolved(getZone())});try{return new Intl.DateTimeFormat(undefined,o).format(d);}catch(_e){return d.toLocaleString();}}
  W.Time={zones:zones,getZone:getZone,setZone:setZone,resolvedZone:resolved,offsetMinutes:offsetMinutes,offsetLabel:offsetLabel,displayLabel:displayLabel,format:format};
})(window);
