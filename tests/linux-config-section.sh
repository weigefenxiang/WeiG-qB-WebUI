#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/home"
ROOT_FOLDER='/config/weigg-qb-webui'

run_configure() {
  HOME="$TMP/home" \
  WEIGG_QB_CONFIG_TEST_ONLY=1 \
  WEIGG_QB_CONFIG_TEST_PATH="$1" \
  WEIGG_QB_CONFIG_TEST_ROOT="$ROOT_FOLDER" \
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
cmp -s "$valid.before" "$valid.weigg.bak"
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
test ! -e "$wrong.weigg.bak"

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
test ! -e "$dup_section.weigg.bak"

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
test ! -e "$dup_key.weigg.bak"

echo 'Linux qB config section contract passed: [Preferences] ownership, exact values, raw backup and fail-closed ambiguity are enforced.'
