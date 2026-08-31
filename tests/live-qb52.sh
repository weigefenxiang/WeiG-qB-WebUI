#!/usr/bin/env bash
set -u

API="${WEIG_QB_API:-http://127.0.0.1:3443}"
TMP="$(mktemp -d)"
COOKIE="$TMP/cookies.txt"
HASH=""

cleanup() {
  if [ -n "${HASH:-}" ] && [ -s "${COOKIE:-/dev/null}" ]; then
    curl -sS -b "$COOKIE" \
      -X POST \
      --data-urlencode "hashes=$HASH" \
      --data-urlencode "deleteFiles=false" \
      "$API/api/v2/torrents/delete" >/dev/null 2>&1 || true
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

printf 'Target API: %s\n' "$API"
CONNECT_CODE="$(curl -sS -o "$TMP/root.body" -w '%{http_code}' "$API/" || true)"
[ "$CONNECT_CODE" != "000" ] || fail "cannot connect to $API"
echo "PASS: API endpoint reachable (HTTP $CONNECT_CODE)"

read -rp "qBittorrent username: " QBT_USER
read -rsp "qBittorrent password: " QBT_PASS
echo

echo
echo "===== 1. Login success ====="
LOGIN_CODE="$(curl -sS \
  -c "$COOKIE" \
  -o "$TMP/login.body" \
  -w '%{http_code}' \
  -X POST \
  --data-urlencode "username=$QBT_USER" \
  --data-urlencode "password=$QBT_PASS" \
  "$API/api/v2/auth/login" || true)"
echo "HTTP: $LOGIN_CODE"
printf 'Body: '; cat "$TMP/login.body" 2>/dev/null || true; echo
expect_code "$LOGIN_CODE" "200,204" "login accepted"

echo
echo "===== 2. Wrong password ====="
BAD_CODE="$(curl -sS \
  -o "$TMP/bad.body" \
  -w '%{http_code}' \
  -X POST \
  --data-urlencode "username=$QBT_USER" \
  --data-urlencode "password=${QBT_PASS}__WEIG_BAD_TEST__" \
  "$API/api/v2/auth/login" || true)"
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
ADD_CODE="$(curl -sS \
  -b "$COOKIE" \
  -o "$TMP/add.body" \
  -w '%{http_code}' \
  -X POST \
  -F "urls=$MAGNET" \
  "$API/api/v2/torrents/add" || true)"
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
  if grep -qi "$HASH" "$TMP/torrent.json"; then
    FOUND=1
    break
  fi
  sleep 1
done
[ "$FOUND" = "1" ] || fail "added Magnet was not found"
echo "PASS: test Torrent exists"

echo
echo "===== 7. qB 5.x stop/start ====="
STOP_CODE="$(curl -sS \
  -b "$COOKIE" \
  -o "$TMP/stop.body" \
  -w '%{http_code}' \
  -X POST \
  --data-urlencode "hashes=$HASH" \
  "$API/api/v2/torrents/stop" || true)"
expect_code "$STOP_CODE" "200,204" "torrents/stop"
sleep 1
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/info?filter=stopped&hashes=$HASH" >"$TMP/stopped.json" || fail "cannot query stopped filter"
grep -qi "$HASH" "$TMP/stopped.json" || fail "test Torrent not returned by stopped filter"
echo "PASS: stopped filter"
START_CODE="$(curl -sS \
  -b "$COOKIE" \
  -o "$TMP/start.body" \
  -w '%{http_code}' \
  -X POST \
  --data-urlencode "hashes=$HASH" \
  "$API/api/v2/torrents/start" || true)"
expect_code "$START_CODE" "200,204" "torrents/start"

echo
echo "===== 8. editTracker url parameter ====="
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/trackers?hash=$HASH" >"$TMP/trackers-before.json" || fail "cannot read trackers"
if ! grep -Fq "$OLD_TRACKER" "$TMP/trackers-before.json"; then
  ADD_TRACKER_CODE="$(curl -sS \
    -b "$COOKIE" \
    -o "$TMP/addtracker.body" \
    -w '%{http_code}' \
    -X POST \
    --data-urlencode "hash=$HASH" \
    --data-urlencode "urls=$OLD_TRACKER" \
    "$API/api/v2/torrents/addTrackers" || true)"
  expect_code "$ADD_TRACKER_CODE" "200,204" "torrents/addTrackers"
fi
EDIT_CODE="$(curl -sS \
  -b "$COOKIE" \
  -o "$TMP/edit.body" \
  -w '%{http_code}' \
  -X POST \
  --data-urlencode "hash=$HASH" \
  --data-urlencode "url=$OLD_TRACKER" \
  --data-urlencode "newUrl=$NEW_TRACKER" \
  "$API/api/v2/torrents/editTracker" || true)"
expect_code "$EDIT_CODE" "204" "editTracker new url parameter"
curl -fsS -b "$COOKIE" "$API/api/v2/torrents/trackers?hash=$HASH" >"$TMP/trackers-after.json" || fail "cannot re-read trackers"
grep -Fq "$NEW_TRACKER" "$TMP/trackers-after.json" || fail "edited tracker not found"
echo "PASS: edited tracker is visible"

echo
echo "===== 9. Preferences ====="
PREF_CODE="$(curl -sS -b "$COOKIE" -o "$TMP/preferences.json" -w '%{http_code}' "$API/api/v2/app/preferences" || true)"
expect_code "$PREF_CODE" "200" "app/preferences"

echo
echo "===== 10. Transfer endpoints ====="
for endpoint in transfer/info transfer/downloadLimit transfer/uploadLimit transfer/speedLimitsMode; do
  CODE="$(curl -sS -b "$COOKIE" -o "$TMP/transfer.body" -w '%{http_code}' "$API/api/v2/$endpoint" || true)"
  expect_code "$CODE" "200" "$endpoint"
done

echo
echo "========================================"
echo "Lab B qBittorrent 5.2.0 targeted test"
echo "RESULT: PASS"
echo "qBittorrent: $QB_VERSION"
echo "WebAPI:      $API_VERSION"
echo "Login:       $LOGIN_CODE"
echo "Bad login:   $BAD_CODE"
echo "Add:         $ADD_CODE"
echo "Stop:        $STOP_CODE"
echo "Start:       $START_CODE"
echo "EditTracker: $EDIT_CODE"
echo "========================================"
