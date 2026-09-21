#!/usr/bin/env bash
set -u

API="${WEIG_QB_API:-http://127.0.0.1:3443}"
TMP="$(mktemp -d)"
COOKIE="$TMP/cookies.txt"
HASH=""
TAG=""
ALT_ORIG=""

cleanup() {
  if [ -s "${COOKIE:-/dev/null}" ]; then
    if [ -n "${ALT_ORIG:-}" ]; then
      CUR_ALT="$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/speedLimitsMode" 2>/dev/null || true)"
      CUR_ALT="$(printf '%s' "$CUR_ALT" | tr -d '\r\n ' )"
      if [ -n "$CUR_ALT" ] && [ "$CUR_ALT" != "$ALT_ORIG" ]; then
        curl -sS -b "$COOKIE" -X POST "$API/api/v2/transfer/toggleSpeedLimitsMode" >/dev/null 2>&1 || true
      fi
    fi
    if [ -n "${HASH:-}" ] && [ -n "${TAG:-}" ]; then
      curl -sS -b "$COOKIE" -X POST --data-urlencode "hashes=$HASH" --data-urlencode "tags=$TAG" "$API/api/v2/torrents/removeTags" >/dev/null 2>&1 || true
      curl -sS -b "$COOKIE" -X POST --data-urlencode "tags=$TAG" "$API/api/v2/torrents/deleteTags" >/dev/null 2>&1 || true
    fi
    if [ -n "${HASH:-}" ]; then
      curl -sS -b "$COOKIE" -X POST --data-urlencode "hashes=$HASH" --data-urlencode "deleteFiles=false" "$API/api/v2/torrents/delete" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

fail() {
  echo
  echo "FAIL: $*"
  exit 1
}

expect_code() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  case ",$expected," in
    *",$actual,"*) echo "PASS: $label (HTTP $actual)" ;;
    *) fail "$label expected HTTP {$expected}, got $actual" ;;
  esac
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

need curl
need python3

printf 'Target API: %s\n' "$API"
CONNECT_CODE="$(curl -sS -o "$TMP/root.body" -w '%{http_code}' "$API/" || true)"
[ "$CONNECT_CODE" != "000" ] || fail "cannot connect to $API"
echo "PASS: API endpoint reachable (HTTP $CONNECT_CODE)"

read -rp "qBittorrent username: " QBT_USER
read -rsp "qBittorrent password: " QBT_PASS
echo

echo
echo "===== 1. Login success ====="
LOGIN_CODE="$(curl -sS -c "$COOKIE" -o "$TMP/login.body" -w '%{http_code}' -X POST --data-urlencode "username=$QBT_USER" --data-urlencode "password=$QBT_PASS" "$API/api/v2/auth/login" || true)"
echo "HTTP: $LOGIN_CODE"
printf 'Body: '; cat "$TMP/login.body" 2>/dev/null || true; echo
expect_code "$LOGIN_CODE" "200,204" "login accepted"

echo
echo "===== 2. Wrong password ====="
BAD_CODE="$(curl -sS -o "$TMP/bad.body" -w '%{http_code}' -X POST --data-urlencode "username=$QBT_USER" --data-urlencode "password=${QBT_PASS}__WEIG_BAD_TEST__" "$API/api/v2/auth/login" || true)"
echo "HTTP: $BAD_CODE"
printf 'Body: '; cat "$TMP/bad.body" 2>/dev/null || true; echo
expect_code "$BAD_CODE" "401" "bad credentials rejected"

echo
echo "===== 3. Version detection ====="
QB_VERSION="$(curl -fsS -b "$COOKIE" "$API/api/v2/app/version")" || fail "cannot read qBittorrent version"
API_VERSION="$(curl -fsS -b "$COOKIE" "$API/api/v2/app/webapiVersion")" || fail "cannot read WebAPI version"
echo "qBittorrent: $QB_VERSION"
echo "WebAPI:      $API_VERSION"
case "$QB_VERSION" in
  *5.2.0*) echo "PASS: qBittorrent 5.2.0" ;;
  *) echo "WARN: expected qBittorrent 5.2.0, actual $QB_VERSION" ;;
esac

echo
echo "===== 4. Torrent list ====="
LIST_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/list.json" -w '%{http_code}' "$API/api/v2/torrents/info?limit=1" || true)"
expect_code "$LIST_CODE" "200" "torrents/info"

