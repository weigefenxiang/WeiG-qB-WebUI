# WeiG qB WebUI

A premium, modular and high-performance alternate WebUI for qBittorrent.

Current version: **0.1.0**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.9 → current 5.x**

## What is implemented

- Nebula Noir dark UI with CSS starfield, layered 3D surfaces and restrained hover glow.
- Light/Dark switching with no external CDN or runtime framework.
- Responsive desktop/tablet/mobile layouts; mobile uses compact torrent cards, drawer navigation and touch-size controls.
- qBittorrent version/WebAPI detection and compatibility routing.
- qBittorrent 4.x `pause/resume` and 5.x `stop/start` compatibility with endpoint fallback.
- qBittorrent 4.x `paused` and 5.x `stopped` filter compatibility.
- Torrent list with server-side `limit=50` / `offset` paging to keep the main DOM bounded.
- Torrent filtering and current-batch name search.
- Add torrent by Magnet/URL or `.torrent` file.
- Start, pause/stop and delete selected torrents, with optional data deletion confirmation.
- Torrent details: overview, files, trackers and peers.
- Files/trackers/peers use a virtual-window renderer so large child lists do not create one DOM node per item.
- Reliable Back/Home/Reload recovery paths.
- Reduced-motion support and background-tab polling slowdown.
- Linux and Windows installers with backup, optional qBittorrent config update and rollback.
- Zero-dependency smoke/JS syntax CI.

## Manual installation

1. Download or clone this repository.
2. Use the repository's `webui` directory as the qBittorrent Alternate WebUI root.
3. In qBittorrent open **Tools → Preferences → Web UI**.
4. Enable **Use alternative WebUI**.
5. Set the WebUI root folder to the local `webui` directory.
6. Restart qBittorrent or refresh the browser.

The configured value is a **local filesystem path**, not a GitHub URL.

## Linux installer

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh | sh
```

Default destination:

```text
~/.local/share/weigg-qb-webui
```

To also update a detected qBittorrent config:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh
sh /tmp/weigg-qb-install.sh --configure
```

Custom path:

```sh
sh /tmp/weigg-qb-install.sh --dir=/config/weigg-qb-webui
```

Rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

## Windows installer

Run PowerShell, download `installers/install.ps1`, then:

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

## Performance rules

The main torrent list requests at most **50 torrents per batch**. Loading more data must never mean mounting thousands of torrent rows at once. Large detail lists use viewport windowing and overscan.

## Development

Runtime files are plain HTML/CSS/JavaScript/SVG. Node.js is used only for repository checks.

```sh
npm test
```

Visual/UI work must follow [`DESIGN.md`](./DESIGN.md). Engineering architecture is defined in [`docs/001.项目总方案.md`](./docs/001.%E9%A1%B9%E7%9B%AE%E6%80%BB%E6%96%B9%E6%A1%88.md).

## Status

`0.1.0` is the first working product baseline. Static smoke tests are automated; real qBittorrent version-matrix testing should continue against representative 4.1.x–5.x instances before calling every patch release certified.
