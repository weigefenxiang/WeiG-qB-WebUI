import assert from 'node:assert/strict';
import {assertRssSurfaceBindings,extractRssDownloaderSurface,rssSurfaceTranslationRefs} from '../tools/qb-rss-surface-source.mjs';

const absent=extractRssDownloaderSurface('<div>No RSS downloader in this release</div>');
assert.equal(absent.available,false,'releases without native RSS Downloader source must not acquire a synthetic native surface');
assert.deepEqual(absent.fields,[]);

const v43=`
<div id="RssDownloader">
<style>#rssDownloaderFeeds { height: 10px; }</style>
<fieldset id="ruleSettings"><legend>QBT_TR(Rule Definition)QBT_TR[CONTEXT=AutomatedRssDownloader]</legend>
<label for="useRegEx">QBT_TR(Use Regular Expressions)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="useRegEx" type="checkbox">
<label for="mustContainText">QBT_TR(Must Contain:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="mustContainText">
<label for="mustNotContainText">QBT_TR(Must Not Contain:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="mustNotContainText">
<label for="episodeFilterText">QBT_TR(Episode Filter:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="episodeFilterText">
<label for="useSmartFilter">QBT_TR(Use Smart Episode Filter)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="useSmartFilter" type="checkbox">
<label>QBT_TR(Assign Category:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><select id="assignCategoryCombobox"><option value=""></option></select>
<label for="saveToText">QBT_TR(Save to:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="saveToText">
<label for="ignoreDaysValue">QBT_TR(Ignore Subsequent Matches for (0 to Disable))QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="ignoreDaysValue" type="number" min="0">
<label>QBT_TR(Add Paused:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><select id="addPausedCombobox"><option value="default">QBT_TR(Use global settings)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="always">QBT_TR(Always)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="never">QBT_TR(Never)QBT_TR[CONTEXT=AutomatedRssDownloader]</option></select>
<label>QBT_TR(Create Subfolder:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><select id="creatSubfolderCombobox"><option value="default">QBT_TR(Use global settings)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="always">QBT_TR(Always)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="never">QBT_TR(Never)QBT_TR[CONTEXT=AutomatedRssDownloader]</option></select>
</fieldset>
<fieldset id="rssDownloaderFeeds"><legend>QBT_TR(Apply Rule to Feeds:)QBT_TR[CONTEXT=AutomatedRssDownloader]</legend></fieldset>
<b id="rulesTableDesc">QBT_TR(Download Rules)QBT_TR[CONTEXT=AutomatedRssDownloader]</b>
<b id="articleTableDesc">QBT_TR(Matching RSS Articles)QBT_TR[CONTEXT=AutomatedRssDownloader]</b>
<button id="saveButton">QBT_TR(Save)QBT_TR[CONTEXT=HttpServer]</button>
<script>
rulesList[rule].useRegex = true;
rulesList[rule].mustContain = '';
rulesList[rule].mustNotContain = '';
rulesList[rule].episodeFilter = '';
rulesList[rule].smartFilter = true;
rulesList[rule].assignedCategory = '';
rulesList[rule].savePath = '';
rulesList[rule].ignoreDays = 0;
switch ($('addPausedCombobox').value) { case 'default': rulesList[rule].addPaused = null; break; case 'always': rulesList[rule].addPaused = true; break; case 'never': rulesList[rule].addPaused = false; break; }
switch ($('creatSubfolderCombobox').value) { case 'default': rulesList[rule].createSubfolder = null; break; case 'always': rulesList[rule].createSubfolder = true; break; case 'never': rulesList[rule].createSubfolder = false; break; }
rulesList[rule].affectedFeeds = rssDownloaderFeedSelectionTable.rows;
</script></div>`;
const oldSurface=assertRssSurfaceBindings(extractRssDownloaderSurface(v43),'4.3-style RSS');
assert.equal(oldSurface.available,true);
assert.deepEqual(oldSurface.fields.map(x=>x.key),['useRegex','mustContain','mustNotContain','episodeFilter','smartFilter','category','savePath','ignoreDays','stopped','subfolder','affectedFeeds']);
assert.deepEqual(oldSurface.fields.find(x=>x.key==='stopped').path,['rule','addPaused']);
assert.deepEqual(oldSurface.fields.find(x=>x.key==='subfolder').path,['rule','createSubfolder']);
assert.deepEqual(oldSurface.fields.find(x=>x.key==='stopped').options.map(x=>x.value),['default','always','never']);
assert.deepEqual(oldSurface.fields.find(x=>x.key==='stopped').options.map(x=>x.writeValue),[null,true,false]);
assert.deepEqual(oldSurface.fields.find(x=>x.key==='subfolder').options.map(x=>x.writeValue),[null,true,false]);
assert.equal(oldSurface.fields.findIndex(x=>x.key==='affectedFeeds'),oldSurface.fields.length-1,'CSS selectors must not steal native DOM field order');
assert.equal(oldSurface.fields.find(x=>x.key==='smartFilter').translation.source,'Use Smart Episode Filter');
assert.equal(oldSurface.copy.save.context,'HttpServer');

