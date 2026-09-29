import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from './browser-driver.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=path.resolve(here,'../webui/public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

const privateRoot=path.resolve(here,'../webui/private');
const [entrySource,entryStyle,geometrySource,indexSource,loginSource,floatingSource,settingsSource,privateIndexSource]=await Promise.all([
  fs.readFile(path.join(publicRoot,'scripts/entry-select.js'),'utf8'),
  fs.readFile(path.join(publicRoot,'styles/entry-select.css'),'utf8'),
  fs.readFile(path.join(publicRoot,'scripts/select-geometry.js'),'utf8'),
  fs.readFile(path.join(publicRoot,'index.html'),'utf8'),
  fs.readFile(path.join(publicRoot,'login.html'),'utf8'),
  fs.readFile(path.join(privateRoot,'scripts/floating.js'),'utf8'),
  fs.readFile(path.join(privateRoot,'scripts/settings.js'),'utf8'),
  fs.readFile(path.join(privateRoot,'index.html'),'utf8')
]);
for(const retired of ['entry-select__trigger','entry-select__menu','entry-select__option','entry-select__value','entry-select__chevron','entry-select__options']){
  assert.ok(!entrySource.includes(retired),`retired public Select runtime child owner returned: ${retired}`);
  assert.ok(!entryStyle.includes('.'+retired),`retired public Select skin selector returned: ${retired}`);
}
for(const canonical of ['ui-select__trigger','ui-select__menu','ui-select__option','ui-select__value','ui-select__chevron','ui-select__options'])assert.ok(entrySource.includes(canonical),`public entry adapter must consume canonical Select DOM contract: ${canonical}`);
assert.ok(!/\.language-select\{/.test(indexSource)&&!/\.language-select\{/.test(loginSource),'public entry HTML must not regain a duplicate inline language Select skin');
assert.ok(geometrySource.includes('global.WeiGSelectGeometry=')&&entrySource.includes('global.WeiGSelectGeometry')&&floatingSource.includes('global.WeiGSelectGeometry'),'Login and private Select must consume one shared geometry/sizing owner');
assert.ok(!entrySource.includes('longest=0')&&!entrySource.includes('function triggerWidth()')&&!floatingSource.includes('function intrinsicMenuWidth('),'retired feature-local Select sizing owners must stay removed');
assert.ok(indexSource.indexOf('scripts/select-geometry.js')<indexSource.indexOf('scripts/entry-select.js')&&loginSource.indexOf('scripts/select-geometry.js')<loginSource.indexOf('scripts/entry-select.js'),'public entry must load shared Select geometry before the entry adapter');
assert.ok(privateIndexSource.indexOf('../public/scripts/select-geometry.js')<privateIndexSource.indexOf('scripts/floating.js'),'private runtime must load shared Select geometry before canonical floating Select');
assert.ok(/languageRow\([^\n]+intrinsicValue:true/.test(settingsSource)&&/timezoneRow\([^\n]+intrinsicValue:true/.test(settingsSource),'Settings interface language/timezone must opt into shared current-value intrinsic trigger sizing');

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const requested=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    const file=path.resolve(publicRoot,requested);
    if(!(file===publicRoot||file.startsWith(publicRoot+path.sep)))throw Object.assign(new Error('path escape'),{code:'EACCES'});
    const body=await fs.readFile(file);
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  }catch(error){
    res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});
    res.end(String(error?.message||error));
  }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const address=server.address(),base=`http://127.0.0.1:${address.port}/`;
const browser=await launchBrowser();

const cases=[
  {locale:'en-US',app:'en',title:'Welcome back'},
  {locale:'zh-CN',app:'zh-CN',title:'欢迎回来'},
  {locale:'zh-TW',app:'zh-TW',title:'歡迎回來'},
  {locale:'zh-HK',app:'zh-HK',title:'歡迎回來'},
  {locale:'ja-JP',app:'ja',title:'おかえりなさい'},
  {locale:'ko-KR',app:'ko',title:'다시 오신 것을 환영합니다'},
  {locale:'de-DE',app:'de',title:'Willkommen zurück'},
  {locale:'fr-FR',app:'fr',title:'Bon retour'},
  {locale:'es-ES',app:'es',title:'Bienvenido de nuevo'},
  {locale:'pt-BR',app:'pt',title:'Bem-vindo de volta'},
  {locale:'ru-RU',app:'ru',title:'С возвращением'},
  {locale:'ar-AE',app:'en',title:'Welcome back'}
];

async function verify(pathname,item){
  const context=await browser.newContext({locale:item.locale});
  try{
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error?.stack||error)));
    await page.goto(new URL(pathname,base).toString(),{waitUntil:'domcontentloaded',timeout:30000});
    const facts=await page.evaluate(()=>({
      lang:document.documentElement.lang,
      title:String(document.querySelector('#login-title')?.textContent||'').trim(),
      brand:String(document.querySelector('.brand strong')?.textContent||'').trim(),
      logo:String(document.querySelector('.mark img')?.getAttribute('src')||''),
      favicon:String(document.querySelector('link[rel="icon"]')?.getAttribute('href')||''),
      languages:[...(navigator.languages||[])],
      language:String(navigator.language||''),
      options:[...document.querySelectorAll('#login-language option')].map(option=>({value:option.value,label:option.textContent})),
      selected:String(document.querySelector('#login-language')?.value||''),
      versionPanel:document.querySelectorAll('#login-versions').length,
      oldHint:document.querySelectorAll('#login-hint').length,
      entrySelects:document.querySelectorAll('.entry-select').length,
      entryTrigger:document.querySelector('.entry-select .ui-select__trigger')?.getBoundingClientRect().toJSON?.()||null,
      canonicalParts:document.querySelectorAll('.entry-select .ui-select__trigger,.ui-select__menu[data-entry-select-menu="1"],.ui-select__menu[data-entry-select-menu="1"] .ui-select__option').length,
      legacyParts:document.querySelectorAll('.entry-select__trigger,.entry-select__menu,.entry-select__option').length
    }));
    assert.equal(facts.lang,item.app,`${pathname} ${item.locale}: entry language mismatch ${JSON.stringify(facts)}`);
    assert.equal(facts.title,item.title,`${pathname} ${item.locale}: entry copy mismatch ${JSON.stringify(facts)}`);
    assert.equal(facts.brand,'WeiG qB WebUI',`${pathname}: page brand must remain unchanged`);
    assert.equal(facts.logo,'assets/Wei.G.png',`${pathname}: page logo must remain on Wei.G.png`);
    assert.equal(facts.favicon,'assets/Wei.G.png?v=__WEIG_GIT_SHA__',`${pathname}: browser favicon must use the canonical Wei.G.png asset`);
    assert.ok(facts.languages.length&&facts.language,`${pathname} ${item.locale}: browser language signals missing`);
    assert.deepEqual(facts.options.map(x=>x.label),['English','简中','繁中','日本語','한국어','Deutsch','Français','Español','Português','Русский'],`${pathname}: login language inventory drifted`);
    assert.equal(facts.versionPanel,0,`${pathname}: retired pre-auth qB/WebAPI/Wei.G version panel must stay absent`);
    assert.equal(facts.oldHint,0,`${pathname}: retired compatibility hint must stay absent`);
    assert.equal(facts.entrySelects,1,`${pathname}: canonical entry language Select enhancement missing`);
    assert.ok(facts.entryTrigger&&facts.entryTrigger.width<200&&facts.entryTrigger.right<=430+facts.entryTrigger.left,`${pathname}: entry language trigger must stay intrinsic instead of expanding across the login card: ${JSON.stringify(facts.entryTrigger)}`);
    assert.ok(facts.canonicalParts>=2&&facts.legacyParts===0,`${pathname}: entry language must consume the canonical ui-select DOM template without retired entry-select child owners: ${JSON.stringify(facts)}`);
    assert.deepEqual(errors,[],`${pathname} ${item.locale}: browser errors:\n${errors.join('\n')}`);
  }finally{await context.close();}
}

