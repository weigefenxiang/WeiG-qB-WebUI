import {extractTorrentFilters,extractTorrentInfoParameters} from './qb-torrent-surface-parsers.mjs';
import {extractTorrentInfoFields,extractTorrentStates,extractTorrentTableColumns} from './qb-torrent-fields-parser.mjs';
import {extractTorrentDetailSurfaces,extractTorrentDetailUi} from './qb-detail-surface-parsers.mjs';
import {extractDetailContextMenus,extractFilePriorityControl,extractTorrentContextMenu} from './qb-detail-control-parsers.mjs';
import {enrichTorrentFileColumnProvenance} from './qb-release-catalog-detail-provenance.mjs';
import {extractTrackerFacetMode,extractTrackerFilterFacts} from './qb-tracker-filter-source.mjs';

export function extractQbReleaseTorrentSurface({ref='',apiActions=[],readSource,readOptionalSource,readFirstSource}={}){
  const context=String(ref||'qB release');
  if(typeof readSource!=='function'||typeof readOptionalSource!=='function'||typeof readFirstSource!=='function')throw new Error(`${context}: Torrent release surface extractor requires exact source readers`);
  const torrentsControllerSource=readSource('src/webui/api/torrentscontroller.cpp');
  const torrentFilterSource=readSource('src/base/torrentfilter.cpp');
  const serializerSource=readSource('src/webui/api/serialize/serialize_torrent.cpp');
  const serializerHeaderSource=readSource('src/webui/api/serialize/serialize_torrent.h');
  const dynamicTableSource=readSource('src/webui/www/private/scripts/dynamicTable.js');
  const clientSource=readOptionalSource('src/webui/www/private/scripts/client.js');
  const torrentTableColumns=extractTorrentTableColumns(dynamicTableSource,context);
  if(!torrentTableColumns.length)throw new Error(`${context}: native Torrent table column surface is unresolved`);

  const propertiesToolbarSource=readFirstSource(['src/webui/www/private/views/propertiesToolbar.html','src/webui/www/private/properties.html']);
  const propertiesContentSource=readFirstSource(['src/webui/www/private/views/properties.html','src/webui/www/private/properties_content.html']);
  const propertiesGeneralSource=readOptionalSource('src/webui/www/private/scripts/prop-general.js');
  if(!propertiesToolbarSource||!propertiesContentSource||!propertiesGeneralSource)throw new Error(`${context}: Torrent detail source markup/script is unresolved`);

  const propFilesSource=readOptionalSource('src/webui/www/private/scripts/prop-files.js');
  const torrentContentSource=readOptionalSource('src/webui/www/private/scripts/torrent-content.js');
  const fileTreeSource=readOptionalSource('src/webui/www/private/scripts/file-tree.js');
  const trackerSource=readOptionalSource('src/webui/www/private/scripts/prop-trackers.js');
  const peerSource=readOptionalSource('src/webui/www/private/scripts/prop-peers.js');
  const menuSource=readOptionalSource('src/webui/www/private/index.html');
  const fileProjectionSource=[propFilesSource,torrentContentSource,fileTreeSource].filter(Boolean).join('\n');

  const detailSurfaces=extractTorrentDetailSurfaces(torrentsControllerSource,context,serializerHeaderSource);
  const torrentDetailUi=extractTorrentDetailUi({
    toolbarSource:propertiesToolbarSource,
    contentSource:propertiesContentSource,
    generalSource:propertiesGeneralSource,
    dynamicTableSource,
    legacyFilesSource:propFilesSource,
    legacyTrackersSource:trackerSource,
    legacyWebseedsSource:readOptionalSource('src/webui/www/private/scripts/prop-webseeds.js')
  },context);
  torrentDetailUi.tables.files=enrichTorrentFileColumnProvenance(torrentDetailUi.tables.files,fileProjectionSource,detailSurfaces.torrentFileFields,context);

  const filePriorityControl=extractFilePriorityControl({filesSource:torrentContentSource||propFilesSource,fileTreeSource},context);
  if(filePriorityControl)torrentDetailUi.controls={...(torrentDetailUi.controls||{}),filePriority:filePriorityControl};

  const torrentContextMenu=extractTorrentContextMenu({menuSource,clientSource,apiActions},context);
  const contextMenus=extractDetailContextMenus({
    menuSource,
    trackerSource,
    peerSource,
    dialogSources:{
      'addtrackers.html':readOptionalSource('src/webui/www/private/addtrackers.html'),
      'edittracker.html':readOptionalSource('src/webui/www/private/edittracker.html'),
      'addpeers.html':readOptionalSource('src/webui/www/private/addpeers.html')
    },
    apiActions
  },context);
  if(Object.keys(contextMenus).length)torrentDetailUi.contextMenus=contextMenus;

  return{
    torrentFilters:extractTorrentFilters({torrentFilterSource,torrentsControllerSource},context),
    torrentInfoParameters:extractTorrentInfoParameters(torrentsControllerSource,context),
    torrentInfoFields:extractTorrentInfoFields({headerSource:serializerHeaderSource,serializerSource},context),
    trackerFilters:extractTrackerFilterFacts(clientSource,context),
    trackerFacetMode:extractTrackerFacetMode(clientSource),
    torrentStates:extractTorrentStates(serializerSource,context),
    torrentTableColumns,
    torrentContextMenu,
    torrentDetailUi,
    ...detailSurfaces
  };
}
