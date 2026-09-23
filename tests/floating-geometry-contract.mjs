import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const floating=read('webui/private/scripts/floating.js');
const controls=read('webui/private/css/controls.css');

assert.match(floating,/function placeBounded\(menu,anchor,opts\)/,'Floating Select and Context Menu must share one viewport-bounded geometry owner');
assert.match(floating,/function modalLayer\(owner\)[\s\S]*closest\('dialog\[open\]'\)[\s\S]*dataset\.uiModalLayer='1'/,'Canonical Select must portal a modal menu into the open dialog top-layer subtree instead of leaving it below showModal().');
assert.match(floating,/function selectLayer\(owner\)\{return modalLayer\(owner\)\|\|layer\(\);\}/,'Canonical Select must keep one portal resolver: dialog-local when modal, global otherwise.');
assert.match(floating,/selectLayer\(w\)\.appendChild\(m\)/,'Select open must consume the canonical modal-aware portal resolver.');
assert.match(floating,/function place\(w\)[\s\S]*placeBounded\(m,r,/,'Canonical Select must use the shared bounded geometry owner');
assert.match(floating,/function placeContextMenu\(menu,x,y\)[\s\S]*placeBounded\(menu,r,/,'Context Menu must use the same bounded geometry owner');
assert.match(floating,/menu\.style\.maxHeight=maxH\+'px'/,'Shared geometry must cap the floating menu to the visual viewport');
assert.match(floating,/v\.width<=820\?\.84:\.68/,'Shared geometry must keep the existing mobile/desktop viewport budget');
assert.match(controls,/\.ui-select__options\{[^}]*min-height:0;max-height:none;overflow:auto/,'Floating list contents must own overflow scrolling inside the bounded menu');
assert.doesNotMatch(floating,/function placeContextMenu\(menu,x,y\)\{var v=viewport\(\)/,'Context Menu must not restore a parallel viewport-placement implementation');

assert.match(floating,/function intrinsicMenuWidth\(menu\)/,'Shared Select must have one DOM-aware intrinsic-width measurement owner');
assert.match(floating,/horizontalBox\(menuStyle\)\+horizontalBox\(listStyle\)\+gutter/,'Intrinsic Select width must include real menu/list chrome and scrollbar gutter instead of a magic allowance');
assert.match(floating,/pseudoWidth\(option,optionStyle\)/,'Intrinsic Select width must include selected-option check/gap chrome');
assert.match(floating,/desktopMax=v\.width>820\?Math\.max\(160,Math\.floor\(v\.width\*\.5\)\):viewportMax/,'Desktop Select overlay must remain capped to about half the visual viewport');
assert.doesNotMatch(floating,/measureText\(label\.textContent,label\)\)\+38/,'Shared Select intrinsic sizing must not use the retired +38px chrome guess');
const ui=read('webui/private/css/ui.css');
assert.match(ui,/\.ui-select__menu\{min-inline-size:0;max-inline-size:none\}/,'CSS must not keep a second ch/360px menu-width owner');
assert.doesNotMatch(ui,/--select-menu-ch|360px/,'Retired Select ch/360px width policy must not survive in ui.css');

console.log('Floating geometry contract passed: Select and Context Menu share one visual-viewport-bounded placement owner with internal list scrolling.');
