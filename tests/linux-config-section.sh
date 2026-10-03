#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/home"
ROOT_FOLDER='/config/weig-qb-webui'

run_configure() {
  HOME="$TMP/home" \
  WEIG_QB_CONFIG_TEST_ONLY=1 \
  WEIG_QB_CONFIG_TEST_PATH="$1" \
  WEIG_QB_CONFIG_TEST_ROOT="$ROOT_FOLDER" \
    sh "$ROOT/installers/install.sh"
}

run_uninstall_config() {
  HOME="$TMP/home" \
  WEIG_QB_UNINSTALL_CONFIG_TEST_ONLY=1 \
  WEIG_QB_CONFIG_TEST_PATH="$1" \
  WEIG_QB_CONFIG_TEST_ROOT="$ROOT_FOLDER" \
    sh "$ROOT/installers/install.sh"
}

valid="$TMP/valid.conf"
cat > "$valid" <<'EOF'
[General]
Locale=zh_CN

[Preferences]
Connection\PortRangeMin=6881
WebUI\AlternativeUIEnabled=false
WebUI\RootFolder=/old/webui

[BitTorrent]
Session\DefaultSavePath=/downloads
EOF
cp "$valid" "$valid.before"
run_configure "$valid"
cmp -s "$valid.before" "$valid.weig.bak"
awk -v want="$ROOT_FOLDER" '
  /^\[[^]]+\]$/ { section=$0 }
  /^WebUI\\AlternativeUIEnabled=/ { if(section!="[Preferences]" || $0!="WebUI\\AlternativeUIEnabled=true") exit 1; alt++ }
  /^WebUI\\RootFolder=/ { if(section!="[Preferences]" || $0!="WebUI\\RootFolder=" want) exit 1; root++ }
  END { exit !(alt==1 && root==1) }
' "$valid"
grep -Fx 'Session\DefaultSavePath=/downloads' "$valid" >/dev/null

missing="$TMP/missing.conf"
cat > "$missing" <<'EOF'
[General]
Locale=en

[Preferences]
Connection\PortRangeMin=6881

[BitTorrent]
Session\DefaultSavePath=/downloads
EOF
run_configure "$missing"
awk -v want="$ROOT_FOLDER" '
  /^\[[^]]+\]$/ { section=$0 }
  /^WebUI\\AlternativeUIEnabled=/ { if(section!="[Preferences]" || $0!="WebUI\\AlternativeUIEnabled=true") exit 1; alt++ }
  /^WebUI\\RootFolder=/ { if(section!="[Preferences]" || $0!="WebUI\\RootFolder=" want) exit 1; root++ }
  END { exit !(alt==1 && root==1) }
' "$missing"

wrong="$TMP/wrong.conf"
cat > "$wrong" <<'EOF'
[General]
Locale=en

[Preferences]
Connection\PortRangeMin=6881

[WebUI]
WebUI\AlternativeUIEnabled=false
WebUI\RootFolder=/old/webui
EOF
cp "$wrong" "$wrong.before"
if run_configure "$wrong"; then echo 'wrong-section config unexpectedly succeeded' >&2; exit 1; fi
cmp -s "$wrong" "$wrong.before"
test ! -e "$wrong.weig.bak"

dup_section="$TMP/dup-section.conf"
cat > "$dup_section" <<'EOF'
[Preferences]
Connection\PortRangeMin=6881

[BitTorrent]
Session\DefaultSavePath=/downloads

[Preferences]
WebUI\AlternativeUIEnabled=false
EOF
cp "$dup_section" "$dup_section.before"
if run_configure "$dup_section"; then echo 'duplicate [Preferences] unexpectedly succeeded' >&2; exit 1; fi
cmp -s "$dup_section" "$dup_section.before"
test ! -e "$dup_section.weig.bak"

dup_key="$TMP/dup-key.conf"
cat > "$dup_key" <<'EOF'
[Preferences]
WebUI\AlternativeUIEnabled=false
WebUI\AlternativeUIEnabled=true
WebUI\RootFolder=/old/webui
EOF
cp "$dup_key" "$dup_key.before"
if run_configure "$dup_key"; then echo 'duplicate managed key unexpectedly succeeded' >&2; exit 1; fi
cmp -s "$dup_key" "$dup_key.before"
test ! -e "$dup_key.weig.bak"

crlf="$TMP/crlf.conf"
printf '[General]\r\nLocale=zh_CN\r\n\r\n[Preferences]\r\nWebUI\\AlternativeUIEnabled=true\r\nWebUI\\RootFolder=%s\r\nLifecycle\\Marker=preserve-me\r\n' "$ROOT_FOLDER" > "$crlf"
cp "$crlf" "$crlf.before"
run_uninstall_config "$crlf"
cmp -s "$crlf.before" "$crlf.weig.bak"
python3 - "$crlf" "$ROOT_FOLDER" <<'PY'
import pathlib,sys
path=pathlib.Path(sys.argv[1]); root=sys.argv[2]
data=path.read_bytes()
if b'\r\n' not in data or b'\n' in data.replace(b'\r\n',b''):
    raise SystemExit('uninstall config mutation did not preserve CRLF line endings')
text=data.decode()
if 'WebUI\\AlternativeUIEnabled=false\r\n' not in text:
    raise SystemExit('uninstall config mutation did not disable Alternative WebUI')
if f'WebUI\\RootFolder={root}\r\n' not in text:
    raise SystemExit('uninstall config mutation changed RootFolder')
if 'Lifecycle\\Marker=preserve-me\r\n' not in text:
    raise SystemExit('uninstall config mutation changed unrelated qB config')
PY

mismatch="$TMP/mismatch.conf"
cat > "$mismatch" <<'EOF'
[Preferences]
WebUI\AlternativeUIEnabled=true
WebUI\RootFolder=/different/webui
EOF
cp "$mismatch" "$mismatch.before"
if run_uninstall_config "$mismatch"; then echo 'mismatched uninstall RootFolder unexpectedly succeeded' >&2; exit 1; fi
cmp -s "$mismatch" "$mismatch.before"
test ! -e "$mismatch.weig.bak"

echo 'Linux qB config section contract passed: [Preferences] ownership, exact values, raw backup, uninstall CRLF preservation and fail-closed ambiguity are enforced.'
