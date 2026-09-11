from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8-sig')


def write(path, text, bom=False):
    data = text.encode('utf-8')
    if bom:
        data = b'\xef\xbb\xbf' + data
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'{label}: start marker missing')
    b = text.find(end, a + len(start))
    if b < 0:
        raise SystemExit(f'{label}: end marker missing')
    return text[:a] + replacement.rstrip() + '\n' + text[b:]


# ---------------------------------------------------------------------------
# Windows: preserve the existing byte-safe/atomic transaction, but make the
# semantic owner explicit: qB stores WebUI\\... under [Preferences].
# ---------------------------------------------------------------------------
ps = read('installers/install.ps1')
old_helpers_start = 'function Get-QBUnmanagedConfigText([string]$Text) {'
old_helpers_end = 'function Invoke-QBAtomicReplace([string]$Source,[string]$Destination,[string]$BackupPath) {'
new_helpers = r'''function Get-QBPreferencesSectionInfo([string]$Text) {
  $headers=[regex]::Matches($Text,'(?m)^\[([^\]\r\n]+)\]\r?$')
  $preferences=@($headers | Where-Object { $_.Groups[1].Value -eq 'Preferences' })
  if($preferences.Count -ne 1){
    throw "qBittorrent config must contain exactly one [Preferences] section; found $($preferences.Count)."
  }
  $header=$preferences[0]
  $end=$Text.Length
  foreach($candidate in $headers){
    if($candidate.Index -gt $header.Index){$end=$candidate.Index;break}
  }
  return [PSCustomObject]@{Start=$header.Index;End=$end;HeaderEnd=$header.Index+$header.Length}
}

function Get-QBManagedWebUIKeyMatches([string]$Text) {
  return @([regex]::Matches($Text,'(?m)^WebUI\\(?:AlternativeUIEnabled|RootFolder)=[^\r\n]*\r?$'))
}

function Assert-QBWebUISectionOwnership([string]$Text,[string]$RootFolder) {
  $section=Get-QBPreferencesSectionInfo $Text
  $managed=@(Get-QBManagedWebUIKeyMatches $Text)
  foreach($match in $managed){
    if($match.Index -lt $section.Start -or $match.Index -ge $section.End){
      throw 'qBittorrent managed WebUI keys must belong to the [Preferences] section.'
    }
  }
  if(([regex]::Matches($Text,'(?m)^WebUI\\AlternativeUIEnabled=true\r?$')).Count -ne 1){
    throw 'qBittorrent config candidate must contain exactly one enabled Alternative WebUI line.'
  }
  $escapedRoot=[regex]::Escape('WebUI\RootFolder='+$RootFolder)
  if(([regex]::Matches($Text,'(?m)^'+$escapedRoot+'\r?$')).Count -ne 1){
    throw 'qBittorrent config candidate must contain exactly one exact WebUI RootFolder line.'
  }
  if(([regex]::Matches($Text,'(?m)^WebUI\\AlternativeUIEnabled=')).Count -ne 1 -or ([regex]::Matches($Text,'(?m)^WebUI\\RootFolder=')).Count -ne 1){
    throw 'qBittorrent config contains duplicate managed WebUI keys; refusing ambiguous mutation.'
  }
}

function Get-QBUnmanagedConfigText([string]$Text) {
  return [regex]::Replace($Text,'(?m)^WebUI\\(?:AlternativeUIEnabled|RootFolder)=.*(?:\r?\n|$)','')
}

function Set-QBWebUIConfigText([string]$Original,[string]$RootFolder,[string]$Newline) {
  $section=Get-QBPreferencesSectionInfo $Original
  $managed=@(Get-QBManagedWebUIKeyMatches $Original)
  foreach($match in $managed){
    if($match.Index -lt $section.Start -or $match.Index -ge $section.End){
      throw 'qBittorrent managed WebUI keys must belong to the [Preferences] section.'
    }
  }

  $preferencesText=$Original.Substring($section.Start,$section.End-$section.Start)
  if(([regex]::Matches($preferencesText,'(?m)^WebUI\\AlternativeUIEnabled=')).Count -gt 1 -or ([regex]::Matches($preferencesText,'(?m)^WebUI\\RootFolder=')).Count -gt 1){
    throw 'qBittorrent config contains duplicate managed WebUI keys; refusing ambiguous mutation.'
  }

  if($preferencesText -match '(?m)^WebUI\\AlternativeUIEnabled='){
    $preferencesText=[regex]::Replace($preferencesText,'(?m)^WebUI\\AlternativeUIEnabled=[^\r\n]*(\r?)$','WebUI\AlternativeUIEnabled=true$1')
  } else {
    if($preferencesText.Length -gt 0 -and !$preferencesText.EndsWith("`n") -and !$preferencesText.EndsWith("`r")){$preferencesText+=$Newline}
    $preferencesText+='WebUI\AlternativeUIEnabled=true'+$Newline
  }

  $rootLine='WebUI\RootFolder='+$RootFolder
  if($preferencesText -match '(?m)^WebUI\\RootFolder='){
    $preferencesText=[regex]::Replace($preferencesText,'(?m)^WebUI\\RootFolder=[^\r\n]*(\r?)$',[System.Text.RegularExpressions.MatchEvaluator]{param($m)$rootLine+$m.Groups[1].Value})
  } else {
    if($preferencesText.Length -gt 0 -and !$preferencesText.EndsWith("`n") -and !$preferencesText.EndsWith("`r")){$preferencesText+=$Newline}
    $preferencesText+=$rootLine+$Newline
  }

  $candidate=$Original.Substring(0,$section.Start)+$preferencesText+$Original.Substring($section.End)
  Assert-QBWebUISectionOwnership $candidate $RootFolder
  return $candidate
}

function Assert-QBWebUIMutation([string]$Original,[string]$Candidate,[string]$RootFolder,[string]$Newline) {
  Assert-QBWebUISectionOwnership $Candidate $RootFolder
  $before=Get-QBUnmanagedConfigText $Original
  $after=Get-QBUnmanagedConfigText $Candidate
  if($after -ne $before -and $after -ne ($before+$Newline)){
    throw 'qBittorrent config mutation changed unrelated content; refusing write.'
  }
}

'''
ps = replace_between(ps, old_helpers_start, old_helpers_end, new_helpers, 'PowerShell section helpers')
configure_start = "  if(([regex]::Matches($originalText,'(?m)^WebUI\\\\AlternativeUIEnabled=')).Count -gt 1"
configure_end = '  Assert-QBWebUIMutation $originalText $text $RootFolder $newline\n'
a = ps.find(configure_start)
if a < 0:
    raise SystemExit('PowerShell Configure mutation start missing')
