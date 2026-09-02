import fs from 'node:fs';
import vm from 'node:vm';
function assert(ok,msg){if(!ok)throw new Error(msg);}
const source=fs.readFileSync('webui/private/scripts/torrent-semantics.js','utf8');
const app=fs.readFileSync('webui/private/scripts/app.js','utf8');
const index=fs.readFileSync('webui/private/index.html','utf8');
const sandbox={URL};sandbox.window={WeiG:{util:{normalizeTracker(raw){const value=String(raw||'').trim();if(!value)return'';try{const u=new URL(value);return `${u.protocol}//${u.hostname}${u.port?':'+u.port:''}${u.pathname||'/'}`;}catch{return value.split('?')[0].split('#')[0];}}}}};
vm.runInNewContext(source,sandbox,{filename:'torrent-semantics.js'});const S=sandbox.window.WeiG.TorrentSemantics;
assert(S&&typeof S.isPrivateOrPt==='function','TorrentSemantics must expose isPrivateOrPt');
assert(S.isPrivate({private:true})===true,'boolean private=true must be exact private');assert(S.isPrivate({private:1})===true,'numeric private=1 must be exact private');assert(S.isPrivate({private:'1'})===true,'string private=1 must be exact private');assert(S.isPrivate({private:0})===false,'private=0 must not be private');
assert(S.isPt({tracker:'https://tracker.pt.example/announce'},['pt.example'])===true,'PT tracker subdomain must match configured domain');assert(S.isPt({tracker:'https://notpt.example/announce'},['pt.example'])===false,'unrelated tracker must not match PT rule');
assert(S.isPrivateOrPt({private:1,tracker:'https://public.example/announce'},[])===true,'private flag must match without PT rule');assert(S.isPrivateOrPt({private:0,tracker:'https://tracker.pt.example/announce'},['pt.example'])===true,'PT tracker must match union semantics');
assert(app.includes('W.TorrentSemantics.isPrivateOrPt(t,cfg.ptTrackers)'),'app Private/PT filter must consume canonical union semantics');
assert(index.includes('scripts/torrent-semantics.js?v=__WEIGG_GIT_SHA__'),'TorrentSemantics runtime must be exact-SHA addressed');assert(index.indexOf('scripts/torrent-semantics.js')<index.indexOf('scripts/app.js'),'TorrentSemantics must load before app.js');
console.log('Canonical Private/PT semantics contract passed.');
