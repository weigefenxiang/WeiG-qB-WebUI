export const qbClientTestI18n=Object.freeze({
  getLocale:()=> 'en-US',
  t:key=>({
    'api.contractUnavailable':'The qBittorrent compatibility contract is unavailable.',
    'api.actionUnproven':'This API action is not source-proven for the current qBittorrent release.',
    'api.torrentRejected':'qBittorrent did not accept the torrent.',
    'api.categoriesUnexpected':'The Categories API returned an unexpected response.',
    'api.writeBlocked':'This write is not source-proven for the current qBittorrent release.',
    'api.sessionExpired':'Session expired. Please sign in again.',
    'api.parseFailed':'The API returned data that could not be parsed.',
    'api.filterUnsupported':'This torrent filter is not supported by the current qBittorrent release.',
    'api.settingsOptionProviderUnproven':'The Settings option provider is not source-proven.',
    'api.settingsOptionEndpointInvalid':'The Settings option endpoint is invalid.',
    'api.settingsOptionQueryInvalid':'The Settings option query parameter is invalid.',
    'api.settingsOptionUnexpected':'The Settings option API returned an unexpected response.',
    'api.settingsOptionShapeUnsupported':'The Settings option response shape is unsupported.',
    'api.torrentActionUnsupported':'This torrent action is not supported by the current qBittorrent release.',
    'api.editTrackerHashMissing':'The current editTracker source contract does not expose the hash parameter.',
    'api.editTrackerUrlMissing':'The current editTracker source contract does not expose a supported tracker URL parameter.',
    'api.editTrackerEditUnproven':'The current editTracker source contract cannot prove URL editing.',
    'api.editTrackerParameterUnsupported':'The current editTracker source contract requires a parameter this client cannot provide.',
    'api.peersUnexpected':'The Torrent Peers API returned an unexpected response.'
  }[String(key||'')]||String(key||''))
});
