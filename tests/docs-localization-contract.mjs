import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const locales=['en','zh-CN','zh-TW','ja','ko','de','fr','es','pt','ru'];
const latest='https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest';
const protectedScreens={
  'weig-qb-webui-desktop-overview-v1.2.0.gif':'dc1878df00d6cbc64a5f8fdffe5013c2f941c8b6',
  'weig-qb-webui-desktop-overview-v1.2.0.png':'435aaf6778a00e71e1e8946ae022e92ce90f80bd',
  'weig-qb-webui-mobile-overview-v1.2.0.gif':'342300ae72ea1b42bd36228293a2738503ea9b10',
  'weig-qb-webui-mobile-overview-v1.2.0.png':'4a03483b0748d67f43da0b6ab61cd307043113b7',
  'weig-qb-webui-desktop-overview.gif':'dc1878df00d6cbc64a5f8fdffe5013c2f941c8b6',
  'weig-qb-webui-desktop-overview.png':'435aaf6778a00e71e1e8946ae022e92ce90f80bd',
  'weig-qb-webui-mobile-overview.gif':'342300ae72ea1b42bd36228293a2738503ea9b10',
  'weig-qb-webui-mobile-overview.png':'4a03483b0748d67f43da0b6ab61cd307043113b7'
};
for(const [name,expected] of Object.entries(protectedScreens)){
  const bytes=fs.readFileSync(path.join(root,'assets/screenshots',name));
  const actual=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(actual,expected,'Protected screenshot bytes modified: '+name);
}
const oldFlags=/(?:--channel=|--dir=|--update\b|-Channel\b|-Destination\b|-Mode\b)/;
for(const locale of locales){
  const readme=locale==='en'?'README.md':'translations/README.'+locale+'.md';
  const guide='translations/installation-guide/deployment-guide.'+locale+'.md';
  const a=read(readme),b=read(guide),prefix=locale==='en'?'assets/screenshots/':'../assets/screenshots/';
  assert(a.includes(latest)&&a.includes('weig-qb-webui.zip'),locale+' README release link missing');
  assert(a.includes('-version 1.2.0')&&b.includes('-version 1.2.0'),locale+' version example drift');
  assert(a.includes('-qbconfig')&&b.includes('-qbconfig'),locale+' Windows custom config option missing');
  assert(!a.includes('weig-qb-webui.tar.gz'),locale+' retired tar.gz recommendation');
  assert(!oldFlags.test(a)&&!oldFlags.test(b),locale+' retired CLI still documented');
  for(const file of ['weig-qb-webui-desktop-overview.png','weig-qb-webui-mobile-overview.gif','weig-qb-webui-mobile-overview.png']){
    const src=prefix+file;
    assert(a.includes(src),locale+' screenshot reference mismatch: '+src);
    assert(fs.existsSync(path.resolve(root,path.dirname(readme),src)),locale+' screenshot not found: '+src);
  }
  const dockerStart=a.indexOf('### Docker'),dockerEnd=a.indexOf('### Windows PowerShell',dockerStart);
  assert(dockerStart>=0&&dockerEnd>dockerStart,locale+' Docker instructions missing');
  const docker=a.slice(dockerStart,dockerEnd);
  for(const example of ['sh install.sh --list-containers','sh install.sh --container=qbittorrent-test -configure',
    'Host install path:','qBittorrent Root Folder:','/config/weig-qb-webui']){
    assert(docker.includes(example),locale+' Docker guide lost an executable example or path: '+example);
  }
  assert(!a.includes('-overview-v1.1.0.'),locale+' stale screenshot alias');
  assert(a.includes('width="800"')&&a.includes('height="341"'),locale+' screenshot dimensions drift');
  const images=a.split('\n').filter(line=>line.includes('<img ')&&line.includes('mobile-overview.'));
  assert.equal(images.length,1,locale+' mobile GIF and PNG must stay adjacent on one line');
  assert(images[0].includes('mobile-overview.gif')&&images[0].includes('mobile-overview.png'),locale+' mobile preview pair missing');
  for(const [text,file] of [[a,readme],[b,guide]]){
    assert.equal((text.match(/<details>/g)||[]).length,(text.match(/<\/details>/g)||[]).length,locale+' unbalanced foldouts in '+file);
  }
}
console.log('Localized documentation contract passed: ten README/guide pairs, current CLI, image layout and eight immutable screenshot blobs.');