b = ps.find(configure_end, a)
if b < 0:
    raise SystemExit('PowerShell Configure mutation end missing')
b += len(configure_end)
ps = ps[:a] + '  $text=Set-QBWebUIConfigText $originalText $RootFolder $newline\n  Assert-QBWebUIMutation $originalText $text $RootFolder $newline\n' + ps[b:]
write('installers/install.ps1', ps)

# ---------------------------------------------------------------------------
# Windows regression: make checkout line endings deterministic and cover the
# real [Preferences] owner plus wrong-section / duplicate-section refusal.
# Keep UTF-8 BOM because Windows PowerShell 5.1 requires it for these literals.
# ---------------------------------------------------------------------------
wtest = read('tests/windows-config-encoding.ps1')
wtest = replace_once(
    wtest,
    "  'Assert-QBConfigMutationSafe',\n  'Get-QBUnmanagedConfigText',\n  'Assert-QBWebUIMutation',",
    "  'Assert-QBConfigMutationSafe',\n  'Get-QBPreferencesSectionInfo',\n  'Get-QBManagedWebUIKeyMatches',\n  'Assert-QBWebUISectionOwnership',\n  'Get-QBUnmanagedConfigText',\n  'Set-QBWebUIConfigText',\n  'Assert-QBWebUIMutation',",
    'Windows required helper list'
)
wtest = replace_once(
    wtest,
    'function Write-EncodedFile([string]$Path,[string]$Text,$Encoding,[byte[]]$Preamble){',
    '''function Convert-ToCRLF([string]$Text){\n  $normalized=($Text -replace "`r`n","`n") -replace "`r","`n"\n  return ($normalized -replace "`n","`r`n")\n}\nfunction Write-EncodedFile([string]$Path,[string]$Text,$Encoding,[byte[]]$Preamble){''',
    'Windows CRLF helper'
)
wtest = replace_once(wtest, '\n[WebUI]\nUsername=admin\nWebUI\\AlternativeUIEnabled=false', '\n[Preferences]\nUsername=admin\nWebUI\\AlternativeUIEnabled=false', 'Windows Preferences fixture')
wtest = replace_once(
    wtest,
    'WebUI\\RootFolder=D:\\old\\webui\n"@ -replace "`n","`r`n"',
    'WebUI\\RootFolder=D:\\old\\webui\n"@\n  $original=Convert-ToCRLF $original',
    'Windows deterministic CRLF fixture'
)
wtest = replace_once(
    wtest,
    "  Assert-True ($decoded.Contains(\"WebUI\\RootFolder=$rootFolder\")) 'Alternative WebUI RootFolder was not written.'",
    "  Assert-True ($decoded.Contains(\"WebUI\\RootFolder=$rootFolder\")) 'Alternative WebUI RootFolder was not written.'\n  Assert-QBWebUISectionOwnership $decoded $rootFolder",
    'Windows success section assertion'
)
insert_after = "  Assert-True (Bytes-Equal $duplicateBefore ([IO.File]::ReadAllBytes($duplicateCfg))) 'Duplicate-key refusal must leave bytes untouched.'\n"
extra_negative = r'''

  # Managed WebUI keys in a non-Preferences section must fail closed.
  $wrongSectionCfg=Join-Path $temp 'qBittorrent-wrong-section.ini'
  $wrongSection=(Get-QBUnmanagedConfigText $original)+"`r`n[WebUI]`r`nWebUI\AlternativeUIEnabled=false`r`nWebUI\RootFolder=D:\old\webui`r`n"
  Write-EncodedFile $wrongSectionCfg $wrongSection $utf8NoBom ([byte[]]@())
  [byte[]]$wrongSectionBefore=[IO.File]::ReadAllBytes($wrongSectionCfg)
  Assert-Throws { Configure-QBWebUI $wrongSectionCfg $rootFolder } 'must belong to the [Preferences] section' 'Configure must refuse managed WebUI keys outside [Preferences].'
  Assert-True (Bytes-Equal $wrongSectionBefore ([IO.File]::ReadAllBytes($wrongSectionCfg))) 'Wrong-section refusal must leave bytes untouched.'
  Assert-True (-not (Test-Path "$wrongSectionCfg.weigg.bak")) 'Wrong-section refusal must occur before creating a mutation backup.'

  # Multiple [Preferences] sections are ambiguous and must fail closed.
  $duplicateSectionCfg=Join-Path $temp 'qBittorrent-duplicate-section.ini'
  $duplicateSection=$original+"`r`n[Preferences]`r`nConnection\PortRangeMin=6881`r`n"
  Write-EncodedFile $duplicateSectionCfg $duplicateSection $utf8NoBom ([byte[]]@())
  [byte[]]$duplicateSectionBefore=[IO.File]::ReadAllBytes($duplicateSectionCfg)
  Assert-Throws { Configure-QBWebUI $duplicateSectionCfg $rootFolder } 'exactly one [Preferences] section' 'Configure must refuse duplicate [Preferences] sections.'
  Assert-True (Bytes-Equal $duplicateSectionBefore ([IO.File]::ReadAllBytes($duplicateSectionCfg))) 'Duplicate-section refusal must leave bytes untouched.'
  Assert-True (-not (Test-Path "$duplicateSectionCfg.weigg.bak")) 'Duplicate-section refusal must occur before creating a mutation backup.'
'''
wtest = replace_once(wtest, insert_after, insert_after + extra_negative, 'Windows section negative regressions')
write('tests/windows-config-encoding.ps1', wtest, bom=True)

