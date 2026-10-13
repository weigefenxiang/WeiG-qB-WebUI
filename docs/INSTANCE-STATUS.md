# A76: Optional shared instance status collector (host-only)

The normal WeiG WebUI is static and does not receive other qBittorrent cookies. For near-real-time multi-instance status **without a gateway**, an administrator can explicitly install the one-shot host collector. No service is started or qB configuration changed by installing the WebUI.

## Required layout

- The host has one WebUI root, e.g. `/root/weig-qb-webui`, bind-mounted read-only by the qB containers.
- The host can write `/root/weig-qb-webui/private/weig-instance-status.json`; qB serves that file only to authenticated users.
- The collector can reach every qB WebAPI, via an HTTPS hostname or a host-local `probeUrl`. **The public `url` must exactly match each instance's canonical address saved in the WeiG instance list.**
- Node.js **22+** and a systemd host are available for the example timer. The collector does not require npm dependencies.
- When qB and browser addresses differ, `probeUrl` is used for the host's requests only. Credentials must not be sent over untrusted HTTP networks.

## One-time installation (administrator opt-in)

Update/install the **same A76 Dev SHA** in the shared WebUI folder first. Copy the collector outside the web-served directory:

```bash
install -d -m 700 /etc/weig-qb-webui /var/lib/weig-qb-webui /opt/weig-qb-webui
SHA="$(cat /root/weig-qb-webui/GIT_SHA)"
curl -fsSL "https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/${SHA}/tools/instance-status-collector.mjs" \
  -o /opt/weig-qb-webui/instance-status-collector.mjs
chmod 644 /opt/weig-qb-webui/instance-status-collector.mjs
install -m 600 /dev/null /etc/weig-qb-webui/instances.json
```

Edit `/etc/weig-qb-webui/instances.json` privately (for example, `sudoedit`). Example only; enter your own usernames/passwords and reachable addresses:

```json
{
  "schemaVersion": 1,
  "instances": [
    {
      "url": "https://qb-one.example.com/",
      "probeUrl": "http://127.0.0.1:18080/",
      "username": "admin",
      "password": "REPLACE_WITH_PASSWORD"
    },
    {
      "url": "https://qb-two.example.com/",
      "probeUrl": "http://127.0.0.1:13443/",
      "username": "admin",
      "password": "REPLACE_WITH_PASSWORD"
    }
  ]
}
```

The optional `probeUrl` defaults to `url`; it is useful when a server cannot resolve or hairpin its own external HTTPS domain. Never put real passwords or the private session-cache file under `webui/public` or `webui/private`.

Run once before scheduling (replace `/usr/bin/node` if `command -v node` reports another path):

```bash
/usr/bin/node /opt/weig-qb-webui/instance-status-collector.mjs \
  --config=/etc/weig-qb-webui/instances.json \
  --output=/root/weig-qb-webui/private/weig-instance-status.json \
  --sessions=/var/lib/weig-qb-webui/sessions.json
```

The optional private `--sessions` file caches only qB SID cookies **outside** the WebUI so that a 30-second timer doesn't create a new login session on every run. Both the credentials file and SID cache require mode 0600 and root-only directory access. Cookies are never published in the WebUI JSON.

## Optional periodic refresh with systemd

Use the actual absolute path printed by `command -v node` for `ExecStart`.

`/etc/systemd/system/weig-instance-status.service`:

```ini
[Unit]
Description=WeiG qB multi-instance status snapshot

[Service]
Type=oneshot
User=root
ExecStart=/usr/bin/node /opt/weig-qb-webui/instance-status-collector.mjs --config=/etc/weig-qb-webui/instances.json --output=/root/weig-qb-webui/private/weig-instance-status.json --sessions=/var/lib/weig-qb-webui/sessions.json
```

`/etc/systemd/system/weig-instance-status.timer`:

```ini
[Unit]
Description=Refresh WeiG instance status periodically

[Timer]
OnBootSec=30s
OnUnitInactiveSec=30s
AccuracySec=1s
Unit=weig-instance-status.service

[Install]
WantedBy=timers.target
```

Enable **only after** checking the first manual run:

```bash
systemctl daemon-reload
systemctl enable --now weig-instance-status.timer
systemctl list-timers weig-instance-status.timer
journalctl -u weig-instance-status.service -n 25 --no-pager
```

The collector is a **one-shot** task, not an HTTP gateway or continuously running service. The interval includes command execution time. The WebUI reads this snapshot via its own logged-in HTTPS origin and rejects snapshots older than 90 seconds. A missing, expired, malformed or inaccessible feed means **unverified**, never fabricated offline or zero.

## Troubleshooting / safety

- Open the browser's Network panel on an authenticated WeiG page and check `weig-instance-status.json` is HTTP 200. Anonymous access must **not** return its content.
- Check that `instances[].url` matches the exact canonical URLs saved in the sidebar (scheme, hostname, port and root path).
- Check the host can reach each `probeUrl`; `probeUrl` alone is not a public identity and is not transferred to browsers.
- Check the shared host root is a **regular writable directory** for the collector, while each qB container keeps its bind mount **read-only**.
- A different machine requires its own deployment or an explicitly authorized file distribution mechanism; sharing an HTML/JS release does not automatically share runtime data.
- Never disable qB Host Header, CSRF, Origin, authentication or TLS protection just to make remote probes work.
- To stop collection: `systemctl disable --now weig-instance-status.timer`. A stale snapshot will expire automatically.
