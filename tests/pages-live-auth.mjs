import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');

const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForDeployedSha(){
  let last='not fetched';
  for(let attempt=1;attempt<=30;attempt++){
    try{
      const url=new URL('metadata/site.json',base);
      url.searchParams.set('__auth_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
      if(response.ok){
        const site=await response.json();
        last=site?.simulatorSha||'missing simulatorSha';
        if(last===expectedSha)return site;
      }else last=`HTTP ${response.status}`;
    }catch(error){last=error?.message||String(error);}
    await sleep(1000);
  }
  throw new Error(`Pages auth gate did not observe simulator SHA ${expectedSha}; last observation: ${last}`);
}

async function api(page,path,{method='GET',form,json}={}){
  return page.evaluate(async({path,method,form,json})=>{
    const init={method,cache:'no-store'};
    if(form){
      const body=new URLSearchParams();
      for(const [key,value] of Object.entries(form))body.set(key,String(value));
      init.headers={'content-type':'application/x-www-form-urlencoded'};
      init.body=body.toString();
    }else if(json!==undefined){
      init.headers={'content-type':'application/json'};
      init.body=JSON.stringify(json);
    }
    const response=await fetch(`api/v2/${path}`,init);
    const text=await response.text();
    let parsed=null;
    try{parsed=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json:parsed};
  },{path,method,form,json});
}

async function openSession(page,{qb='5.2.3',clean=false,label='modern'}={}){
  const sim=`pages-live-auth-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim,qb,count:'24',scenario:'mixed',seed:`pages-live-auth-${label}`,clean:clean?'1':'0',reset:'1'}).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  return sim;
}

async function waitForPrivate(page,qbVersion){
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(
    version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),
    qbVersion,
    {timeout:60000}
  );
}

await waitForDeployedSha();
const browser=await launchBrowser();
try{
  {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error?.stack||error?.message||String(error)));

    await openSession(page,{qb:'5.2.3',clean:false,label:'modern'});
    assert.equal(await page.locator('#username').inputValue(),'weigshare','Lab must prefill the fixed username');
    assert.equal(await page.locator('#password').inputValue(),'weigshare','Lab must prefill the fixed password');

    let response=await api(page,'app/preferences');
    assert.equal(response.status,403,'protected API must reject an unauthenticated Lab session');

    response=await api(page,'auth/login',{method:'POST',form:{username:'weigshare',password:'wrong-password'}});
    assert.equal(response.status,401,'modern Virtual qB must reject an incorrect password');
    response=await api(page,'app/preferences');
    assert.equal(response.status,403,'wrong password must not create an authenticated session');

    await page.locator('#login-btn').click();
    await waitForPrivate(page,'5.2.3');
    response=await api(page,'app/preferences');
    assert.equal(response.status,200,'fixed weigshare credentials must authenticate the Lab');
    assert.equal(response.json?.web_ui_username,'weigshare','Virtual qB preferences must expose the fixed username');
    assert.equal(Object.prototype.hasOwnProperty.call(response.json||{},'web_ui_password'),false,'Virtual qB must never expose the write-only WebUI password');

    response=await api(page,'app/setPreferences',{method:'POST',form:{json:JSON.stringify({web_ui_password:'weigshare2'})}});
    assert.equal(response.status,200,'Virtual qB password change must be accepted through app/setPreferences');
    response=await api(page,'app/preferences');
    assert.equal(Object.prototype.hasOwnProperty.call(response.json||{},'web_ui_password'),false,'changed password must remain write-only');

    response=await api(page,'auth/logout',{method:'POST',form:{}});
    assert.equal(response.status,200,'logout after password change must succeed');
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});

    response=await api(page,'auth/login',{method:'POST',form:{username:'weigshare',password:'weigshare'}});
    assert.equal(response.status,401,'old password must be rejected after a real password change');
    response=await api(page,'app/preferences');
    assert.equal(response.status,403,'rejected old password must not unlock protected APIs');

    response=await api(page,'auth/login',{method:'POST',form:{username:'weigshare',password:'weigshare2'}});
    assert.equal(response.status,204,'changed password must authenticate modern Virtual qB');
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await waitForPrivate(page,'5.2.3');
    response=await api(page,'app/version');
    assert.equal(response.status,200);assert.equal(response.text,'v5.2.3','changed-password session must continue into real virtual API behavior');

    response=await api(page,'app/setPreferences',{method:'POST',form:{json:JSON.stringify({web_ui_password:'weigshare'})}});
    assert.equal(response.status,200,'auth gate must restore the fixed Lab password');
    response=await api(page,'auth/logout',{method:'POST',form:{}});
    assert.equal(response.status,200);

    assert.deepEqual(pageErrors,[],`Virtual qB modern auth lifecycle emitted page errors:\n${pageErrors.join('\n')}`);
    await context.close();
  }

  {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    await openSession(page,{qb:'4.1.9.1',clean:true,label:'legacy'});
    assert.equal(await page.locator('#username').inputValue(),'','Clean mode must not inject the fixed username');
    assert.equal(await page.locator('#password').inputValue(),'','Clean mode must not inject the fixed password');

    let response=await api(page,'auth/login',{method:'POST',form:{username:'weigshare',password:'wrong-password'}});
    assert.equal(response.status,200,'legacy WebAPI preserves HTTP 200 on invalid credentials');
    assert.equal(response.text,'Fails.','legacy Virtual qB must expose the historical invalid-login body');
    response=await api(page,'app/preferences');
    assert.equal(response.status,403,'legacy wrong password must not authenticate');

    response=await api(page,'auth/login',{method:'POST',form:{username:'weigshare',password:'weigshare'}});
    assert.equal(response.status,200,'legacy fixed credentials must follow the historical login status');
    assert.equal(response.text,'Ok.','legacy fixed credentials must follow the historical login body');
    response=await api(page,'app/preferences');
    assert.equal(response.status,200,'legacy fixed credentials must unlock protected APIs');
    assert.equal(response.json?.web_ui_username,'weigshare');
    await context.close();
  }

  console.log(JSON.stringify({
    virtualQbAuthLifecycle:'PASS',
    presetUsername:'weigshare',
    presetPassword:'weigshare',
    wrongPasswordRejected:true,
    passwordChangeApplied:true,
    oldPasswordRejectedAfterChange:true,
    changedPasswordAccepted:true,
    passwordWriteOnly:true,
    modern:'5.2.3',
    legacy:'4.1.9.1',
    sha:expectedSha
  }));
}finally{
  await browser.close();
}