# ---------------------------------------------------------------------------
# Linux: same qB [Preferences] ownership. Validate first, build/validate a temp
# candidate, preserve a raw backup, then rename the validated candidate.
# ---------------------------------------------------------------------------
sh = read('installers/install.sh')
linux_helpers = r'''
validate_qb_webui_config_file() {
  cfg=$1
  expected_root=${2-}
  require_values=${3:-0}
  awk -v expected_root="$expected_root" -v require_values="$require_values" '
    BEGIN { section=""; preferences=0; alt=0; root=0; wrong=0; alt_true=0; root_exact=0 }
    {
      line=$0
      sub(/\r$/, "", line)
      if (line ~ /^\[[^]]+\]$/) {
        section=line
        if (line == "[Preferences]") preferences++
        next
      }
      if (line ~ /^WebUI\\AlternativeUIEnabled=/) {
        alt++
        if (section != "[Preferences]") wrong=1
        if (line == "WebUI\\AlternativeUIEnabled=true") alt_true++
      }
      if (line ~ /^WebUI\\RootFolder=/) {
        root++
        if (section != "[Preferences]") wrong=1
        if (line == "WebUI\\RootFolder=" expected_root) root_exact++
      }
    }
    END {
      if (preferences != 1) { print "qBittorrent config must contain exactly one [Preferences] section; found " preferences "." > "/dev/stderr"; exit 41 }
      if (wrong) { print "qBittorrent managed WebUI keys must belong to the [Preferences] section." > "/dev/stderr"; exit 42 }
      if (alt > 1 || root > 1) { print "qBittorrent config contains duplicate managed WebUI keys; refusing ambiguous mutation." > "/dev/stderr"; exit 43 }
      if (require_values && (alt != 1 || root != 1 || alt_true != 1 || root_exact != 1)) { print "qBittorrent managed WebUI values failed exact post-write verification." > "/dev/stderr"; exit 44 }
    }
  ' "$cfg"
}

configure_qb_webui_file() {
  cfg=$1
  qb_root=$2
  [ -f "$cfg" ] || { echo "qBittorrent config does not exist: $cfg" >&2; return 1; }
  validate_qb_webui_config_file "$cfg" "$qb_root" 0 || return 1

  backup="$cfg.weigg.bak"
  cp -a "$cfg" "$backup"
  cmp -s "$cfg" "$backup" || { echo "qBittorrent safety backup is not byte-identical; refusing mutation." >&2; return 1; }

  cfg_dir=$(dirname "$cfg")
  tmp_cfg=$(mktemp "$cfg_dir/.weigg-qb-config.XXXXXX")
  tmp_body="$tmp_cfg.body"
  cleanup_qb_tmp() { rm -f "$tmp_cfg" "$tmp_body"; }
  cp -p "$cfg" "$tmp_cfg" 2>/dev/null || cp "$cfg" "$tmp_cfg"

  if ! awk -v root="$qb_root" '
    BEGIN { in_preferences=0; alt=0; root_seen=0; saw_cr=0 }
    function emit_missing(suffix) {
      if (!alt) print "WebUI\\AlternativeUIEnabled=true" suffix
      if (!root_seen) print "WebUI\\RootFolder=" root suffix
    }
    {
      raw=$0
      line=raw
      had_cr=sub(/\r$/, "", line)
      if (had_cr) saw_cr=1
      if (line ~ /^\[[^]]+\]$/) {
        if (in_preferences) { emit_missing(saw_cr ? "\r" : ""); in_preferences=0 }
        if (line == "[Preferences]") in_preferences=1
        print raw
        next
      }
      if (in_preferences && line ~ /^WebUI\\AlternativeUIEnabled=/) {
        print "WebUI\\AlternativeUIEnabled=true" (had_cr ? "\r" : "")
        alt=1
        next
      }
      if (in_preferences && line ~ /^WebUI\\RootFolder=/) {
        print "WebUI\\RootFolder=" root (had_cr ? "\r" : "")
        root_seen=1
        next
      }
      print raw
    }
    END { if (in_preferences) emit_missing(saw_cr ? "\r" : "") }
  ' "$cfg" > "$tmp_body"; then
    cleanup_qb_tmp
    return 1
  fi
  cat "$tmp_body" > "$tmp_cfg"
  rm -f "$tmp_body"

  if ! validate_qb_webui_config_file "$tmp_cfg" "$qb_root" 1; then
    cleanup_qb_tmp
    return 1
  fi
  if ! mv "$tmp_cfg" "$cfg"; then
    cleanup_qb_tmp
    cp -a "$backup" "$cfg"
    echo "Failed to atomically replace qBittorrent config; original restored." >&2
    return 1
  fi
  if ! validate_qb_webui_config_file "$cfg" "$qb_root" 1; then
    cp -a "$backup" "$cfg"
    echo "qBittorrent config post-write verification failed; original restored." >&2
    return 1
  fi
}

if [ "${WEIGG_QB_CONFIG_TEST_ONLY:-0}" = "1" ]; then
  [ -n "${WEIGG_QB_CONFIG_TEST_PATH:-}" ] && [ -n "${WEIGG_QB_CONFIG_TEST_ROOT:-}" ] || {
    echo "WEIGG_QB_CONFIG_TEST_PATH and WEIGG_QB_CONFIG_TEST_ROOT are required in config test mode." >&2
    exit 2
  }
  configure_qb_webui_file "$WEIGG_QB_CONFIG_TEST_PATH" "$WEIGG_QB_CONFIG_TEST_ROOT"
  exit $?
fi

'''
sh = replace_once(sh, 'if [ "$LIST_CONTAINERS" -eq 1 ]; then\n', linux_helpers + 'if [ "$LIST_CONTAINERS" -eq 1 ]; then\n', 'Linux config helper insertion')
config_start = 'if [ "$CONFIGURE" -eq 1 ]; then\n'
config_else = 'else\n  echo "qBittorrent -> Tools -> Preferences -> Web UI -> Use alternative WebUI"'
a = sh.rfind(config_start)
if a < 0:
    raise SystemExit('Linux configure block start missing')
