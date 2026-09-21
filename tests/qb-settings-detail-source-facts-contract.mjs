import assert from 'node:assert/strict';
import {detailUiBindingCount,validateDetailUi} from '../tools/qb-settings-translation-lkg.mjs';

const ref=(source,context)=>({source,context});
const detailUi={
  tabs:{overview:ref('General','PropTabBar'),trackers:ref('Trackers','PropTabBar'),peers:ref('Peers','PropTabBar'),webseeds:ref('HTTP Sources','PropTabBar'),files:ref('Content','PropTabBar')},
  tabOrder:['overview','trackers','peers','webseeds','files'],
  propertyGroups:{transfer:ref('Transfer','PropertiesWidget')},
  propertyLabels:{eta:ref('ETA:','PropertiesWidget')},
  propertyLayout:[{key:'transfer',translation:ref('Transfer','PropertiesWidget'),fields:[{id:'eta',valueSource:'properties',dataProperties:['eta']}]}],
  tables:{
    files:[{key:'name',caption:'Name',defaultWidth:300,defaultVisible:true,translation:ref('Name','TrackerListWidget'),dataProperties:['name']}],
    trackers:[{key:'url',caption:'URL',defaultWidth:250,defaultVisible:true,translation:ref('URL','TrackerListWidget'),dataProperties:['url']}],
    peers:[{key:'ip',caption:'IP',defaultWidth:100,defaultVisible:true,translation:ref('IP','PeerListWidget'),dataProperties:['ip']}],
    webseeds:[{key:'url',caption:'URL',defaultWidth:500,defaultVisible:true,translation:ref('URL','HttpServer'),dataProperties:['url']}]
  },
  controls:{filePriority:{valueType:'integer',options:[{value:'0',translation:ref('Do not download','PropListDelegate')},{value:'1',translation:ref('Normal','PropListDelegate')}],sourceKind:'upstream-createPriorityCombo'}},
  contextMenus:{
    trackers:[{id:'EditTracker',translation:ref('Edit tracker URL...','TrackerListWidget'),endpoint:'torrents/editTracker',sourceAction:'torrentscontroller.h:editTrackerAction',availability:{minSelection:1,maxSelection:1,excludedPrefixes:['** [','endpoint|']}}],
    peers:[{id:'banPeer',translation:ref('Ban peer permanently','PeerListWidget'),endpoint:'transfer/banPeers',sourceAction:'transfercontroller.h:banPeersAction',availability:{minSelection:1}}]
  }
};

const normalized=validateDetailUi(detailUi,'5.2.0 synthetic');
assert.deepEqual(normalized,detailUi,'Settings/source LKG must preserve exact tab order, source-derived controls and Tracker/Peer context-menu facts instead of dropping them at the freeze boundary');
assert.equal(detailUiBindingCount(normalized),16,'Detail binding accounting must include source-derived control options and context-menu actions without double-counting tab order');

const duplicateTab=structuredClone(detailUi);duplicateTab.tabOrder[4]='overview';
assert.throws(()=>validateDetailUi(duplicateTab,'duplicate tab synthetic'),/tab order contains empty or duplicate keys/,'duplicate source tab order must fail closed');
const missingTab=structuredClone(detailUi);missingTab.tabOrder.pop();
assert.throws(()=>validateDetailUi(missingTab,'missing tab synthetic'),/tab order is missing or incomplete/,'incomplete source tab order must fail closed');
const duplicateOption=structuredClone(detailUi);duplicateOption.controls.filePriority.options.push(structuredClone(duplicateOption.controls.filePriority.options[0]));
assert.throws(()=>validateDetailUi(duplicateOption,'duplicate option synthetic'),/duplicate option value/,'duplicate source control choices must fail closed');
const unsupportedAvailability=structuredClone(detailUi);unsupportedAvailability.contextMenus.peers[0].availability.selectedRows=true;
assert.throws(()=>validateDetailUi(unsupportedAvailability,'unsupported availability synthetic'),/unsupported availability fact selectedRows/,'unknown action-availability semantics must fail closed rather than silently crossing the LKG boundary');
const unsupportedMenuFact=structuredClone(detailUi);unsupportedMenuFact.contextMenus.peers[0].parameters=['ip'];
assert.throws(()=>validateDetailUi(unsupportedMenuFact,'unsupported menu synthetic'),/unsupported context-menu fact parameters/,'new unowned context-menu descriptor semantics must stop at the provenance boundary until the canonical owner validates them');

console.log('qB Settings Detail source-facts contract passed: exact tab order, controls/options and Tracker/Peer context-menu provenance survive the LKG boundary, contribute to binding evidence, and unknown semantics fail closed.');