try{
  for(const item of cases)await verify('index.html',item);
  for(const item of cases.filter(item=>['en','zh-CN','zh-TW','zh-HK'].includes(item.app)||item.locale==='ar-AE'))await verify('login.html',item);
  {
    const context=await browser.newContext({locale:'en-US'});
    try{
      const page=await context.newPage();
      await page.goto(new URL('login.html',base).toString(),{waitUntil:'domcontentloaded'});
      const entryTrigger=page.locator('.entry-select .ui-select__trigger');
      const shortTriggerWidth=await entryTrigger.evaluate(node=>node.getBoundingClientRect().width);
      assert.ok(shortTriggerWidth>=117&&shortTriggerWidth<140,'Short login locale must stay on the canonical compact trigger width instead of reserving the longest option: '+shortTriggerWidth);
      await page.selectOption('#login-language','pt-PT');
      const longTriggerWidth=await entryTrigger.evaluate(node=>node.getBoundingClientRect().width);
      assert.ok(longTriggerWidth>shortTriggerWidth+2,'Longer current locale must grow the trigger from the current value instead of using one fixed width: '+JSON.stringify({shortTriggerWidth,longTriggerWidth}));
      await page.selectOption('#login-language','zh-CN');
      const zhTriggerWidth=await entryTrigger.evaluate(node=>node.getBoundingClientRect().width);
      assert.ok(Math.abs(zhTriggerWidth-shortTriggerWidth)<=2,'Short current locale must return to the canonical compact trigger width: '+JSON.stringify({shortTriggerWidth,zhTriggerWidth}));
      await entryTrigger.click();
      const entryMenu=page.locator('.ui-select__menu[data-entry-select-menu="1"]:not([hidden])');
      await entryMenu.waitFor();
      const entryGeometry=await page.evaluate(()=>{
        const trigger=document.querySelector('.entry-select .ui-select__trigger'),value=trigger&&trigger.querySelector('.ui-select__value'),menu=document.querySelector('.ui-select__menu[data-entry-select-menu="1"]:not([hidden])'),list=menu&&menu.querySelector('.ui-select__options'),options=[...(menu?.querySelectorAll('.ui-select__option')||[])],labels=options.map(option=>option.querySelector('.ui-select__option-label')).filter(Boolean);
        if(!trigger||!value||!menu||!list)return null;
        const r=menu.getBoundingClientRect(),tr=trigger.getBoundingClientRect(),vr=value.getBoundingClientRect(),lr=list.getBoundingClientRect(),triggerStyle=getComputedStyle(trigger),optionStyle=options[0]&&getComputedStyle(options[0]),optionHeights=options.map(option=>option.getBoundingClientRect().height),scrollbar=Math.max(0,list.offsetWidth-list.clientWidth),maxLabelRight=labels.reduce((max,label)=>Math.max(max,label.getBoundingClientRect().right),lr.left);
        return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,vw:innerWidth,vh:innerHeight,width:r.width,triggerWidth:tr.width,triggerHeight:tr.height,centerDelta:Math.abs((vr.left+vr.width/2)-(tr.left+tr.width/2)),fontSizeMatch:!!optionStyle&&triggerStyle.fontSize===optionStyle.fontSize,fontFamilyMatch:!!optionStyle&&triggerStyle.fontFamily===optionStyle.fontFamily,optionMinHeight:Math.min(...optionHeights),optionMaxHeight:Math.max(...optionHeights),optionShadow:optionStyle&&optionStyle.boxShadow,optionFilter:optionStyle&&optionStyle.filter,optionTransform:optionStyle&&optionStyle.transform,scrollbar:scrollbar,labelRightGap:lr.right-scrollbar-maxLabelRight,clipped:labels.some(label=>label.scrollWidth>label.clientWidth+1),verticalOverflow:list.scrollHeight>list.clientHeight+1,menuScrollHeight:menu.scrollHeight,menuClientHeight:menu.clientHeight};
      });
      assert.ok(entryGeometry&&entryGeometry.left>=7&&entryGeometry.right<=entryGeometry.vw-7&&entryGeometry.top>=7&&entryGeometry.bottom<=entryGeometry.vh-7&&entryGeometry.width>=entryGeometry.triggerWidth&&entryGeometry.width<220&&!entryGeometry.clipped,'Login language menu must be longest-option intrinsic, at least trigger-wide and viewport-bounded: '+JSON.stringify(entryGeometry));
      assert.ok(entryGeometry.fontSizeMatch&&entryGeometry.fontFamilyMatch&&entryGeometry.centerDelta<=2,'Login trigger and menu must share typography and the selected value must be geometrically centered: '+JSON.stringify(entryGeometry));
      assert.ok(entryGeometry.triggerHeight>=37&&entryGeometry.triggerHeight<=40&&entryGeometry.optionMinHeight>=35&&entryGeometry.optionMaxHeight<=38,'Login Select must keep canonical 38px trigger / 36px option geometry instead of inheriting the page-level 46px button skin: '+JSON.stringify(entryGeometry));
      assert.ok(entryGeometry.optionShadow==='none'&&entryGeometry.optionFilter==='none'&&entryGeometry.optionTransform==='none','Login Select options must isolate canonical presentation from page-level button shadow/filter/transform: '+JSON.stringify(entryGeometry));
      assert.ok(entryGeometry.labelRightGap>=6,'Login language labels must retain safe space before the scrollbar gutter: '+JSON.stringify(entryGeometry));
      assert.ok(!entryGeometry.verticalOverflow,'Login language menu must not create a needless vertical scrollbar when all supported locales fit in the available viewport: '+JSON.stringify(entryGeometry));
      await page.locator('.ui-select__menu[data-entry-select-menu="1"] .ui-select__option[data-value="zh-TW"]').click();
      assert.equal(await page.locator('#login-title').textContent(),'歡迎回來');
      assert.equal(await page.evaluate(()=>WeiG.SessionContract.localeIntent()),'zh-TW');
      await page.reload({waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('#login-language').inputValue(),'zh-TW');
      assert.equal(await page.locator('#login-title').textContent(),'歡迎回來');
      await page.selectOption('#login-language','pt-PT');
      assert.equal(await page.evaluate(()=>WeiG.SessionContract.localeIntent()),'pt-PT');
      assert.equal(await page.locator('#login-language').inputValue(),'pt-PT');
    }finally{await context.close();}
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log('Entry locale browser acceptance passed: Login and Settings share one Select geometry owner; trigger width follows the current value, menu width follows the longest option, fitting menus avoid needless scrollbars, and locale persistence/typography remain canonical.');
