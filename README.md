# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.2.0**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.x → current 5.x**, with capability-based forward compatibility.

## v0.2 highlights

- **Nebula Noir v2**: CSS starfield, stronger layered 3D surfaces, restrained edge glow and Light/Dark/System appearance.
- **Semantic Typography System**: all UI text maps to centralized roles; Standard / Large (+2px) / XLarge (+3px) scale globally. Large is the v0.2 default.
- **Independent density**: Compact / Standard / Comfortable is separate from font size.
- **20 / 50 / 100 / 200 server page sizes** with `limit` / `offset`.
- **Virtual DOM windowing**: a 200-item page does not mean 200 mounted Torrent rows. The same LargeList engine is used for large Detail/Log lists.
- **DataGrid v2**: sortable headers, resizable columns, column visibility/order settings and saved layout.
- **Mobile v2**: dedicated Torrent cards, Drawer navigation, touch-size controls and More/Action Sheet behavior instead of squeezing the desktop table.
- **Global library catalog** built in bounded API chunks for whole-library name/Tracker/save-path filtering without mounting whole-library DOM.
- **Tracker privacy normalization**: announce query/fragment credentials are removed before tracker display/filter keys. For example `https://tracker.example/announce?credential=...` is displayed as `https://tracker.example/announce`.
- **Private/PT filter**: exact API capability on newer qB versions; configurable Tracker-domain PT heuristic on older qB versions that do not expose a private flag.
- **Sidebar taxonomy**: Torrent state, Tracker, Save Path, Category and Tags (when supported).
- **Expanded Torrent actions**: start/resume, pause/stop, force start, recheck, reannounce, sequential download, first/last piece priority, auto management, queue top/bottom, rename, location, category, tags and per-Torrent speed limits where supported.
- **Torrent Detail**: Overview, Files with priority controls, Trackers with privacy-safe display and supported add/edit/remove operations, Peers and HTTP Sources.
- **Settings Center**: WeiG UI settings plus current qBittorrent Preferences grouped by Downloads / Connection / Speed / BitTorrent / Web UI / Advanced. Only preferences actually returned by the connected qB version are editable.
- **Search / RSS / Logs** capability-aware pages. Unsupported modules are hidden instead of presenting dead controls.
- **Keyboard controls**: `Ctrl/Cmd+F`, `Ctrl/Cmd+A`, `Delete`, `Escape` with touch-equivalent actions.
- **Back/Home/Reload recovery** remains a hard invariant.
- **Background-tab polling slowdown** and Reduced Motion support.

## Compatibility model

The UI does not scatter qB version checks through Feature code. Startup detects qBittorrent version + WebAPI version and creates a capability map.

Important compatibility bridges include:

```text
qB 4.x            qB 5.x
pause / resume  ↔ stop / start
paused filter   ↔ stopped filter
```

Historical WebAPI version anomalies are handled in the compatibility layer instead of Feature/UI code.

### Real regression labs

Two real environments are used as release-blocking targets during v0.2 stabilization:

```text
Lab A: qBittorrent 4.1.9.1 / WebAPI 2.2.1
Lab B: qBittorrent 5.2.0
```

Static CI passing does **not** mean every patch release between them is automatically certified; the capability matrix and real-instance regression continue to be validated as v0.2 is exercised.

## Tracker privacy

Tracker URLs may include passkeys or credentials. WeiG qB WebUI normalizes Tracker values before presenting them in the UI or using them as filter keys.

```text
https://tracker.m-team.cc/announce?credential=SECRET
→
https://tracker.m-team.cc/announce
```

Do not depend on the UI to preserve a secret Tracker query value for display. Raw qBittorrent Tracker operations still use the original API value internally when an edit/remove operation requires it.

## Performance model

Page size controls API/data navigation, not DOM count:

```text
qB API:       limit=200&offset=0
Data models:  up to 200 for that page
DOM:          viewport + overscan only
```

Whole-library taxonomy/search indexing is fetched in bounded chunks and never rendered as thousands of hidden rows. Developer counters such as cached models/rendered DOM live under **Settings → WeiG WebUI → Performance**, not the main dashboard.

## Manual installation

1. Download or clone this repository.
2. Use the repository's `webui` directory as the qBittorrent Alternate WebUI root.
3. In qBittorrent open **Tools → Preferences → Web UI**.
4. Enable **Use alternative WebUI**.
5. Set the WebUI root folder to the local/container-visible `webui` directory.
6. Restart qBittorrent or refresh the browser.

The configured value is a **local filesystem path**, not a GitHub URL.

## Linux installer

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh
sh /tmp/weigg-qb-install.sh
```

For a Docker qBittorrent whose `/config` bind mount is known:

```sh
sh /tmp/weigg-qb-install.sh \
  --config-root=/host/path/to/qbittorrent/config \
  --dir=/config/weigg-qb-webui
```

List qB Docker candidates:

```sh
sh /tmp/weigg-qb-install.sh --list-containers
```

When multiple qBittorrent containers are running, the installer **refuses to guess**. Choose one explicitly:

```sh
sh /tmp/weigg-qb-install.sh \
  --container=qbittorrent \
  --dir=/config/weigg-qb-webui
```

Optional safe config update:

```sh
sh /tmp/weigg-qb-install.sh --configure
```

Rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

The installer backs up before replacement, rejects Docker overlay/rootfs template configs, validates `public/login.html` + `private/index.html`, and remembers the last destination for rollback.

## Windows installer

```powershell
.\install.ps1
```

Optional automatic qB configuration:

```powershell
.\install.ps1 -Configure
```

Custom destination:

```powershell
.\install.ps1 -Destination "D:\qBittorrent\WeiG-qB-WebUI"
```

Rollback:

```powershell
.\install.ps1 -Mode Rollback
```

## Development

Runtime files remain plain HTML/CSS/JavaScript with no external runtime CDN/framework requirement.

```sh
npm test
```

Visual/UI changes must follow [`DESIGN.md`](./DESIGN.md). Engineering rules and compatibility/performance architecture are defined in [`docs/001.项目总方案.md`](./docs/001.%E9%A1%B9%E7%9B%AE%E6%80%BB%E6%96%B9%E6%A1%88.md).

## v0.2 stabilization status

`0.2.0` is the integrated v0.2 product baseline. Repository CI validates static product invariants, JavaScript syntax and installer safety. Final compatibility certification still requires exercising the updated UI against both real Lab A (4.1.9.1) and Lab B (5.2.0) and fixing any behavior revealed by those live APIs.