b = sh.find(config_else, a)
if b < 0:
    raise SystemExit('Linux configure block else missing')
new_config = '''if [ "$CONFIGURE" -eq 1 ]; then\n  [ -n "$cfg" ] || { echo "No safe qBittorrent config was found; WebUI files are installed but configuration was not changed." >&2; exit 2; }\n  configure_qb_webui_file "$cfg" "$QBT_ROOT_FOLDER"\n  echo "Configured: $cfg"\n  echo "qBittorrent Root Folder: $QBT_ROOT_FOLDER"\n'''
sh = sh[:a] + new_config + sh[b:]
write('installers/install.sh', sh)

linux_test = r'''#!/usr/bin/env bash
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
'''
write('tests/linux-config-section.sh', linux_test)

# Real-qB candidate must assert semantic section ownership before runtime root SHA.
candidate = read('tests/candidate-deployment.sh')
candidate = replace_once(
    candidate,
    "grep -Fx 'WebUI\\AlternativeUIEnabled=true' \"$QBT_CONFIG\" >/dev/null\ngrep -Fx \"WebUI\\\\RootFolder=$QB_ROOT\" \"$QBT_CONFIG\" >/dev/null",
    "grep -Fx 'WebUI\\AlternativeUIEnabled=true' \"$QBT_CONFIG\" >/dev/null\ngrep -Fx \"WebUI\\\\RootFolder=$QB_ROOT\" \"$QBT_CONFIG\" >/dev/null\nawk -v want=\"$QB_ROOT\" '\n  /^\\[[^]]+\\]$/ { section=$0 }\n  /^WebUI\\\\AlternativeUIEnabled=/ { if(section!=\"[Preferences]\" || $0!=\"WebUI\\\\AlternativeUIEnabled=true\") exit 1; alt++ }\n  /^WebUI\\\\RootFolder=/ { if(section!=\"[Preferences]\" || $0!=\"WebUI\\\\RootFolder=\" want) exit 1; root++ }\n  END { exit !(alt==1 && root==1) }\n' \"$QBT_CONFIG\" || { echo 'Candidate installer did not write exact managed WebUI keys under [Preferences].' >&2; exit 1; }",
    'Candidate Preferences owner assertion'
)
write('tests/candidate-deployment.sh', candidate)