echo
echo "===== 5. torrents/add structured response ====="
HASH="$(head -c 20 /dev/urandom | od -An -tx1 | tr -d ' \n')"
OLD_TRACKER="https://tracker.invalid/announce"
NEW_TRACKER="https://tracker2.invalid/announce"
MAGNET="magnet:?xt=urn:btih:${HASH}&dn=WeiG-5.2-compat-test&tr=https%3A%2F%2Ftracker.invalid%2Fannounce"
ADD_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/add.body" -w '%{http_code}' -X POST -F "urls=$MAGNET" "$API/api/v2/torrents/add" || true)"
echo "HTTP: $ADD_CODE"
cat "$TMP/add.body" 2>/dev/null || true
echo
expect_code "$ADD_CODE" "200,202" "torrents/add accepted"
if grep -Eq '"(success_count|pending_count)"[[:space:]]*:[[:space:]]*[1-9]' "$TMP/add.body"; then
  echo "PASS: structured torrents/add response"
else
  fail "qBittorrent 5.2 structured torrents/add response not detected"
fi

echo
echo "===== 6. Confirm test Torrent exists ====="
FOUND=0
for _i in $(seq 1 10); do
  curl -fsS -b "$COOKIE" "$API/api/v2/torrents/info?hashes=$HASH" >"$TMP/torrent.json" || true
  if grep -qi "$HASH" "$TMP/torrent.json"; then FOUND=1; break; fi
  sleep 1
done
[ "$FOUND" = "1" ] || fail "added Magnet was not found"
echo "PASS: test Torrent exists"

echo
echo "===== 7. qB 5.x stop/start ====="
STOP_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/stop.body" -w '%{http_code}' -X POST --data-urlencode "hashes=$HASH" "$API/api/v2/torrents/stop" || true)"
expect_code "$STOP_CODE" "200,204" "torrents/stop"
sleep 1
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/info?filter=stopped&hashes=$HASH" >"$TMP/stopped.json" || fail "cannot query stopped filter"
grep -qi "$HASH" "$TMP/stopped.json" || fail "test Torrent not returned by stopped filter"
echo "PASS: stopped filter"
START_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/start.body" -w '%{http_code}' -X POST --data-urlencode "hashes=$HASH" "$API/api/v2/torrents/start" || true)"
expect_code "$START_CODE" "200,204" "torrents/start"

echo
echo "===== 8. editTracker url parameter ====="
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/trackers?hash=$HASH" >"$TMP/trackers-before.json" || fail "cannot read trackers"
if ! grep -Fq "$OLD_TRACKER" "$TMP/trackers-before.json"; then
  ADD_TRACKER_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/addtracker.body" -w '%{http_code}' -X POST --data-urlencode "hash=$HASH" --data-urlencode "urls=$OLD_TRACKER" "$API/api/v2/torrents/addTrackers" || true)"
  expect_code "$ADD_TRACKER_CODE" "200,204" "torrents/addTrackers"
fi
EDIT_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/edit.body" -w '%{http_code}' -X POST --data-urlencode "hash=$HASH" --data-urlencode "url=$OLD_TRACKER" --data-urlencode "newUrl=$NEW_TRACKER" "$API/api/v2/torrents/editTracker" || true)"
expect_code "$EDIT_CODE" "204" "editTracker new url parameter"
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/trackers?hash=$HASH" >"$TMP/trackers-after.json" || fail "cannot re-read trackers"
grep -Fq "$NEW_TRACKER" "$TMP/trackers-after.json" || fail "edited tracker not found"
echo "PASS: edited tracker is visible"

echo
echo "===== 9. Preferences read ====="
PREF_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/preferences.json" -w '%{http_code}' "$API/api/v2/app/preferences" || true)"
expect_code "$PREF_CODE" "200" "app/preferences"

echo
echo "===== 10. Transfer read endpoints ====="
for endpoint in transfer/info transfer/downloadLimit transfer/uploadLimit transfer/speedLimitsMode; do
  CODE="$(curl -sS -b "$COOKIE" -o "$TMP/transfer.body" -w '%{http_code}' "$API/api/v2/$endpoint" || true)"
  expect_code "$CODE" "200" "$endpoint"
done

echo
echo "===== 11. Exact private flag ====="
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/info?hashes=$HASH" >"$TMP/private.json" || fail "cannot read test Torrent for private flag"
python3 - "$TMP/private.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data=json.load(f)
if not data or 'private' not in data[0]:
    raise SystemExit('FAIL: torrents/info does not expose the private field')
print('PASS: torrents/info exposes exact private flag:', data[0]['private'])
PY
[ "$?" = "0" ] || fail "exact private flag missing"

