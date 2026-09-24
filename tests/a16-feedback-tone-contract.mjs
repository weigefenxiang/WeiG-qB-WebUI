import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const settings=read('webui/private/scripts/settings.js');
const progress=read('webui/private/css/progress.css');

assert(settings.includes('function verifiedSettingValue(key,prefs)'),'Settings feedback must have one verified-value formatter');
assert(settings.includes('function qBChangeSummaries(pending,before,verified)'),'Settings feedback must build change summaries instead of label-only feedback');
assert(settings.includes('labels=qBChangeSummaries(pending,before,controller.prefs)'),'qB Settings success feedback must be generated after the verified server reread');
assert(settings.includes("tr(display?'common.yes':'common.no')"),'boolean Settings feedback must use localized state text');
assert(settings.includes('Array.isArray(info.meta.enum)')&&settings.includes('option.label'),'enum Settings feedback must use the source-derived localized option label');
assert(settings.includes("String(display)+(unit?' '+unit:'')"),'numeric Settings feedback must retain the source-derived unit when available');
assert(!settings.includes('function qBChangeLabels('),'retired label-only qB Settings feedback owner must stay removed');

assert(progress.includes('--torrent-tone-stalled-up:#79d9ad;'),'stalled seeding tone must be light green');
assert(progress.includes('--torrent-tone-stopped-complete:#a88cff;'),'completed-but-stopped tone must be purple');
assert((progress.match(/--torrent-tone-stalled-up:/g)||[]).length===1,'stalled seeding tone must have one canonical token owner');
assert((progress.match(/--torrent-tone-stopped-complete:/g)||[]).length===1,'completed stopped tone must have one canonical token owner');

console.log('A16 feedback/tone contract passed: verified Settings values are summarized after reread and Torrent stalled-seeding/stopped-complete colors remain single-owner semantic tokens.');