# ---------------------------------------------------------------------------
# Full qB audit: make locale/source enrichment shardable and merge the exact
# catalog deterministically back into original version order.
# ---------------------------------------------------------------------------
locale = read('tools/qb-locale-source.mjs')
unique_line = "function unique(values){const out=[];for(const value of values||[]){const item=String(value||'').trim();if(item&&!out.includes(item))out.push(item);}return out;}"
shard_helpers = r'''

export function selectCatalogShard(catalog,index,count){
  if(!Array.isArray(catalog))throw new Error('qB release catalog must be an array.');
  if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||index<0||index>=count)throw new Error(`Invalid qB locale shard ${index}/${count}.`);
  return catalog.filter((_,position)=>position%count===index);
}

function profileIdentity(profile){return `${String(profile?.qbVersion||'').trim()}\u0000${String(profile?.sourceSha||'').trim()}`;}
function stablePayload(value){return JSON.stringify(value);}
export function mergeEnrichedCatalogShards(baseCatalog,shards){
  if(!Array.isArray(baseCatalog)||!baseCatalog.length)throw new Error('Base qB release catalog must be a non-empty array.');
  if(!Array.isArray(shards)||!shards.length)throw new Error('At least one enriched qB locale shard is required.');
  const byIdentity=new Map(),sets=new Map();
  for(const shard of shards){
    if(!Array.isArray(shard))throw new Error('Each enriched qB locale shard must be an array.');
    for(const profile of shard){
      const identity=profileIdentity(profile);
      if(!identity||identity==='\u0000')throw new Error('Enriched qB locale shard contains an unbound profile.');
      if(byIdentity.has(identity))throw new Error(`Duplicate enriched qB locale profile: ${identity.replace('\u0000',' ')}`);
      byIdentity.set(identity,profile);
      for(const [hash,payload] of Object.entries(profile?.settingsTranslationSets||{})){
        if(sets.has(hash)&&stablePayload(sets.get(hash))!==stablePayload(payload))throw new Error(`Settings translation hash collision while merging shards: ${hash}`);
        if(!sets.has(hash))sets.set(hash,payload);
      }
    }
  }
  const emitted=new Set();
  const merged=baseCatalog.map((base)=>{
    const identity=profileIdentity(base),source=byIdentity.get(identity);
    if(!source)throw new Error(`Missing enriched qB locale profile: ${identity.replace('\u0000',' ')}`);
    const next={...source};
    delete next.settingsTranslationSets;
    const localSets={};
    for(const hash of Object.values(next.settingsTranslations||{})){
      if(emitted.has(hash))continue;
      if(!sets.has(hash))throw new Error(`${next.qbVersion}: missing merged Settings translation set ${hash}.`);
      emitted.add(hash);
      localSets[hash]=sets.get(hash);
    }
    if(Object.keys(localSets).length)next.settingsTranslationSets=localSets;
    return next;
  });
  if(byIdentity.size!==merged.length)throw new Error(`Enriched shard profile count ${byIdentity.size} does not match base catalog ${merged.length}.`);
  return merged;
}
'''
locale = replace_once(locale, unique_line, unique_line + shard_helpers, 'Locale shard helpers')
main_marker = "const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));"
a = locale.find(main_marker)
if a < 0:
    raise SystemExit('Locale CLI main marker missing')
new_main = r'''const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const args=process.argv.slice(2);
    if(args[0]==='--merge'){
      const basePath=path.resolve(args[1]||''),shardDir=path.resolve(args[2]||''),output=path.resolve(args[3]||'');
      if(!basePath||!fs.existsSync(basePath)||!shardDir||!fs.existsSync(shardDir)||!output)throw new Error('Usage: node tools/qb-locale-source.mjs --merge <base-catalog.json> <shard-dir> <output.json>');
      const baseCatalog=JSON.parse(fs.readFileSync(basePath,'utf8'));
      const shardFiles=fs.readdirSync(shardDir).filter((name)=>/^qb-releases-shard-\d+\.json$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
      if(!shardFiles.length)throw new Error('No qB locale shard files were found for merge.');
      const shards=shardFiles.map((name)=>JSON.parse(fs.readFileSync(path.join(shardDir,name),'utf8')));
      const merged=mergeEnrichedCatalogShards(baseCatalog,shards);
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(merged,null,2)+'\n','utf8');
      console.log(`Merged ${shardFiles.length} qB locale/source shards into ${merged.length} exact release profiles.`);
    }else{
      const positional=args.filter((arg)=>!arg.startsWith('--shard-index=')&&!arg.startsWith('--shard-count='));
      const qbRoot=path.resolve(positional[0]||process.env.QB_UPSTREAM_DIR||'');
      const input=path.resolve(positional[1]||'');
      const output=path.resolve(positional[2]||positional[1]||'');
      if(!qbRoot||!fs.existsSync(qbRoot)||!input||!fs.existsSync(input))throw new Error('Usage: node tools/qb-locale-source.mjs <qBittorrent-clone> <catalog.json> [output.json] [--shard-index=N --shard-count=M]');
      const shardIndexArg=args.find((arg)=>arg.startsWith('--shard-index='));
      const shardCountArg=args.find((arg)=>arg.startsWith('--shard-count='));
      if(Boolean(shardIndexArg)!==Boolean(shardCountArg))throw new Error('qB locale sharding requires both --shard-index and --shard-count.');
      const fullCatalog=JSON.parse(fs.readFileSync(input,'utf8'));
      let catalog=fullCatalog;
      let shardLabel='full';
      if(shardIndexArg){
        const shardIndex=Number(shardIndexArg.split('=')[1]);
        const shardCount=Number(shardCountArg.split('=')[1]);
        catalog=selectCatalogShard(fullCatalog,shardIndex,shardCount);
        shardLabel=`${shardIndex+1}/${shardCount}`;
      }
      const enriched=enrichCatalogWebuiSourceFacts(catalog,qbRoot);
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(enriched,null,2)+'\n','utf8');
      const resolved=enriched.filter(item=>Array.isArray(item.webuiLocales)&&item.webuiLocales.length).length;
      const mapped=enriched.reduce((sum,item)=>sum+(Number(item.settingsUiMappedPreferences)||0),0);
      const total=enriched.reduce((sum,item)=>sum+(Number(item.settingsUiTotalPreferences)||0),0);
      console.log(`Enriched qB locale/source shard ${shardLabel}: ${resolved}/${enriched.length} release profiles; source-proven Settings labels ${mapped}/${total}.`);
    }
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}
'''
locale = locale[:a] + new_main
write('tools/qb-locale-source.mjs', locale)