echo
echo "===== 12. Tags lifecycle ====="
TAG="WeiG-LabB-${HASH:0:8}"
CREATE_TAG_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/create-tag.body" -w '%{http_code}' -X POST --data-urlencode "tags=$TAG" "$API/api/v2/torrents/createTags" || true)"
expect_code "$CREATE_TAG_CODE" "200,204" "create temporary tag"
ADD_TAG_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/add-tag.body" -w '%{http_code}' -X POST --data-urlencode "hashes=$HASH" --data-urlencode "tags=$TAG" "$API/api/v2/torrents/addTags" || true)"
expect_code "$ADD_TAG_CODE" "200,204" "add temporary tag"
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/info?hashes=$HASH" >"$TMP/tagged.json" || fail "cannot verify tag"
python3 - "$TMP/tagged.json" "$TAG" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data=json.load(f)
tags={x.strip() for x in str(data[0].get('tags','')).split(',') if x.strip()} if data else set()
if sys.argv[2] not in tags:
    raise SystemExit('FAIL: temporary tag not visible on Torrent')
print('PASS: temporary tag is visible on Torrent')
PY
[ "$?" = "0" ] || fail "tag verification failed"
REMOVE_TAG_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/remove-tag.body" -w '%{http_code}' -X POST --data-urlencode "hashes=$HASH" --data-urlencode "tags=$TAG" "$API/api/v2/torrents/removeTags" || true)"
expect_code "$REMOVE_TAG_CODE" "200,204" "remove temporary tag"
DELETE_TAG_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/delete-tag.body" -w '%{http_code}' -X POST --data-urlencode "tags=$TAG" "$API/api/v2/torrents/deleteTags" || true)"
expect_code "$DELETE_TAG_CODE" "200,204" "delete temporary tag"
TAG=""

echo
echo "===== 13. Files / Trackers / Peers ====="
for spec in \
  "torrents/files?hash=$HASH|files" \
  "torrents/trackers?hash=$HASH|trackers" \
  "sync/torrentPeers?rid=0&hash=$HASH|peers"; do
  endpoint="${spec%%|*}"
  label="${spec##*|}"
  CODE="$(curl -sS -b "$COOKIE" -o "$TMP/detail-$label.json" -w '%{http_code}' "$API/api/v2/$endpoint" || true)"
  expect_code "$CODE" "200" "$label endpoint"
done

echo
echo "===== 14. Settings write path (no-op round trip) ====="
python3 - "$TMP/preferences.json" "$TMP/pref-patch.json" "$TMP/pref-key.txt" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    prefs=json.load(f)
for key in ('max_connec','max_uploads','queueing_enabled','dl_limit','up_limit'):
    if key in prefs:
        with open(sys.argv[2],'w',encoding='utf-8') as out:
            json.dump({key:prefs[key]},out,separators=(',',':'))
        with open(sys.argv[3],'w',encoding='utf-8') as out:
            out.write(key)
        print(f'Using preference key: {key}')
        break
else:
    raise SystemExit('No safe preference key found')
PY
[ "$?" = "0" ] || fail "could not prepare safe settings round trip"
PREF_PATCH="$(cat "$TMP/pref-patch.json")"
PREF_KEY="$(cat "$TMP/pref-key.txt")"
SET_PREF_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/set-pref.body" -w '%{http_code}' -X POST --data-urlencode "json=$PREF_PATCH" "$API/api/v2/app/setPreferences" || true)"
expect_code "$SET_PREF_CODE" "200,204" "app/setPreferences no-op write"
curl -fsS -b "$COOKIE" "$API/api/v2/app/preferences" >"$TMP/preferences-after.json" || fail "cannot re-read preferences"
python3 - "$TMP/preferences.json" "$TMP/preferences-after.json" "$PREF_KEY" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f: before=json.load(f)
with open(sys.argv[2], encoding='utf-8') as f: after=json.load(f)
key=sys.argv[3]
if before.get(key) != after.get(key):
    raise SystemExit(f'Preference {key} changed unexpectedly')
print(f'PASS: preference {key} round trip preserved value')
PY
[ "$?" = "0" ] || fail "settings round trip mismatch"

