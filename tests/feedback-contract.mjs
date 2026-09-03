import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}

const feedback=read('webui/private/scripts/feedback.js');
const css=read('webui/private/css/feedback.css');
const core=read('webui/private/scripts/core.js');
const html=read('webui/private/index.html');
const app=read('webui/private/scripts/app.js');
const settings=read('webui/private/scripts/settings.js');
const selection=read('webui/private/scripts/selection.js');
const pkg=JSON.parse(read('package.json'));
const version=read('VERSION').trim();
const webVersion=read('webui/VERSION').trim();

assert(/^\d+\.\d+\.\d+$/.test(version)&&webVersion===version&&pkg.version===version,'product versions must stay synchronized semantic patch versions');
assert(!/W\.toast\s*=\s*function/.test(core),'core.js legacy toast owner must be retired');
assert(/W\.Feedback\s*=/.test(feedback)&&/W\.toast\s*=\s*toast/.test(feedback),'feedback.js must be the canonical W.toast owner');
assert(/MAX_VISIBLE\s*=\s*4/.test(feedback),'feedback stack must be bounded to four visible records');
assert(/nextAutoOrder/.test(feedback)&&/timeoutInFlight/.test(feedback)&&/flushTimeoutQueue/.test(feedback),'automatic feedback lifetime must preserve strict FIFO exit order');
for(const kind of ['info','success','warning','error'])assert(new RegExp(`${kind}:\\d+`).test(feedback),`missing ${kind} duration`);
assert(/update:function/.test(feedback)&&/dismiss:function/.test(feedback),'toast handle must support update and dismiss');
assert(/role',kind==='error'\?'alert':'status'/.test(feedback),'feedback roles must distinguish error alerts');
assert(/aria-atomic/.test(feedback),'feedback card must be aria-atomic');
for(const forbidden of ['new W.QBClient','MutationObserver','prototype.','fetch('])assert(!feedback.includes(forbidden),`feedback owner must not contain ${forbidden}`);
assert(/color-mix/.test(css)&&/var\(--surface-floating\)/.test(css),'feedback skin must consume current surface tokens');
assert(/env\(safe-area-inset-top\)/.test(css)&&/env\(safe-area-inset-left\)/.test(css)&&/env\(safe-area-inset-right\)/.test(css),'mobile feedback must respect safe areas');
assert(/translate3d\(42px,0,0\)/.test(css),'canonical dismissal must slide to the right');
assert(/prefers-reduced-motion/.test(css)&&/data-motion=reduced/.test(css),'feedback must honor both reduced-motion authorities');
assert(!/\.toast-region\{/.test(read('webui/private/css/app.css'))&&!/\.toast\{/.test(read('webui/private/css/app.css')),'legacy toast CSS must leave app.css');
assert((html.match(/css\/feedback\.css/g)||[]).length===1&&(html.match(/scripts\/feedback\.js/g)||[]).length===1,'feedback assets must load exactly once');
assert(/id="toast-region" class="feedback-stack"/.test(html)&&/aria-relevant="additions text"/.test(html),'canonical live region contract is missing');
assert(!/W\.toast\([^\n]*,'danger'/.test(app),'app.js must not use legacy danger feedback kind');
assert(!/W\.toast\([^\n]*,'danger'/.test(settings),'settings.js must not use legacy danger feedback kind');
assert(!/notify\([^\n]*,'danger'/.test(selection),'selection.js must not use legacy danger feedback kind');
assert(!/fact\(text\('Version','版本'\),'0\.3\./.test(settings),'About must not hard-code product version');
console.log('Floating feedback contract passed: single owner, canonical kinds, bounded stack, safe-area, right-slide exit, reduced motion, version authority.');