const modern=`
<div id="RssDownloader"><fieldset id="ruleSettings"><legend>QBT_TR(Rule Definition)QBT_TR[CONTEXT=AutomatedRssDownloader]</legend>
<label for="useRegEx">QBT_TR(Use Regular Expressions)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="useRegEx">
<label for="mustContainText">QBT_TR(Must Contain:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="mustContainText">
<label for="mustNotContainText">QBT_TR(Must Not Contain:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="mustNotContainText">
<label for="episodeFilterText">QBT_TR(Episode Filter:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="episodeFilterText">
<label for="useSmartFilter">QBT_TR(Use Smart Episode Filter)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="useSmartFilter">
<label>QBT_TR(Assign Category:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><select id="assignCategoryCombobox"><option value=""></option></select>
<label>QBT_TR(Add Tags:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="ruleAddTags">
<label for="saveToText">QBT_TR(Save to:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="saveToText">
<label for="ignoreDaysValue">QBT_TR(Ignore Subsequent Matches for (0 to Disable))QBT_TR[CONTEXT=AutomatedRssDownloader]</label><input id="ignoreDaysValue" min="0">
<label>QBT_TR(Add Stopped:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><select id="addStoppedCombobox"><option value="default">QBT_TR(Use global settings)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="always">QBT_TR(Always)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="never">QBT_TR(Never)QBT_TR[CONTEXT=AutomatedRssDownloader]</option></select>
<label>QBT_TR(Torrent content layout:)QBT_TR[CONTEXT=AutomatedRssDownloader]</label><select id="contentLayoutCombobox"><option value="Default">QBT_TR(Use global settings)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="Original">QBT_TR(Original)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="Subfolder">QBT_TR(Create subfolder)QBT_TR[CONTEXT=AutomatedRssDownloader]</option><option value="NoSubfolder">QBT_TR(Don't create subfolder)QBT_TR[CONTEXT=AutomatedRssDownloader]</option></select>
</fieldset><fieldset id="rssDownloaderFeeds"><legend>QBT_TR(Apply Rule to Feeds:)QBT_TR[CONTEXT=AutomatedRssDownloader]</legend></fieldset>
<script>
rulesList[rule].useRegex = true; rulesList[rule].mustContain = ''; rulesList[rule].mustNotContain = ''; rulesList[rule].episodeFilter = ''; rulesList[rule].smartFilter = true; rulesList[rule].ignoreDays = 0; rulesList[rule].affectedFeeds = rssDownloaderFeedSelectionTable.rows;
rulesList[rule].torrentParams.category = ''; rulesList[rule].torrentParams.tags = []; rulesList[rule].torrentParams.save_path = '';
switch (document.getElementById('addStoppedCombobox').value) { case 'default': rulesList[rule].torrentParams.stopped = null; break; case 'always': rulesList[rule].torrentParams.stopped = true; break; case 'never': rulesList[rule].torrentParams.stopped = false; break; }
switch (document.getElementById('contentLayoutCombobox').value) { case 'Default': rulesList[rule].torrentParams.content_layout = null; break; case 'Original': rulesList[rule].torrentParams.content_layout = 'Original'; break; case 'Subfolder': rulesList[rule].torrentParams.content_layout = 'Subfolder'; break; case 'NoSubfolder': rulesList[rule].torrentParams.content_layout = 'NoSubfolder'; break; }
</script></div>`;
const modernSurface=assertRssSurfaceBindings(extractRssDownloaderSurface(modern),'modern RSS');
assert.deepEqual(modernSurface.fields.map(x=>x.key),['useRegex','mustContain','mustNotContain','episodeFilter','smartFilter','category','tags','savePath','ignoreDays','stopped','layout','affectedFeeds']);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='category').path,['torrentParams','category']);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='tags').path,['torrentParams','tags']);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='stopped').path,['torrentParams','stopped']);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='layout').path,['torrentParams','content_layout']);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='stopped').options.map(x=>x.writeValue),[null,true,false]);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='layout').options.map(x=>x.value),['Default','Original','Subfolder','NoSubfolder']);
assert.deepEqual(modernSurface.fields.find(x=>x.key==='layout').options.map(x=>x.writeValue),[null,'Original','Subfolder','NoSubfolder']);
assert.equal(modernSurface.fields.findIndex(x=>x.key==='affectedFeeds'),modernSurface.fields.length-1);
const refs=rssSurfaceTranslationRefs(modernSurface);
assert.ok(refs.some(x=>x.source==='Use Smart Episode Filter'&&x.context==='AutomatedRssDownloader'));
assert.ok(refs.some(x=>x.source==='Use global settings'&&x.context==='AutomatedRssDownloader'));

console.log('qB RSS source contract passed: absence stays absent; native DOM field order, source write values, translation refs, tri-state semantics, and historical/modern rule bindings are extracted from source without qB version guesses.');
