(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util||{};
  if(W.BugReport)return;
  var REPOSITORY='weigefenxiang/WeiG-qB-WebUI',TEMPLATE='bug_report.yml';
  // Route metadata only; bilingual copy belongs to tools/bug-report-templates.mjs.
  var FORM_ROUTES=Object.freeze({en:TEMPLATE,'zh-CN':'bug_report_zh-CN.yml','zh-TW':'bug_report_zh-TW.yml','zh-HK':'bug_report_zh-TW.yml',ja:'bug_report_ja.yml',ko:'bug_report_ko.yml',de:'bug_report_de.yml',fr:'bug_report_fr.yml',es:'bug_report_es.yml',pt:'bug_report_pt.yml',ru:'bug_report_ru.yml'});
  var available={},requests={};
  function clean(value,max){value=String(value==null?'':value).replace(/\s+/g,' ').trim();return max&&value.length>max?value.slice(0,max):value;}
  function currentSurface(){return U&&typeof U.isMobile==='function'&&U.isMobile()?'Mobile':'Desktop';}
  function browserOS(){var nav=global.navigator||{};return clean(nav.userAgent||'',220);}
  function locale(){var i18n=W.I18n||{},value=typeof i18n.getLocale==='function'?i18n.getLocale():'en';return clean(value,24)||'en';}
  function templateFor(code){return FORM_ROUTES[code]||TEMPLATE;}
  function identity(input){input=input||{};var raw={version:clean(input.version,64),gitSha:clean(input.gitSha,64)};return W.UpdateCheck&&typeof W.UpdateCheck.normalizeIdentity==='function'?W.UpdateCheck.normalizeIdentity(raw,{}):raw;}
  function snapshot(input){input=input||{};var app=W.AppState||{},client=input.client||app.client||{},build=identity(input),version=clean(build&&build.version||input.version,64),sha=clean(build&&build.gitSha||'',40);return{surface:input.surface||currentSurface(),weigVersion:version+(sha?' · '+sha:''),qbVersion:clean(input.qbVersion||client.qbVersion||'',64),browserOS:clean(input.browserOS||browserOS(),220),webuiLocale:locale()};}
  function issueUrl(input){var data=snapshot(input),url=new URL('https://github.com/'+REPOSITORY+'/issues/new'),filename=templateFor(data.webuiLocale);
    // GitHub Issue Forms are read from Main. Never link to a Dev-only template.
    var effectiveTemplate=filename===TEMPLATE||available[filename]===true?filename:TEMPLATE;
    url.searchParams.set('template',effectiveTemplate);
    if(data.surface)url.searchParams.set('surface',data.surface);
    if(data.weigVersion)url.searchParams.set('weig_version',data.weigVersion);
    if(data.qbVersion)url.searchParams.set('qb_version',data.qbVersion);
    if(data.browserOS)url.searchParams.set('browser_os',data.browserOS);
    url.searchParams.set('webui_locale',data.webuiLocale);
    // Current public Main template has no webui_locale input. Its existing
    // problem textarea is the only reliable backward-compatible prefill owner.
    if(effectiveTemplate===TEMPLATE)url.searchParams.set('problem','WebUI language: '+data.webuiLocale+'\n\n');
    return url.toString();}
  function checkTemplate(filename){if(filename===TEMPLATE)return Promise.resolve(true);if(available[filename]===true)return Promise.resolve(true);
    if(requests[filename])return requests[filename];
    var endpoint='https://api.github.com/repos/'+REPOSITORY+'/contents/.github/ISSUE_TEMPLATE/'+encodeURIComponent(filename)+'?ref=main';
    requests[filename]=Promise.resolve().then(function(){return global.fetch(endpoint,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});}).then(function(res){available[filename]=!!(res&&res.ok);return available[filename];}).catch(function(){available[filename]=false;return false;});
    return requests[filename];}
  function prepareLink(input,anchor){var code=locale(),filename=templateFor(code);if(!anchor||filename===TEMPLATE)return Promise.resolve(false);
    return checkTemplate(filename).then(function(ok){if(ok&&anchor.isConnected&&locale()===code){anchor.href=issueUrl(input);return true;}return false;});}
  function open(input){var url=issueUrl(input),opened=global.open(url,'_blank','noopener,noreferrer');return{url:url,opened:!!opened};}
  W.BugReport=Object.freeze({repository:REPOSITORY,template:TEMPLATE,snapshot:snapshot,issueUrl:issueUrl,prepareLink:prepareLink,open:open});
})(window);
