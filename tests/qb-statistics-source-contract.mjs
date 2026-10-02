import assert from 'node:assert/strict';
import {extractQbStatisticsUi,statisticsTranslationRefs,statisticsUiBindingCount,validateQbStatisticsUi} from '../tools/qb-statistics-source.mjs';

const markup=`
<div id="statisticsContent">
<h3>QBT_TR(User statistics)QBT_TR[CONTEXT=StatsDialog]</h3><table>
<tr><td>QBT_TR(All-time upload:)QBT_TR[CONTEXT=StatsDialog]</td><td id="AlltimeUL"></td></tr>
<tr><td>QBT_TR(All-time download:)QBT_TR[CONTEXT=StatsDialog]</td><td id="AlltimeDL"></td></tr>
<tr><td>QBT_TR(All-time share ratio:)QBT_TR[CONTEXT=StatsDialog]</td><td id="GlobalRatio"></td></tr>
<tr><td>QBT_TR(Session waste:)QBT_TR[CONTEXT=StatsDialog]</td><td id="TotalWastedSession"></td></tr>
<tr><td>QBT_TR(Connected peers:)QBT_TR[CONTEXT=StatsDialog]</td><td id="TotalPeerConnections"></td></tr>
</table>
<h3>QBT_TR(Cache statistics)QBT_TR[CONTEXT=StatsDialog]</h3><table>
<tr><td>QBT_TR(Read cache hits:)QBT_TR[CONTEXT=StatsDialog]</td><td id="ReadCacheHits"></td></tr>
<tr><td>QBT_TR(Total buffer size:)QBT_TR[CONTEXT=StatsDialog]</td><td id="TotalBuffersSize"></td></tr>
</table>
<h3>QBT_TR(Performance statistics)QBT_TR[CONTEXT=StatsDialog]</h3><table>
<tr><td>QBT_TR(Write cache overload:)QBT_TR[CONTEXT=StatsDialog]</td><td id="WriteCacheOverload"></td></tr>
<tr><td>QBT_TR(Read cache overload:)QBT_TR[CONTEXT=StatsDialog]</td><td id="ReadCacheOverload"></td></tr>
<tr><td>QBT_TR(Queued I/O jobs:)QBT_TR[CONTEXT=StatsDialog]</td><td id="QueuedIOJobs"></td></tr>
<tr><td>QBT_TR(Average time in queue:)QBT_TR[CONTEXT=StatsDialog]</td><td id="AverageTimeInQueue"></td></tr>
<tr><td>QBT_TR(Total queued size:)QBT_TR[CONTEXT=StatsDialog]</td><td id="TotalQueuedSize"></td></tr>
</table></div>`;
const oldRuntime=`
$('AlltimeDL').set('html', friendlyUnit(serverState.alltime_dl, false));
$('AlltimeUL').set('html', friendlyUnit(serverState.alltime_ul, false));
$('TotalWastedSession').set('html', friendlyUnit(serverState.total_wasted_session, false));
$('GlobalRatio').set('html', serverState.global_ratio);
$('TotalPeerConnections').set('html', serverState.total_peer_connections);
$('ReadCacheHits').set('html', serverState.read_cache_hits + "%");
$('TotalBuffersSize').set('html', friendlyUnit(serverState.total_buffers_size, false));
$('WriteCacheOverload').set('html', serverState.write_cache_overload + "%");
$('ReadCacheOverload').set('html', serverState.read_cache_overload + "%");
$('QueuedIOJobs').set('html', serverState.queued_io_jobs);
$('AverageTimeInQueue').set('html', serverState.average_time_queue + " ms");
$('TotalQueuedSize').set('html', friendlyUnit(serverState.total_queued_size, false));`;
const modernRuntime=`
statistics.alltimeDL = serverState.alltime_dl; statistics.alltimeUL = serverState.alltime_ul; statistics.totalWastedSession = serverState.total_wasted_session;
statistics.globalRatio = serverState.global_ratio; statistics.totalPeerConnections = serverState.total_peer_connections; statistics.readCacheHits = serverState.read_cache_hits;
statistics.totalBuffersSize = serverState.total_buffers_size; statistics.writeCacheOverload = serverState.write_cache_overload; statistics.readCacheOverload = serverState.read_cache_overload;
statistics.queuedIOJobs = serverState.queued_io_jobs; statistics.averageTimeInQueue = serverState.average_time_queue; statistics.totalQueuedSize = serverState.total_queued_size;
document.getElementById("AlltimeDL").textContent = friendlyUnit(statistics.alltimeDL, false);
document.getElementById("AlltimeUL").textContent = friendlyUnit(statistics.alltimeUL, false);
document.getElementById("TotalWastedSession").textContent = friendlyUnit(statistics.totalWastedSession, false);
document.getElementById("GlobalRatio").textContent = statistics.globalRatio;
document.getElementById("TotalPeerConnections").textContent = statistics.totalPeerConnections;
document.getElementById("ReadCacheHits").textContent = \`\${statistics.readCacheHits}%\`;
document.getElementById("TotalBuffersSize").textContent = friendlyUnit(statistics.totalBuffersSize, false);
document.getElementById("WriteCacheOverload").textContent = \`\${statistics.writeCacheOverload}%\`;
document.getElementById("ReadCacheOverload").textContent = \`\${statistics.readCacheOverload}%\`;
document.getElementById("QueuedIOJobs").textContent = statistics.queuedIOJobs;
document.getElementById("AverageTimeInQueue").textContent = \`\${statistics.averageTimeInQueue} ms\`;
document.getElementById("TotalQueuedSize").textContent = friendlyUnit(statistics.totalQueuedSize, false);`;
const legacyTitle='<a id="StatisticsLink">QBT_TR(&Statistics)QBT_TR[CONTEXT=MainWindow]</a>';
const modernTitle='<a id="StatisticsLink">QBT_TR(Statistics)QBT_TR[CONTEXT=MainWindow]</a>';
const oldUi=extractQbStatisticsUi({markupSource:markup,runtimeSource:oldRuntime,titleSource:modernTitle},'qB4 Statistics');
const modernUi=extractQbStatisticsUi({markupSource:markup,runtimeSource:modernRuntime,titleSource:modernTitle},'qB5 Statistics');
assert.deepEqual(modernUi,oldUi,'legacy client.js and modern statistics.js must resolve to one source-owned Statistics semantic surface');
assert.deepEqual(oldUi.title,{source:'Statistics',context:'MainWindow'});
assert.deepEqual(extractQbStatisticsUi({markupSource:markup,runtimeSource:oldRuntime,titleSource:legacyTitle},'qB4 mnemonic Statistics').title,{source:'&Statistics',context:'MainWindow'});
assert.deepEqual(oldUi.groups.map(group=>group.translation.source),['User statistics','Cache statistics','Performance statistics']);
const fields=oldUi.groups.flatMap(group=>group.fields);
assert.equal(fields.length,12);
assert.deepEqual(fields.map(field=>field.dataProperty),['alltime_ul','alltime_dl','global_ratio','total_wasted_session','total_peer_connections','read_cache_hits','total_buffers_size','write_cache_overload','read_cache_overload','queued_io_jobs','average_time_queue','total_queued_size']);
assert.deepEqual(fields.map(field=>field.format),['bytes','bytes','plain','bytes','plain','percent','bytes','percent','percent','plain','milliseconds','bytes']);
assert.equal(statisticsUiBindingCount(oldUi),15);
const refs=statisticsTranslationRefs(oldUi);assert.equal(Object.keys(refs).length,16);assert.deepEqual(refs['statistics.title'],{source:'Statistics',context:'MainWindow'});assert.deepEqual(refs['statistics.field.AlltimeUL'],{source:'All-time upload:',context:'StatsDialog'});
assert.deepEqual(validateQbStatisticsUi(oldUi,'roundtrip'),oldUi);
assert.throws(()=>extractQbStatisticsUi({markupSource:markup,runtimeSource:oldRuntime.replace(/\$\('QueuedIOJobs'\)[^\n]+/,''),titleSource:modernTitle},'broken'),/QueuedIOJobs render sink is unresolved/);
assert.throws(()=>extractQbStatisticsUi({markupSource:markup,runtimeSource:oldRuntime,titleSource:''},'missing title'),/Statistics title source\/context is unresolved/);
console.log('qB Statistics source contract passed: exact native groups/fields, server_state bindings, copy refs and formatting semantics converge across legacy and modern WebUI implementations.');
