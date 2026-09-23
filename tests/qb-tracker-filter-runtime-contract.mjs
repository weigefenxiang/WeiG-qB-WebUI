import assert from 'node:assert/strict';
import {compactTrackerFacetModeTimeline,compactTrackerFilterTimeline,materializeTrackerRuntime} from '../tools/qb-tracker-filter-runtime.mjs';
const sha=n=>String(n).repeat(40),ref=source=>({source,context:'TrackerFiltersList'});
const catalog=[
  {qbVersion:'4.1.0',sourceSha:sha(1),trackerFilters:[],trackerFacetMode:'none'},
  {qbVersion:'4.2.5',sourceSha:sha(2),trackerFilters:[],trackerFacetMode:'none'},
  {qbVersion:'4.3.0',sourceSha:sha(3),trackerFilters:[{id:'all',copy:ref('All (%1)')},{id:'trackerless',copy:ref('Trackerless (%1)')}],trackerFacetMode:'url'},
  {qbVersion:'4.5.5',sourceSha:sha(4),trackerFilters:[{id:'all',copy:ref('All (%1)')},{id:'trackerless',copy:ref('Trackerless (%1)')}],trackerFacetMode:'url'},
  {qbVersion:'4.6.0',sourceSha:sha(5),trackerFilters:[{id:'all',copy:ref('All (%1)')},{id:'trackerless',copy:ref('Trackerless (%1)')}],trackerFacetMode:'hostname'},
  {qbVersion:'5.1.0',sourceSha:sha(6),trackerFilters:[{id:'all',copy:ref('All')},{id:'trackerless',copy:ref('Trackerless')}],trackerFacetMode:'hostname'},
  {qbVersion:'5.2.0',sourceSha:sha(7),trackerFilters:[{id:'all',copy:ref('All')},{id:'trackerless',copy:ref('Trackerless')},{id:'error',copy:ref('Tracker error')},{id:'otherError',copy:ref('Other error')},{id:'warning',copy:ref('Warning')}],trackerFacetMode:'hostname'}
];
assert.deepEqual(compactTrackerFilterTimeline(catalog).map(item=>item.from),['4.1.0','4.3.0','5.1.0','5.2.0']);
assert.deepEqual(compactTrackerFacetModeTimeline(catalog),[{from:'4.1.0',value:'none'},{from:'4.3.0',value:'url'},{from:'4.6.0',value:'hostname'}]);
const template={schemaVersion:1,sourceFacts:{torrentFilters:[{from:'4.1.0',value:['all']}]},sentinel:'preserve'},out=materializeTrackerRuntime(catalog,template);
assert.equal(out.sentinel,'preserve');assert.deepEqual(out.sourceFacts.torrentFilters,template.sourceFacts.torrentFilters);assert.equal(out.sourceFacts.trackerFacetMode.at(-1).value,'hostname');assert.equal(template.sourceFacts.trackerFilters,undefined);
assert.throws(()=>compactTrackerFilterTimeline([{qbVersion:'4.1.0',sourceSha:sha(1)}]),/trackerFilters are missing/);
assert.throws(()=>compactTrackerFacetModeTimeline([{qbVersion:'4.1.0',sourceSha:sha(1),trackerFacetMode:'guessed'}]),/trackerFacetMode is invalid/);
console.log('Tracker runtime materialization contract passed: exact source facts compact into filter and grouping-mode change points without rewriting unrelated owners.');
