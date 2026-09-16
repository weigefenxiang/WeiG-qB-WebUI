import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const rss=fs.readFileSync(path.join(root,'webui/private/scripts/rss.js'),'utf8');

assert.match(rss,/ownKey\(rule,'smartFilter'\).*rss\.rule\.smartFilter/s,'RSS editor must render the source-returned smartFilter field.');
assert.match(rss,/ownKey\(rule,'smartFilter'\).*rule\.smartFilter=!!get\('smartFilter'\)\.checked/s,'RSS editor must round-trip smartFilter when the source-returned rule contains it.');
assert.match(rss,/stopped:ownKey\(tp,'stopped'\)\?\['tp','stopped'\]/,'modern RSS rules must bind qB torrentParams.stopped instead of inventing torrentParams.paused.');
assert.match(rss,/function triState\(value\).*value===null\|\|value===undefined\?'default'/s,'RSS tri-state controls must preserve upstream null/default semantics.');
assert.match(rss,/function triValue\(value\)\{return value==='default'\?null:value==='always';\}/,'RSS tri-state writes must serialize default as null, always as true, never as false.');
assert.match(rss,/subfolder:ownKey\(rule,'createSubfolder'\)\?\['rule','createSubfolder'\]/,'legacy native RSS createSubfolder rules must retain their source-returned field.');
assert.match(rss,/layout:ownKey\(rule,'torrentContentLayout'\).*ownKey\(tp,'content_layout'\)/s,'RSS content layout must preserve both historical native field shapes without qB-version branches.');
assert.match(rss,/state\.draft=clone\(state\.rules\[name\]\|\|\{\}\)/,'RSS editing must continue preserving the complete source-returned rule object.');
assert.doesNotMatch(rss,/Client\.prototype\./,'RSS feature module must not regain transport ownership.');

console.log('RSS rule fidelity contract passed: smartFilter, stopped/default tri-state, legacy subfolder, content-layout shapes, and source-returned rule preservation remain canonical.');
