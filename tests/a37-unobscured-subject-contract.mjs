import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('webui/private/scripts/core.js');
const app=read('webui/private/scripts/app.js');

assert.match(core,/W\.DataViewport\.prototype\.firstUnobscuredIndex=function\(\).*top=Math\.max\(0,geometry\.visible\?this\.el\.scrollTop:remembered\).*Math\.ceil\(top\/Math\.max\(1,Number\(this\.rowHeight\)\|\|1\)\)/s,'DataViewport must own fixed-height first-unobscured geometry from the actual scroll offset');
assert.match(core,/if\(this\.variableHeight\)\{index=this\._indexAtOffset\(top\);if\(\(this\.offsets\[index\]\|\|0\)<top\)index\+\+;\}/,'variable-height DataViewport must advance past a partially obscured row instead of hard-coding +1 in a feature');
assert.match(core,/W\.DataViewport\.prototype\.firstUnobscuredItem=function\(\)/,'DataViewport must expose canonical first-unobscured item semantics');
assert.match(app,/function visibleDetailDockHash\(\)\{var item=app\.viewport&&app\.viewport\.firstUnobscuredItem\?app\.viewport\.firstUnobscuredItem\(\):null;/,'zero-selection Detail subject must consume shared first-unobscured semantics');
assert.doesNotMatch(app,/function visibleDetailDockHash\(\).*firstVisibleItem/s,'Detail subject must not retain the old partially-obscured viewport semantic');
assert.match(core,/W\.DataViewport\.prototype\.firstVisibleItem=function\(\)/,'existing firstVisibleItem API must remain available for callers whose semantic is partial visibility');
console.log('A37 unobscured subject contract passed: Detail preview consumes shared DataViewport geometry without DOM scanning or feature-local +1.');
