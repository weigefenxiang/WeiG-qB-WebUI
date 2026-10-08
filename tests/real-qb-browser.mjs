#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from './browser-driver.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const redact=v=>String(v??'')
  .replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,'[REDACTED_HOST]');
const assert=(ok,msg)=>{if(!ok)throw new Error(redact(msg));};

function frozen(){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const bytes=fs.readFileSync(path.join(root,manifest.catalogPath));
  const digest=sha256(bytes);
  assert(digest===manifest.catalogSha256,`Frozen LKG digest mismatch: ${digest}`);
  const catalog=JSON.parse(bytes);
  assert(Array.isArray(catalog)&&catalog.length===manifest.profileCount,'Frozen LKG profile count mismatch.');
  return {manifest,catalog,digest};
}

class Evidence{
  constructor(meta){
    this.data={schemaVersion:1,phase:'G',module:'real-qb-alternative-webui-browser',...meta,scenarios:[],summary:{PASS:0,FAIL:0,SKIP:0}};
  }
  push(result,id,extra={}){this.data.scenarios.push({id,result,...extra});this.data.summary[result]++;}
}

async function main(){
  const target=process.env.WEIG_QB_URL||'';
  const user=process.env.WEIG_QB_USER||'';
  const pass=process.env.WEIG_QB_PASS||'';
  const weigSha=process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'';
  const binary=process.env.WEIG_QB_BINARY_IDENTITY||'';
  const altPath=process.env.WEIG_QB_ALT_WEBUI_PATH||'/weig-webui';
  assert(target&&user&&pass,'WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
  assert(/^[0-9a-f]{40}$/i.test(weigSha),'WEIG_GIT_SHA/GITHUB_SHA must be an exact 40-char SHA.');
  assert(binary,'WEIG_QB_BINARY_IDENTITY is required.');
  assert(altPath.startsWith('/'),'WEIG_QB_ALT_WEBUI_PATH must be an absolute container path.');

  const f=frozen();
  const base=new URL(target.endsWith('/')?target:`${target}/`);
  let sessionCookie='',cookieName='',qb='unknown',api='unknown',browser=null,ev=null;
  const requestFacts=new Map();

  async function http(method,ep,{form,auth=true}={}){
    const url=new URL(ep.replace(/^\/+/,''),base);
    const headers={Accept:'application/json, text/plain, */*'};
    if(auth&&sessionCookie)headers.Cookie=sessionCookie;
    let body;
    if(form){
      headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';
      body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));
    }
    return fetch(url,{method,headers,body,redirect:'manual'});
  }

  async function login(){
    const r=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
    assert([200,204].includes(r.status),`auth/login: HTTP ${r.status}`);
    const cookies=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():[r.headers.get('set-cookie')].filter(Boolean);
    for(const raw of cookies){
      const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);
      if(m){cookieName=m[1];sessionCookie=`${m[1]}=${m[2]}`;break;}
    }
    await r.text();
    assert(sessionCookie,'Login returned no session cookie.');
    return r.status;
  }

  function evidenceFile(){
    const dir=path.join(root,'artifacts/real-qb');
    fs.mkdirSync(dir,{recursive:true});
    return path.join(dir,`${weigSha}-${qb}-alt-webui-browser.json`);
  }
  function writeEvidence(){
    if(!ev)return;
    const file=evidenceFile();
    fs.writeFileSync(file,`${JSON.stringify(ev.data,null,2)}\n`);
    console.log(`Real-qB Alternative WebUI browser evidence: ${path.relative(root,file)}`);
    console.log(JSON.stringify(ev.data.summary));
  }

  try{
    const loginStatus=await login();
    const vr=await http('GET','/api/v2/app/version');
    assert(vr.status===200,`app/version: HTTP ${vr.status}`);
    qb=norm(await vr.text());
    const ar=await http('GET','/api/v2/app/webapiVersion');
    assert(ar.status===200,`app/webapiVersion: HTTP ${ar.status}`);
    api=norm(await ar.text());
    const profile=f.catalog.find(x=>norm(x.qbVersion)===qb);
    assert(profile,`qB ${qb} is outside Frozen LKG; fail closed.`);
    assert(norm(profile.webApiVersion)===api,`WebAPI mismatch for qB ${qb}: expected ${norm(profile.webApiVersion)}, actual ${api}.`);

    ev=new Evidence({
      weig_sha:weigSha,
      webui_version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),
      test_time:new Date().toISOString(),
      qb_version:qb,
      webapi_version:api,
      qb_binary_or_source_identity:binary,
      platform:process.env.WEIG_QB_PLATFORM||`${os.platform()} ${os.release()}`,
      architecture:process.env.WEIG_QB_ARCH||os.arch(),
      deployment_mode:process.env.WEIG_QB_DEPLOYMENT_MODE||'unknown',
      install_mode:process.env.WEIG_QB_INSTALL_MODE||'unknown',
      reverse_proxy:process.env.WEIG_QB_REVERSE_PROXY||'none',
      https:base.protocol==='https:',
      base_path:base.pathname,
      target_host:'REDACTED',
      frozen_catalog_sha256:f.digest,
      alternative_webui_path:altPath,
      staged_release_transform:{
        source_tree:'canonical build-webui-dist.mjs materialized webui/** at exact weig_sha',
        sha_placeholder_replaced:true,
        installer_metadata_generated:true,
        bundled_catalog_source:'webui/private/data/qb-releases.json',
        mount_read_only:true
      }
    });
    ev.push('PASS','auth-and-identity',{response:{login_status:loginStatus,session_cookie_name:cookieName,qbVersion:qb,webApiVersion:api}});

    const set=await http('POST','/api/v2/app/setPreferences',{
      form:{json:JSON.stringify({alternative_webui_enabled:true,alternative_webui_path:altPath})}
    });
    assert([200,204].includes(set.status),`setPreferences Alternative WebUI: HTTP ${set.status}`);
    await set.text();
    const prefs=await http('GET','/api/v2/app/preferences');
    assert(prefs.status===200,`app/preferences after Alternative WebUI enable: HTTP ${prefs.status}`);
    const prefJson=await prefs.json();
    assert(prefJson?.alternative_webui_enabled===true,'qB did not persist alternative_webui_enabled=true.');
    assert(String(prefJson?.alternative_webui_path||'')===altPath,'qB did not persist expected alternative_webui_path.');
    ev.push('PASS','alternative-webui-enabled',{
      source_contract:'qB release source: Preferences::changed -> WebApplication::configure()',
      request:{endpoint:'/api/v2/app/setPreferences',paramNames:['json'],jsonKeys:['alternative_webui_enabled','alternative_webui_path']},
      response:{set_status:set.status,preferences_status:prefs.status,enabled:true,path:altPath}
    });

    const logout=await http('POST','/api/v2/auth/logout');
    assert([200,204].includes(logout.status),`auth/logout before public smoke: HTTP ${logout.status}`);
    await logout.text();
    sessionCookie='';

    const publicRoot=await http('GET','/',{auth:false});
    assert(publicRoot.status===200,`Alternative WebUI public root: HTTP ${publicRoot.status}`);
    const publicHtml=await publicRoot.text();
    assert(publicHtml.includes('id="login-form"'),'Alternative WebUI public root is not WeiG login UI.');
    assert(publicHtml.includes(`name="weig-build-sha" content="${weigSha}"`),'Public Alternative WebUI build SHA is not exact current SHA.');
    ev.push('PASS','public-root-served-by-real-qb',{
      response:{status:publicRoot.status,login_form:true,build_sha:weigSha},
      qB_static_owner:'real qBittorrent WebApplication'
    });

    browser=await launchBrowser();
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(redact(e?.message||e)));
    page.on('console',msg=>{
      if(msg.type()==='error'){
        const t=redact(msg.text());
        if(!/favicon|Wei\.G\.ico|ERR_FAILED/i.test(t))pageErrors.push(t);
      }
    });
    page.on('response',response=>{
      try{
        const u=new URL(response.url());
        if(u.origin===base.origin&&u.pathname.startsWith('/api/v2/')){
          requestFacts.set(u.pathname,response.status());
        }
      }catch{}
    });
    await page.route('**/*',route=>{
      try{
        const u=new URL(route.request().url());
        if(u.origin!==base.origin)return route.abort();
      }catch{return route.abort();}
      return route.continue();
    });

    await page.goto(base.href,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#login-form');
    const publicSha=await page.locator('meta[name="weig-build-sha"]').getAttribute('content');
    assert(publicSha===weigSha,`Chrome public build SHA mismatch: ${publicSha}`);

    await page.locator('#username').fill(user);
    await page.locator('#password').fill(pass);
    await page.locator('#login-btn').click();
    await page.waitForSelector('#app',{timeout:10000});
    await page.waitForSelector('#torrent-list',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#qb-version')?.textContent?.trim()&&!['—','Detecting…'].includes(document.querySelector('#qb-version').textContent.trim()),null,{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#api-version')?.textContent?.trim()&&!['—','Detecting…'].includes(document.querySelector('#api-version').textContent.trim()),null,{timeout:10000});

    const privateSha=await page.locator('meta[name="weig-build-sha"]').getAttribute('content');
    const uiQb=norm(await page.locator('#qb-version').textContent());
    const uiApi=norm(await page.locator('#api-version').textContent());
    assert(privateSha===weigSha,`Chrome private build SHA mismatch: ${privateSha}`);
    assert(uiQb===qb,`Chrome qB identity mismatch: expected ${qb}, actual ${uiQb}`);
    assert(uiApi===api,`Chrome WebAPI identity mismatch: expected ${api}, actual ${uiApi}`);

    // Verify the actual installer-built CSS/JS in real qB hosting, not raw source.
    const stagedAssets=await page.evaluate(async()=>{
      const descriptor=await fetch(new URL('bootstrap-plan.json',location.href),{cache:'no-store'});
      if(!descriptor.ok)throw new Error('qB static bootstrap-plan HTTP '+descriptor.status);
      const plan=await descriptor.json();
      const css=[...document.querySelectorAll('link[data-weig-runtime-style]')];
      const js=[...document.querySelectorAll('script[data-weig-runtime-module]')]
        .filter(node=>node.dataset.weigRuntimeModule!=='scripts/settings.js'&&node.dataset.weigRuntimeModule!=='scripts/rss.js'&&node.dataset.weigRuntimeModule!=='scripts/logs.js');
      const resources=await Promise.all([...css,...js].map(async node=>{
        const kind=node.tagName==='LINK'?'css':'js';
        const relative=kind==='css'?node.dataset.weigRuntimeStyle:node.dataset.weigRuntimeModule;
        const url=kind==='css'?node.href:node.src;
        const response=await fetch(url,{cache:'force-cache'});
        return{kind,relative,status:response.status,mime:response.headers.get('content-type')||'',exactSha:new URL(url).searchParams.get('v')};
      }));
      return{plan,css:css.map(x=>x.dataset.weigRuntimeStyle),js:js.map(x=>x.dataset.weigRuntimeModule),resources};
    });
    const scriptsInPlan=stagedAssets.plan.phases.flatMap(phase=>phase.scripts);
    assert(stagedAssets.plan.styles.length>=2&&stagedAssets.plan.styles.length<=5,'Real qB must serve bounded materialized CSS groups');
    assert(scriptsInPlan.length>=14&&scriptsInPlan.length<=28,'Real qB must serve bounded materialized JS groups');
    assert(stagedAssets.plan.styles.every(p=>/^css\/startup-\d+\.css$/.test(p)),'Real qB must serve distribution CSS bundles, not 19 raw CSS files');
    assert(scriptsInPlan.some(p=>/^scripts\/startup-[a-z0-9-]+\.js$/.test(p)),'Real qB must execute distribution JS bundles');
    assert(JSON.stringify(stagedAssets.css)===JSON.stringify(stagedAssets.plan.styles),'Real qB CSS DOM order diverges from installed canonical bootstrap');
    assert(JSON.stringify(stagedAssets.js)===JSON.stringify(scriptsInPlan),'Real qB JS DOM order diverges from installed canonical bootstrap');
    for(const resource of stagedAssets.resources){
      assert(resource.status===200,'Real qB static file '+resource.relative+' returned HTTP '+resource.status);
      assert(resource.exactSha===weigSha,'Real qB static file '+resource.relative+' lost exact-SHA cache identity');
      assert(resource.kind==='css'?/text\/css/i.test(resource.mime):/(?:java|ecma)script/i.test(resource.mime),
        'Real qB static file '+resource.relative+' has invalid '+resource.kind+' MIME: '+resource.mime);
    }
    ev.push('PASS','real-qb-materialized-assets',{
      build_sha:weigSha,css:stagedAssets.css.length,js:stagedAssets.js.length+1,
      total_css_js_requests:stagedAssets.css.length+stagedAssets.js.length+1,
      verified_mime_and_status:stagedAssets.resources.length,
      hosting:'real qB Alternative WebUI serving installer materialized distribution'
    });


    await page.locator('#app-nav [data-route="settings"]').click();
    await page.waitForFunction(()=>location.hash.includes('settings'));
    await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{timeout:10000});
    // The real qB Alternative WebUI must decode the canonical UTF-8 CSS.
    // Verify an actual selected option; test fixtures and stylesheet source text
    // alone cannot establish the browser-computed glyph on qB's static server.
    const languageControl=page.locator('[data-setting-key="weig_language"] .ui-select__trigger');
    await languageControl.waitFor({timeout:10000});
    await languageControl.click();
    await page.waitForSelector('#weig-floating-layer .ui-select__option[aria-selected="true"]',{timeout:10000});
    const selectedGlyph=await page.evaluate(()=>{
      const option=document.querySelector('#weig-floating-layer .ui-select__option[aria-selected="true"]');
      return option?getComputedStyle(option,'::before').content:'';
    });
    assert(selectedGlyph.includes('✓')&&!selectedGlyph.includes('â'),`Real qB CSS selected glyph was not decoded as UTF-8: ${selectedGlyph}`);
    await page.keyboard.press('Escape');
    ev.push('PASS','real-qb-utf8-shared-select',{computed_selected_glyph:selectedGlyph,hosting:'real qB Alternative WebUI CSS'});

    const webUiTab=page.locator('#settings-tabs [data-settings-tab="webui"]');
    assert(await webUiTab.count()===1,'Canonical Settings lost the Web UI tab.');
    await webUiTab.click();
    await page.waitForSelector('#settings-tabs [data-settings-tab="webui"].is-active',{timeout:10000});
    await page.waitForSelector('[data-setting-key="alternative_webui_path"]',{timeout:10000});
    const altPathControl=page.locator('[data-setting-key="alternative_webui_path"]');
    assert(await altPathControl.count()===1,'Canonical Settings lost alternative_webui_path control on real qB.');
    const altValue=await altPathControl.locator('input,textarea').first().inputValue().catch(()=>null);
    assert(altValue===altPath,`Canonical Settings Alternative WebUI path mismatch: ${altValue}`);

    // Explicit opt-in real qB product gate: native WebAPI success alone is insufficient.
    if(process.env.WEIG_REAL_QB_REQUIRE_ADD_TORRENT==='1'){
      assert(String(process.env.WEIG_QB_DEPLOYMENT_MODE||'').includes('ephemeral real-qB Docker; outbound network denied'),'WeiG product Add Torrent must target a disposable qB Docker with network egress denied.');
      const syntheticHash=sha256(weigSha+':'+qb+':weig-product-add-smoke').slice(0,40);
      const magnet='magnet:?xt=urn:btih:'+syntheticHash+'&dn=WeiG-Product-Verification';
      await page.locator('#add-btn').click();
      await page.waitForSelector('#add-dialog[open]',{timeout:10000});
      await page.locator('#torrent-urls').fill(magnet);
      const responseTask=page.waitForResponse(res=>{
        try{const url=new URL(res.url());return url.origin===base.origin&&url.pathname==='/api/v2/torrents/add'&&res.request().method()==='POST';}
        catch{return false;}
      },{timeout:15000});
      await page.locator('#add-submit').click();
      const addResponse=await responseTask;
      assert(addResponse.status()===200,'WeiG Add Torrent UI returned HTTP '+addResponse.status()+' instead of accepted HTTP 200.');
      await page.waitForFunction(()=>!document.querySelector('#add-dialog')?.open,null,{timeout:10000});
      let persisted=false,lastStatus=0;
      for(let attempt=0;attempt<12&&!persisted;attempt++){
        const infoUrl=new URL('api/v2/torrents/info?hashes='+syntheticHash,base);
        const read=await context.request.get(infoUrl.toString());
        lastStatus=read.status();
        if(lastStatus===200){
          const torrents=await read.json();
          persisted=Array.isArray(torrents)&&torrents.some(row=>String(row?.hash||'').toLowerCase()===syntheticHash);
        }
        if(!persisted)await page.waitForTimeout(250);
      }
      assert(persisted,'qB did not expose the torrent added by WeiG after the accepted POST (last GET '+lastStatus+').');
      ev.push('PASS','weig-add-torrent-through-real-qb',{
        request:{entry:'#add-btn',source:'#torrent-urls',submit:'#add-submit',endpoint:'/api/v2/torrents/add',method:'POST',synthetic_magnet_no_external_trackers:true},
        response:{post_status:addResponse.status(),real_qb_torrent_visible:true,dialog_closed:true},
        validation:'real WeiG product UI and qB daemon, not native WebAPI-only probe'
      });
    }

    // Full A64 product gate: actual WeiG UI against an isolated no-egress qB daemon.
    if(process.env.WEIG_REAL_QB_REQUIRE_ADD_TORRENT==='1'){
      const actualCopy=await page.evaluate(async()=>{
        const W=window.WeiG,profile=W?.CapabilityRegistry?.domainResolution?.('copy');
        const data=await W?.I18n?.loadQbOwnedCopy?.();
        return{profile,data:data?{sourceSha:data.sourceSha,qbVersion:data.qbVersion,routeId:data.routeId,locale:data.locale,mode:data.mode}:null};
      });
      assert(actualCopy.profile?.resolutionMode==='EXACT'&&actualCopy.profile.sourceSha===profile.sourceSha,'Real qB copy must resolve from exact admitted source SHA.');
      assert(actualCopy.data?.sourceSha===profile.sourceSha&&actualCopy.data.qbVersion===qb,'qB copy was not loaded from the exact official release.');
      ev.push('PASS','real-qb-official-copy-source',{response:{source_sha:profile.sourceSha,mode:actualCopy.data.mode,route_id:actualCopy.data.routeId,locale:actualCopy.data.locale}});

      // A68-3: real qB Alternative WebUI must honor exact upstream qB 5.2.4
      // OptionsDialog and StatusFilterWidget zh_HK/zh_TW source translations.
      const verifiedLocales=[];
      for(const targetLocale of ['zh_HK','zh_TW']){
        const actual=await page.evaluate(async target=>{
          const I=window.WeiG.I18n;
          I.applyLocale(target,{reload:false});
          const data=await I.loadQbOwnedCopy();
          return{locale:I.getQbLocale(),tab:I.qbText('settings.tab.downloads',''),status:I.qbText('filter.all',''),source:data?.source||null,mode:data?.mode||null,routeId:data?.routeId||null};
        },targetLocale);
        assert(actual.locale===targetLocale&&actual.source&&/^r[0-9a-f]{20}$/.test(actual.routeId||''),`Real qB ${targetLocale} official Copy not ready: ${JSON.stringify(actual)}`);
        assert(actual.tab==='下載',`Official qB ${targetLocale} Downloads tab translation missing: ${JSON.stringify(actual)}`);
        assert.ok(actual.status.startsWith('全部')&&!actual.status.includes('All'),`Official qB ${targetLocale} Status All translation missing: ${JSON.stringify(actual)}`);
        verifiedLocales.push(actual);
      }
      await page.evaluate(async previous=>{window.WeiG.I18n.applyLocale(previous,{reload:false});await window.WeiG.I18n.loadQbOwnedCopy();},String(prefJson.locale||'en'));
      ev.push('PASS','real-qb-official-copy-zh-hk-tw',{response:{locales:verifiedLocales,hosting:'real qB Alternative WebUI',source:'official 5.2.4 webui TS'}});

      const rssTask=page.waitForResponse(res=>{
        try{const u=new URL(res.url());return u.origin===base.origin&&u.pathname==='/api/v2/rss/items';}catch{return false;}
      },{timeout:15000});
      await page.locator('#app-nav [data-route="rss"]').click();
      await page.waitForFunction(()=>location.hash.includes('rss'));
      const rssResponse=await rssTask;
      assert(rssResponse.status()===200,'WeiG RSS did not read the real qB subscriptions successfully.');
      await page.waitForFunction(()=>{const state=document.getElementById('rss-content')?.dataset.rssState;return state&&state!=='IDLE'&&state!=='LOADING';},null,{timeout:15000});
      const rssState=await page.locator('#rss-content').getAttribute('data-rss-state');
      assert(rssState==='READY'||rssState==='EMPTY','WeiG RSS workspace failed: '+rssState);
      ev.push('PASS','real-qb-weig-rss-read',{response:{state:rssState,endpoint:'/api/v2/rss/items',status:rssResponse.status()}});

      const logsTask=page.waitForResponse(res=>{
        try{const u=new URL(res.url());return u.origin===base.origin&&u.pathname==='/api/v2/log/main';}catch{return false;}
      },{timeout:15000});
      await page.locator('#app-nav [data-route="logs"]').click();
      await page.waitForFunction(()=>location.hash.includes('logs'));
      const logsResponse=await logsTask;
      assert(logsResponse.status()===200,'WeiG Logs did not read real qB execution logs successfully.');
      await page.waitForSelector('#logs-content [data-weig-log-shell="1"]',{timeout:15000});
      ev.push('PASS','real-qb-weig-logs-read',{response:{endpoint:'/api/v2/log/main',status:logsResponse.status()}});
      // Assert the canonical Log Follow checkbox on the actual qB-hosted CSS.
      await page.waitForSelector('#logs-content [data-logs-follow] input:checked + .ui-check__mark',{timeout:15000});
      const followGlyph=await page.evaluate(()=>{
        const mark=document.querySelector('#logs-content [data-logs-follow] input:checked + .ui-check__mark');
        return mark?getComputedStyle(mark,'::after').content:'';
      });
      assert(followGlyph.includes('✓')&&!followGlyph.includes('â'),`Real qB Logs Follow checkbox glyph was mis-decoded: ${followGlyph}`);
      ev.push('PASS','real-qb-utf8-shared-checkbox',{computed_checked_glyph:followGlyph,hosting:'real qB Alternative WebUI CSS'});

      await page.locator('#app-nav [data-route="settings"]').click();
      await page.waitForFunction(()=>location.hash.includes('settings'));
      await page.locator('#settings-tabs [data-settings-tab="weig"]').click();
      await page.waitForSelector('[data-setting-key="weig_language"] .ui-select__trigger',{timeout:15000});
      const language=page.locator('[data-setting-key="weig_language"] .ui-select__trigger');
      assert(await language.isEnabled(),'Source-proven Settings language control must be editable on the admitted real qB.');
      const inventory=await page.evaluate(()=>window.WeiG.I18n.settingOptions('locale')||[]);
      const previousLocale=String(prefJson.locale||'en'),available=inventory.map(item=>String(item.value||''));
      const chinese=available.find(value=>value.toLowerCase().replace('_','-')==='zh-cn');
      assert(chinese,'Exact official qB locale inventory does not include Simplified Chinese.');
      const targetLocale=chinese===previousLocale?(available.find(value=>value!==previousLocale)||''):chinese;
      assert(targetLocale&&targetLocale!==previousLocale,'Cannot select a different source-owned qB locale.');
      await language.click();
      await page.locator('.ui-select__option[data-value="'+targetLocale+'"]').last().click();
      const saveTask=page.waitForResponse(res=>{
        try{const u=new URL(res.url());return u.origin===base.origin&&u.pathname==='/api/v2/app/setPreferences'&&res.request().method()==='POST';}catch{return false;}
      },{timeout:15000});
      await page.locator('#save-settings-btn').click();
      const saveResponse=await saveTask;
      assert([200,204].includes(saveResponse.status()),'WeiG language Save returned HTTP '+saveResponse.status());
      const authoritative=await context.request.get(new URL('api/v2/app/preferences',base).toString());
      assert(authoritative.status()===200,'Real qB Settings authoritative reread failed after WeiG save.');
      const confirmed=await authoritative.json();
      assert(String(confirmed.locale)===targetLocale,'WeiG language write did not persist in real qB.');
      ev.push('PASS','real-qb-weig-settings-locale-save',{
        request:{route:'settings',entry:'weig_language',endpoint:'/api/v2/app/setPreferences',field:'locale'},
        response:{write_status:saveResponse.status(),reread_status:authoritative.status(),persisted_locale:targetLocale,official_inventory:true}
      });
    }

    for(const required of ['/api/v2/app/version','/api/v2/app/webapiVersion','/api/v2/app/preferences']){
      assert((requestFacts.get(required)||0)>=200&&(requestFacts.get(required)||0)<300,`Chrome did not complete required real qB API request ${required}.`);
    }
    assert(pageErrors.length===0,`Chrome page errors: ${pageErrors.join(' | ')}`);

    ev.push('PASS','authenticated-chrome-shell',{
      browser:{channel:'Google Chrome Stable',headless:true,external_requests_blocked:true},
      response:{build_sha:privateSha,qb_version:uiQb,webapi_version:uiApi,app_shell:true,torrent_list:true,canonical_settings:true,alternative_webui_path:altValue},
      required_real_api_statuses:Object.fromEntries([...requestFacts.entries()].filter(([k])=>['/api/v2/app/version','/api/v2/app/webapiVersion','/api/v2/app/preferences'].includes(k))),
      page_errors:[]
    });
    await context.close();
    writeEvidence();
  }catch(e){
    if(ev){
      ev.push('FAIL','real-qb-alternative-webui-browser',{reason:redact(e?.message||e)});
      writeEvidence();
    }
    throw e;
  }finally{
    if(browser)await browser.close().catch(()=>{});
  }
}

main().catch(e=>{
  console.error(redact(e?.stack||e));
  process.exitCode=1;
});
