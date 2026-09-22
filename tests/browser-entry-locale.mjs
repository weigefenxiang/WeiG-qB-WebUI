import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from './browser-driver.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const publicRoot=path.resolve(here,'../webui/public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

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
      language:String(navigator.language||'')
    }));
    assert.equal(facts.lang,item.app,`${pathname} ${item.locale}: entry language mismatch ${JSON.stringify(facts)}`);
    assert.equal(facts.title,item.title,`${pathname} ${item.locale}: entry copy mismatch ${JSON.stringify(facts)}`);
    assert.equal(facts.brand,'WeiG qB WebUI',`${pathname}: page brand must remain unchanged`);
    assert.equal(facts.logo,'assets/Wei.G.ico',`${pathname}: page logo must remain on Wei.G.ico`);
    assert.equal(facts.favicon,'assets/Wei.G.ico?v=__WEIG_GIT_SHA__',`${pathname}: browser favicon must use the canonical Wei.G.ico asset`);
    assert.ok(facts.languages.length&&facts.language,`${pathname} ${item.locale}: browser language signals missing`);
    assert.deepEqual(errors,[],`${pathname} ${item.locale}: browser errors:\n${errors.join('\n')}`);
  }finally{await context.close();}
}

try{
  for(const item of cases)await verify('index.html',item);
  for(const item of cases.filter(item=>['en','zh-CN','zh-TW','zh-HK'].includes(item.app)||item.locale==='ar-AE'))await verify('login.html',item);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log('Entry locale browser acceptance passed: English-first fallback, browser auto-detect for eleven supported languages, distinct zh-CN/zh-TW/zh-HK mapping, canonical Wei.G.ico favicon, and unchanged page logo are consistent on public/index.html and public/login.html.');