locale_test = read('tests/qb-locale-source-contract.mjs')
locale_test = replace_once(
    locale_test,
    "import {extractWebuiLocaleFacts,localeCodesFromPaths,parseExplicitLocaleOptions} from '../tools/qb-locale-source.mjs';",
    "import {extractWebuiLocaleFacts,localeCodesFromPaths,mergeEnrichedCatalogShards,parseExplicitLocaleOptions,selectCatalogShard} from '../tools/qb-locale-source.mjs';",
    'Locale contract imports'
)
shard_test = r'''

const shard0Catalog=selectCatalogShard(catalog,0,2),shard1Catalog=selectCatalogShard(catalog,1,2);
assert.deepEqual(shard0Catalog.map(item=>item.qbVersion),['4.1.0']);
assert.deepEqual(shard1Catalog.map(item=>item.qbVersion),['5.2.3']);
const enrichShard=(part)=>applyQbSettingsTranslationOverlay(part,buildQbSettingsTranslationOverlay(part,()=>({preferencesSource,translationSource:locale=>sourceByLocale[locale]})));
const mergedShards=mergeEnrichedCatalogShards(catalog,[enrichShard(shard1Catalog),enrichShard(shard0Catalog)]);
assert.deepEqual(mergedShards.map(item=>item.qbVersion),catalog.map(item=>item.qbVersion),'shard merge must restore canonical base-catalog release order');
assert.equal(mergedShards.length,catalog.length,'shard merge must retain every exact stable profile');
assert.ok(mergedShards.every(item=>item.settingsUiSource==='qb-upstream-preferences-ui'),'shard merge must preserve exact source-derived Settings ownership');
const mergedSetHashes=new Set(mergedShards.flatMap(item=>Object.keys(item.settingsTranslationSets||{})));
const referencedSetHashes=new Set(mergedShards.flatMap(item=>Object.values(item.settingsTranslations||{})));
assert.deepEqual([...mergedSetHashes].sort(),[...referencedSetHashes].sort(),'shard merge must globally deduplicate but retain every referenced translation set payload');
assert.throws(()=>mergeEnrichedCatalogShards(catalog,[enrichShard(shard0Catalog)]),/Missing enriched qB locale profile/,'incomplete shard sets fail closed');
'''
locale_test = replace_once(locale_test, "\nconsole.log('qB locale source contract passed:", shard_test + "\nconsole.log('qB locale source contract passed:", 'Locale shard merge contract')
write('tests/qb-locale-source-contract.mjs', locale_test)

