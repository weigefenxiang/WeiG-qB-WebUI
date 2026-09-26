import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const transfer=read('webui/private/scripts/transfer.js');
const layout=read('webui/private/scripts/layout.js');
const sidebar=read('webui/private/css/sidebar.css');
const rss=read('webui/private/scripts/rss.js');
const progress=read('webui/private/css/progress.css');
const table=read('webui/private/css/table.css');
const app=read('webui/private/scripts/app.js');

assert.ok(transfer.includes('function decorateRateMetric(node,kind,labelText)')&&transfer.includes('decorateRateMetric:decorateRateMetric'),'Transfer must own one reusable direction/label/rate presenter.');
assert.ok(layout.includes("W.Transfer.decorateRateMetric(downMetric,'download',tr('transfer.download'))")&&layout.includes("W.Transfer.decorateRateMetric(upMetric,'upload',tr('transfer.upload'))"),'Desktop Sidebar must consume canonical Transfer arrow semantics.');
assert.ok(!sidebar.includes('.sidebar-transfer-rate::before'),'Desktop Sidebar realtime rates must not own circular direction markers.');

assert.ok(!rss.includes('returnHash')&&!rss.includes('captureReturnHash')&&!rss.includes('restoreReturnHash')&&!rss.includes("Router.go('rss')"),'RSS Downloader must not navigate away from Settings to manufacture dialog context.');
assert.ok(rss.includes('async function openResolved(){await install();')&&rss.includes('await loadRules();W.DialogRuntime.open(state.dialog'),'RSS Downloader must open the shared dialog in-place on the current route.');

assert.ok(progress.includes('.data-viewport.is-scroll-interacting .progress-fill::before,.data-viewport.is-scroll-interacting .progress-fill::after{animation-play-state:paused!important}'),'Progress motion must pause without destroying animation identity.');
assert.ok(!progress.includes('.data-viewport.is-scroll-interacting .progress-fill::before,.data-viewport.is-scroll-interacting .progress-fill::after{animation:none!important'),'Progress scroll policy must not reset animation timelines.');
assert.ok(table.includes('.data-viewport__row{will-change:transform}'),'Bounded recycler rows must keep transform motion compositor-ready with the table/DataViewport presentation owner.');
assert.ok(table.includes('.data-viewport.is-scroll-interacting .torrent-state-icon[data-active=true]{animation-play-state:paused!important;filter:none!important}'),'Torrent state pulse must keep its component-owned animation identity and only pause phase during scroll.');

// Final exact-SHA UI gate marker for A23.
assert.ok(app.includes("await refreshTrackerFacet();app.catalogReady=true;emitLibraryState('catalog-ready')"),'catalog readiness must include tracker enrichment before browser consumers observe READY.');

console.log('A23 contract passed: canonical transfer arrows, route-independent RSS Downloader, and phase-preserving native-scroll motion are locked.');