echo
echo "===== 15. Global limit write path (preserve current values) ====="
DL_LIMIT="$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/downloadLimit" | tr -d '\r\n ' )" || fail "cannot read download limit"
UL_LIMIT="$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/uploadLimit" | tr -d '\r\n ' )" || fail "cannot read upload limit"
DL_SET_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/dl-set.body" -w '%{http_code}' -X POST --data-urlencode "limit=$DL_LIMIT" "$API/api/v2/transfer/setDownloadLimit" || true)"
UL_SET_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/ul-set.body" -w '%{http_code}' -X POST --data-urlencode "limit=$UL_LIMIT" "$API/api/v2/transfer/setUploadLimit" || true)"
expect_code "$DL_SET_CODE" "200,204" "setDownloadLimit current-value write"
expect_code "$UL_SET_CODE" "200,204" "setUploadLimit current-value write"
[ "$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/downloadLimit" | tr -d '\r\n ' )" = "$DL_LIMIT" ] || fail "download limit did not round trip"
[ "$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/uploadLimit" | tr -d '\r\n ' )" = "$UL_LIMIT" ] || fail "upload limit did not round trip"
echo "PASS: global DL/UL limits preserved"

echo
echo "===== 16. ALT mode toggle + restore ====="
ALT_ORIG="$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/speedLimitsMode" | tr -d '\r\n ' )" || fail "cannot read ALT mode"
ALT_TOGGLE_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/alt-toggle.body" -w '%{http_code}' -X POST "$API/api/v2/transfer/toggleSpeedLimitsMode" || true)"
expect_code "$ALT_TOGGLE_CODE" "200,204" "toggleSpeedLimitsMode"
ALT_AFTER="$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/speedLimitsMode" | tr -d '\r\n ' )" || fail "cannot read toggled ALT mode"
[ "$ALT_AFTER" != "$ALT_ORIG" ] || fail "ALT mode did not change after toggle"
ALT_RESTORE_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/alt-restore.body" -w '%{http_code}' -X POST "$API/api/v2/transfer/toggleSpeedLimitsMode" || true)"
expect_code "$ALT_RESTORE_CODE" "200,204" "restore speedLimitsMode"
ALT_RESTORED="$(curl -fsS -b "$COOKIE" "$API/api/v2/transfer/speedLimitsMode" | tr -d '\r\n ' )" || fail "cannot verify restored ALT mode"
[ "$ALT_RESTORED" = "$ALT_ORIG" ] || fail "ALT mode was not restored"
echo "PASS: ALT mode toggled and restored ($ALT_ORIG -> $ALT_AFTER -> $ALT_RESTORED)"
ALT_ORIG=""

echo
echo "===== 17. Session / graph data ====="
MAIN_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/maindata.json" -w '%{http_code}' "$API/api/v2/sync/maindata?rid=0" || true)"
expect_code "$MAIN_CODE" "200" "sync/maindata"
python3 - "$TMP/maindata.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f: data=json.load(f)
if 'server_state' not in data:
    raise SystemExit('server_state missing')
print('PASS: sync/maindata includes server_state for Transfer Graph/session UI')
PY
[ "$?" = "0" ] || fail "sync/maindata server_state missing"

echo
echo "===== 18. Search / RSS / Logs ====="
for spec in \
  "search/plugins|Search plugins" \
  "rss/items?withData=false|RSS items" \
  "log/main?normal=true&info=true&warning=true&critical=true&last_known_id=-1|Logs"; do
  endpoint="${spec%%|*}"
  label="${spec##*|}"
  CODE="$(curl -sS -b "$COOKIE" -o "$TMP/tool.body" -w '%{http_code}' "$API/api/v2/$endpoint" || true)"
  expect_code "$CODE" "200" "$label"
done

echo
echo "========================================"
echo "Lab B qBittorrent 5.2.0 extended API regression"
echo "RESULT: PASS"
echo "qBittorrent: $QB_VERSION"
echo "WebAPI:      $API_VERSION"
echo "Login:       $LOGIN_CODE"
echo "Bad login:   $BAD_CODE"
echo "Add:         $ADD_CODE"
echo "Stop:        $STOP_CODE"
echo "Start:       $START_CODE"
echo "EditTracker: $EDIT_CODE"
echo "Private:     exposed"
echo "Tags:        lifecycle PASS"
echo "Settings:    no-op write PASS"
echo "DL/UL:       write round trip PASS"
echo "ALT:         toggle/restore PASS"
echo "Tools:       Search/RSS/Logs PASS"
echo "----------------------------------------"
echo "Browser UI regression is still required for:"
echo "Private/PT filter, Tags UI, Settings UI save, Files/Peers UI,"
echo "Search/RSS/Logs rendering, Transfer Graph rendering, scroll stability,"
echo "empty states, Desktop/Mobile layout and i18n."
echo "========================================"