# ---------------------------------------------------------------------------
# Candidate CI: turn the formerly serial Full qB job into a graph. The 65
# stable profiles are enriched on 8 independent runners, then merged in exact
# base-catalog order. Audit runs in parallel; LKG and PRODUCT run in parallel.
# ---------------------------------------------------------------------------
ci = read('.github/workflows/ci.yml')
new_release_jobs = r'''
  release_fixture:
    name: qB representative fixture compatibility
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: smoke
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Representative fixture compatibility matrix
        run: node tests/release-compat.mjs

  release_catalog_base:
    name: qB exact stable source catalog
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: smoke
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Checkout qBittorrent upstream with all stable release tags
        uses: actions/checkout@v7
        with:
          repository: qbittorrent/qBittorrent
          path: upstream-qb
          fetch-depth: 0
          fetch-tags: true
          filter: blob:none
      - name: Generate source-derived qB 4.1.0 to latest stable catalog
        run: node tools/qb-release-catalog.mjs upstream-qb --output=qb-releases.json
      - name: Upload base stable catalog
        uses: actions/upload-artifact@v7
        with:
          name: qb-release-catalog-base-${{ github.sha }}
          path: qb-releases.json
          if-no-files-found: error
          retention-days: 1

  release_locale_enrich:
    name: qB locale/source enrich shard ${{ matrix.shard }}
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: release_catalog_base
    strategy:
      fail-fast: false
      max-parallel: 8
      matrix:
        shard: [0, 1, 2, 3, 4, 5, 6, 7]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Checkout qBittorrent upstream with all stable release tags
        uses: actions/checkout@v7
        with:
          repository: qbittorrent/qBittorrent
          path: upstream-qb
          fetch-depth: 0
          fetch-tags: true
          filter: blob:none
      - name: Download base stable catalog
        uses: actions/download-artifact@v8
        with:
          name: qb-release-catalog-base-${{ github.sha }}
          path: base-catalog
      - name: Enrich exact qB WebUI locale and Settings source facts for shard
        run: node tools/qb-locale-source.mjs upstream-qb base-catalog/qb-releases.json qb-releases-shard-${{ matrix.shard }}.json --shard-index=${{ matrix.shard }} --shard-count=8
      - name: Upload enriched shard
        uses: actions/upload-artifact@v7
        with:
          name: qb-release-enriched-${{ github.sha }}-${{ matrix.shard }}
          path: qb-releases-shard-${{ matrix.shard }}.json
          if-no-files-found: error
          retention-days: 1

  release_catalog_merge:
    name: Merge exact qB locale/source catalog
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: release_locale_enrich
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Download base stable catalog
        uses: actions/download-artifact@v8
        with:
          name: qb-release-catalog-base-${{ github.sha }}
          path: base-catalog
      - name: Download all enriched qB shards
        uses: actions/download-artifact@v8
        with:
          pattern: qb-release-enriched-${{ github.sha }}-*
          path: enriched-shards
          merge-multiple: true
      - name: Merge enriched shards in canonical release order
        run: node tools/qb-locale-source.mjs --merge base-catalog/qb-releases.json enriched-shards qb-releases.json
      - name: Upload exact stable release catalog
        uses: actions/upload-artifact@v7
        with:
          name: qb-release-catalog-${{ github.sha }}
          path: qb-releases.json
          if-no-files-found: error
          retention-days: 1

  release_upstream_audit:
    name: qB all-stable upstream source audit
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: smoke
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Checkout qBittorrent upstream with all stable release tags
        uses: actions/checkout@v7
        with:
          repository: qbittorrent/qBittorrent
          path: upstream-qb
          fetch-depth: 0
          fetch-tags: true
          filter: blob:none
      - name: Audit every official stable qB release from 4.1.0
        run: node tests/upstream-release-audit.mjs upstream-qb

  release_lkg:
    name: qB Settings translation LKG
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: release_catalog_merge
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Download exact stable release catalog
        uses: actions/download-artifact@v8
        with:
          name: qb-release-catalog-${{ github.sha }}
          path: release-catalog
      - name: Freeze reusable official qB Settings translation LKG
        run: |
          set -euo pipefail
          cp release-catalog/qb-releases.json qb-releases.json
          node tools/qb-settings-translation-lkg.mjs qb-releases.json tests/fixtures/qb-release-catalog.lkg.json qb-settings-translation-lkg.json
          sha256sum qb-settings-translation-lkg.json > qb-settings-translation-lkg.SHA256
          node tests/full-stable-locale-routing-contract.mjs qb-releases.json --require-mapped
          rm -rf "$RUNNER_TEMP/qb-materialized"
          mkdir -p "$RUNNER_TEMP/qb-materialized/private/data"
          node tools/qb-webui-catalog.mjs qb-releases.json "$RUNNER_TEMP/qb-materialized/private/data/qb-releases.json"
          test -s "$RUNNER_TEMP/qb-materialized/private/data/qb-settings-native.txt"
          find "$RUNNER_TEMP/qb-materialized/translations" -type f -name 'webui_*.qm' -print -quit | grep -q .
      - name: Upload certified qB Settings translation LKG
        uses: actions/upload-artifact@v7
        with:
          name: qb-settings-translation-lkg-${{ github.sha }}
          path: |
            qb-settings-translation-lkg.json
            qb-settings-translation-lkg.SHA256
          if-no-files-found: error
          retention-days: 90

  release_product_matrix:
    name: qB full stable PRODUCT compatibility
    if: ${{ (github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]')) }}
    runs-on: ubuntu-latest
    needs: release_catalog_merge
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Download exact stable release catalog
        uses: actions/download-artifact@v8
        with:
          name: qb-release-catalog-${{ github.sha }}
          path: release-catalog
      - name: Full stable PRODUCT compatibility matrix
        run: |
          cp release-catalog/qb-releases.json qb-releases.json
          node tests/full-stable-product-compat.mjs qb-releases.json

  release_compatibility:
    name: Full qB Release compatibility audit
    if: ${{ always() && ((github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'candidate' && github.ref == 'refs/heads/dev') || (github.event_name == 'push' && github.ref == 'refs/heads/dev' && contains(github.event.head_commit.message, '[candidate]'))) }}
    runs-on: ubuntu-latest
    needs:
      - release_fixture
      - release_catalog_merge
      - release_upstream_audit
      - release_lkg
      - release_product_matrix
    steps:
      - name: Require every parallel qB compatibility owner
        env:
          FIXTURE_RESULT: ${{ needs.release_fixture.result }}
          CATALOG_RESULT: ${{ needs.release_catalog_merge.result }}
          UPSTREAM_RESULT: ${{ needs.release_upstream_audit.result }}
          LKG_RESULT: ${{ needs.release_lkg.result }}
          PRODUCT_RESULT: ${{ needs.release_product_matrix.result }}
        run: |
          set -euo pipefail
          for result in "$FIXTURE_RESULT" "$CATALOG_RESULT" "$UPSTREAM_RESULT" "$LKG_RESULT" "$PRODUCT_RESULT"; do
            test "$result" = success
          done
          echo 'Full qB Release compatibility audit passed through parallel exact-SHA owners.'
'''
ci = replace_between(ci, '\n  release_compatibility:\n', '\n  browser:\n', '\n' + new_release_jobs, 'Parallel qB CI graph')
ci = replace_once(
    ci,
    '      - name: Linux installer syntax\n        run: sh -n installers/install.sh',
    '      - name: Linux installer syntax and qB [Preferences] contract\n        run: |\n          sh -n installers/install.sh\n          bash tests/linux-config-section.sh',
    'Linux config contract in smoke'
)
write('.github/workflows/ci.yml', ci)

