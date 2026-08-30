# WeiG qB WebUI

A premium, modular and high-performance alternate WebUI for qBittorrent, with qBittorrent 4.1.9 as the compatibility floor and first-class desktop/mobile support.

> Project status: architecture and design baseline.

## Core principles

- qBittorrent 4.1.9 is the release-blocking compatibility floor; 4.2.x–4.6.x are progressively enhanced through a compatibility layer.
- Mobile is a first-class platform, not a compressed desktop layout.
- Large torrent libraries use server-side batching (default 50), caching and DOM windowing/virtualization.
- UI primitives are standardized and reusable; feature code must not create ad-hoc buttons, tooltips, dialogs or visual tokens.
- Every non-home view must have a reliable Back path and recovery path.
- Distribution targets GitHub Releases with Linux/Windows installers, manual deployment, backup, update and rollback.
- Visual design is governed by [`DESIGN.md`](./DESIGN.md).
- Engineering architecture, phases and release gates are governed by [`docs/001.项目总方案.md`](./docs/001.%E9%A1%B9%E7%9B%AE%E6%80%BB%E6%96%B9%E6%A1%88.md).

## Planned runtime stack

The production WebUI is static HTML/CSS/JavaScript/SVG and must not require Node.js, Vue, React, a CDN, or a server-side framework at runtime.

## License

License will be finalized before the first public release.
