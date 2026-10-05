(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util||{};
  if(W.BugReport)return;
  var REPOSITORY='weigefenxiang/WeiG-qB-WebUI',TEMPLATE='bug_report.yml';
  var SURFACE_MOBILE='Mobile / 移动端',SURFACE_DESKTOP='Desktop / 桌面端';
  function clean(value,max){value=String(value==null?'':value).replace(/\s+/g,' ').trim();return max&&value.length>max?value.slice(0,max):value;}
  function currentSurface(){return U&&typeof U.isMobile==='function'&&U.isMobile()?SURFACE_MOBILE:SURFACE_DESKTOP;}
  function browserOS(){var navigator=global.navigator||{};return clean(navigator.userAgent||'',220);}
  function identity(input){input=input||{};var raw={version:clean(input.version,64),gitSha:clean(input.gitSha,64)};return W.UpdateCheck&&typeof W.UpdateCheck.normalizeIdentity==='function'?W.UpdateCheck.normalizeIdentity(raw,{}):raw;}
  function snapshot(input){input=input||{};var app=W.AppState||{},client=input.client||app.client||{},build=identity(input),version=clean(build&&build.version||input.version,64),sha=clean(build&&build.gitSha||'',40);return{surface:input.surface||currentSurface(),weigVersion:version+(sha?' · '+sha:''),qbVersion:clean(input.qbVersion||client.qbVersion||'',64),browserOS:clean(input.browserOS||browserOS(),220)};}
  function issueUrl(input){var data=snapshot(input),url=new URL('https://github.com/'+REPOSITORY+'/issues/new');url.searchParams.set('template',TEMPLATE);if(data.surface)url.searchParams.set('surface',data.surface);if(data.weigVersion)url.searchParams.set('weig_version',data.weigVersion);if(data.qbVersion)url.searchParams.set('qb_version',data.qbVersion);if(data.browserOS)url.searchParams.set('browser_os',data.browserOS);return url.toString();}
  function open(input){var url=issueUrl(input),opened=global.open(url,'_blank','noopener,noreferrer');return{url:url,opened:!!opened};}
  W.BugReport=Object.freeze({repository:REPOSITORY,template:TEMPLATE,snapshot:snapshot,issueUrl:issueUrl,open:open});
})(window);