# CI source contract: assert the graph, 8-way sharding and exact final artifact.
cic = read('tests/ci-contract.mjs')
old_decl = "const ci=read('.github/workflows/ci.yml');\nconst ui=jobSection(ci,'ui_browser','release_compatibility'),releaseCompat=jobSection(ci,'release_compatibility','browser'),linux=jobSection(ci,'browser','windows_browser'),windows=jobSection(ci,'windows_browser','release_candidate'),candidate=jobSection(ci,'release_candidate');"
new_decl = "const ci=read('.github/workflows/ci.yml');\nconst ui=jobSection(ci,'ui_browser','release_fixture'),releaseFixture=jobSection(ci,'release_fixture','release_catalog_base'),releaseBase=jobSection(ci,'release_catalog_base','release_locale_enrich'),releaseEnrich=jobSection(ci,'release_locale_enrich','release_catalog_merge'),releaseMerge=jobSection(ci,'release_catalog_merge','release_upstream_audit'),releaseAudit=jobSection(ci,'release_upstream_audit','release_lkg'),releaseLkg=jobSection(ci,'release_lkg','release_product_matrix'),releaseProduct=jobSection(ci,'release_product_matrix','release_compatibility'),releaseCompat=jobSection(ci,'release_compatibility','browser'),linux=jobSection(ci,'browser','windows_browser'),windows=jobSection(ci,'windows_browser','release_candidate'),candidate=jobSection(ci,'release_candidate');"
cic = replace_once(cic, old_decl, new_decl, 'CI contract job graph declaration')
old_release_asserts = "assert(releaseCompat.includes('from 4.1.0')&&releaseCompat.includes('qb-release-catalog.mjs upstream-qb --output=qb-releases.json'),'candidate compatibility job must generate the exact qB 4.1.0 -> latest stable catalog');\nassert(releaseCompat.includes('node tests/upstream-release-audit.mjs upstream-qb'),'candidate compatibility job must audit every supported stable tag');\nassert(releaseCompat.includes('node tests/full-stable-product-compat.mjs qb-releases.json'),'candidate compatibility job must execute formal product semantics for every generated stable profile');\nassert(releaseCompat.indexOf('qb-release-catalog.mjs upstream-qb --output=qb-releases.json')<releaseCompat.indexOf('full-stable-product-compat.mjs qb-releases.json'),'formal product matrix must consume the exact generated catalog');\nassert(releaseCompat.includes('name: qb-release-catalog-${{ github.sha }}'),'exact stable catalog must cross the job boundary as a SHA-named artifact');"
new_release_asserts = "assert(releaseFixture.includes('node tests/release-compat.mjs'),'candidate compatibility graph must keep the representative fixture matrix');\nassert(releaseBase.includes('from 4.1.0')&&releaseBase.includes('qb-release-catalog.mjs upstream-qb --output=qb-releases.json'),'candidate compatibility graph must generate the exact qB 4.1.0 -> latest stable base catalog');\nassert(/max-parallel:\\s*8/.test(releaseEnrich)&&releaseEnrich.includes('shard: [0, 1, 2, 3, 4, 5, 6, 7]')&&releaseEnrich.includes('--shard-count=8'),'exact locale/source enrichment must fan out across 8 independent runners');\nassert(releaseMerge.includes('qb-locale-source.mjs --merge')&&releaseMerge.includes('name: qb-release-catalog-${{ github.sha }}'),'parallel locale/source shards must merge back into one exact-SHA stable catalog artifact');\nassert(releaseAudit.includes('node tests/upstream-release-audit.mjs upstream-qb'),'candidate compatibility graph must audit every supported stable tag in parallel with locale enrichment');\nassert(releaseProduct.includes('node tests/full-stable-product-compat.mjs qb-releases.json'),'candidate compatibility graph must execute formal product semantics for every merged stable profile');\nassert(releaseLkg.includes('qb-settings-translation-lkg.mjs qb-releases.json')&&releaseLkg.includes('qb-settings-translation-lkg-${{ github.sha }}'),'candidate compatibility graph must freeze and publish the exact certified Settings translation LKG');\nfor(const owner of ['release_fixture','release_catalog_merge','release_upstream_audit','release_lkg','release_product_matrix'])assert(releaseCompat.includes(`- ${owner}`),`Full qB aggregate gate must require ${owner}`);\nassert(releaseCompat.includes('Full qB Release compatibility audit passed through parallel exact-SHA owners.'),'Full qB aggregate gate must expose one clear final result');"
cic = replace_once(cic, old_release_asserts, new_release_asserts, 'CI contract parallel qB assertions')
old_gate_loop = "for(const [name,section] of [['release_compatibility',releaseCompat],['browser',linux],['windows_browser',windows],['release_candidate',candidate]]){"
new_gate_loop = "for(const [name,section] of [['release_fixture',releaseFixture],['release_catalog_base',releaseBase],['release_locale_enrich',releaseEnrich],['release_catalog_merge',releaseMerge],['release_upstream_audit',releaseAudit],['release_lkg',releaseLkg],['release_product_matrix',releaseProduct],['release_compatibility',releaseCompat],['browser',linux],['windows_browser',windows],['release_candidate',candidate]]){"
cic = replace_once(cic, old_gate_loop, new_gate_loop, 'CI contract candidate gate loop')
write('tests/ci-contract.mjs', cic)

print('Applied candidate hardening + 8-way qB compatibility graph patch.')
