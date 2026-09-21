import assert from 'node:assert/strict';
import {assertRssSurfaceBindings,extractRssDownloaderGuiSurface,extractRssDownloaderSurface,rssSurfaceTranslationRefs} from '../tools/qb-rss-surface-source.mjs';


const guiUi='<ui><class>AutomatedRssDownloader</class><widget class="QToolButton" name="removeRuleBtn"></widget><widget class="QToolButton" name="addRuleBtn"></widget><widget class="QListWidget" name="listRules"></widget><widget class="QCheckBox" name="checkRegex"><property name="text"><string>Use Regular Expressions</string></property></widget><widget class="QLabel" name="label_4"><property name="text"><string>Must Contain:</string></property></widget><widget class="QLineEdit" name="lineContains"></widget><widget class="QLabel" name="label_5"><property name="text"><string>Must Not Contain:</string></property></widget><widget class="QLineEdit" name="lineNotContains"></widget><widget class="QLabel" name="lblEFilter"><property name="text"><string>Episode Filter:</string></property></widget><widget class="QLineEdit" name="lineEFilter"></widget><widget class="QCheckBox" name="checkSmart"><property name="text"><string>Use Smart Episode Filter</string></property></widget><widget class="QLabel" name="label_7"><property name="text"><string>Assign Category:</string></property></widget><widget class="QComboBox" name="comboCategory"></widget><widget class="QLabel" name="label_6"><property name="text"><string>Save to:</string></property></widget><widget class="QLineEdit" name="lineSavePath"></widget><widget class="QLabel" name="lblIgnoreDays"><property name="text"><string>Ignore Subsequent Matches for (0 to Disable)</string></property></widget><widget class="QSpinBox" name="spinIgnorePeriod"><property name="minimum"><number>0</number></property></widget><widget class="QLabel" name="lblAddPaused"><property name="text"><string>Add Paused:</string></property></widget><widget class="QComboBox" name="comboAddPaused"><item><property name="text"><string>Use global settings</string></property></item><item><property name="text"><string>Always</string></property></item><item><property name="text"><string>Never</string></property></item></widget><widget class="QLabel" name="lblListFeeds"><property name="text"><string>Apply Rule to Feeds:</string></property></widget><widget class="QListWidget" name="listFeeds"></widget><widget class="QLabel" name="label"><property name="text"><string>Download Rules</string></property></widget><widget class="QGroupBox" name="ruleDefBox"><property name="title"><string>Rule Definition</string></property></widget><widget class="QLabel" name="label_3"><property name="text"><string>Matching RSS Articles</string></property></widget></ui>';
const guiRule='const QString Str_UseRegex(QStringLiteral("useRegex")); const QString Str_MustContain(QStringLiteral("mustContain")); const QString Str_MustNotContain(QStringLiteral("mustNotContain")); const QString Str_EpisodeFilter(QStringLiteral("episodeFilter")); const QString Str_AffectedFeeds(QStringLiteral("affectedFeeds")); const QString Str_SavePath(QStringLiteral("savePath")); const QString Str_AssignedCategory(QStringLiteral("assignedCategory")); const QString Str_IgnoreDays(QStringLiteral("ignoreDays")); const QString Str_AddPaused(QStringLiteral("addPaused")); const QString Str_SmartFilter(QStringLiteral("smartFilter")); QJsonValue triStateBoolToJsonValue(const TriStateBool &v){ switch(static_cast<int>(v)){ case 0: return false; case 1: return true; default: return QJsonValue(); }}';
const guiApi='void RSSController::setRuleAction(){} void RSSController::rulesAction(){}';
const guiSurface=assertRssSurfaceBindings(extractRssDownloaderGuiSurface(guiUi,guiRule,guiApi),'4.1 GUI/API RSS');
assert.equal(guiSurface.available,true);
assert.deepEqual(guiSurface.collection,{listControlId:'listRules',addControlId:'addRuleBtn',removeControlId:'removeRuleBtn'});
assert.deepEqual(guiSurface.fields.map(x=>x.key),['useRegex','mustContain','mustNotContain','episodeFilter','smartFilter','category','savePath','ignoreDays','stopped','affectedFeeds']);
assert.deepEqual(guiSurface.fields.find(x=>x.key==='stopped').options.map(x=>x.writeValue),[null,true,false]);
assert.equal(guiSurface.source,'qb-upstream-rss-downloader-gui-api');
const guiRule42=guiRule.replace('switch(static_cast<int>(v)){ case 0: return false; case 1: return true; default: return QJsonValue(); }','switch(static_cast<signed char>(v)){ case 0: return false; case 1: return true; default: return {}; }');
const guiSurface42=assertRssSurfaceBindings(extractRssDownloaderGuiSurface(guiUi,guiRule42,guiApi),'4.2 GUI/API RSS');
assert.equal(guiSurface42.available,true,'qB 4.2 TriStateBool source syntax using signed-char + return {} must remain equivalent to the 4.1 JSON-null projection');
assert.deepEqual(guiSurface42.fields.find(x=>x.key==='stopped').options.map(x=>x.writeValue),[null,true,false]);

const absent=extractRssDownloaderSurface('<div>No RSS downloader in this release</div>');
assert.equal(absent.available,false,'releases without native RSS Downloader source must not acquire a synthetic native surface');
assert.deepEqual(absent.fields,[]);

const v43=`
<div id="RssDownloader"><div id="rulesTable"></div><button id="newRuleButton"></button><button id="deleteRuleButton"></button>
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
assert.deepEqual(oldSurface.collection,{listControlId:'rulesTable',addControlId:'newRuleButton',removeControlId:'deleteRuleButton'});
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
<div id="RssDownloader"><div id="rulesTable"></div><button id="newRuleButton"></button><button id="deleteRuleButton"></button><fieldset id="ruleSettings"><legend>QBT_TR(Rule Definition)QBT_TR[CONTEXT=AutomatedRssDownloader]</legend>
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
assert.deepEqual(modernSurface.collection,{listControlId:'rulesTable',addControlId:'newRuleButton',removeControlId:'deleteRuleButton'});
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


const disabledSurface=extractRssDownloaderSurface('<div id="RssDownloader"><div id="rssDownloaderDisabled" class="invisible">QBT_TR(Auto downloading of RSS torrents is disabled now! You can enable it in application settings.)QBT_TR[CONTEXT=AutomatedRssDownloader]</div></div>');
assert.deepEqual(disabledSurface.copy.disabled,{source:'Auto downloading of RSS torrents is disabled now! You can enable it in application settings.',context:'AutomatedRssDownloader'},'RSS Downloader disabled feedback must stay source-owned and context-exact');
assert.ok(rssSurfaceTranslationRefs(disabledSurface).some(x=>x.source==='Auto downloading of RSS torrents is disabled now! You can enable it in application settings.'&&x.context==='AutomatedRssDownloader'));
console.log('qB RSS source contract passed: absence stays absent; qB4 tri-state syntax variants, native DOM field order, source write values, translation refs, and historical/modern rule bindings are extracted from source without qB version guesses.');
