#!/usr/bin/env bash
set -Eeuo pipefail
VERSION=''
ALLOW_WRITES=0
SESSION_HANDSHAKE=0
PROVIDER_LANE='all'
RUN_STARTED_EPOCH="$(date +%s)"
while (($#)); do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --allow-writes) ALLOW_WRITES=1; shift ;;
    --session-handshake) SESSION_HANDSHAKE=1; shift ;;
    --provider-lane) PROVIDER_LANE="${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2,3}$ ]] || { echo "--version must be an exact qB stable version" >&2; exit 2; }
case "$PROVIDER_LANE" in all|images|indexed|source) ;; *) echo "--provider-lane must be one of: all, images, indexed, source" >&2; exit 2 ;; esac
((ALLOW_WRITES)) || { echo "--allow-writes is required" >&2; exit 2; }
for cmd in docker node curl sha256sum; do command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 2; }; done
NODE_OPTIONS='' node tests/real-qb-full-matrix.mjs --assert-version "$VERSION" >/dev/null
WEIG_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
[[ "$WEIG_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "Exact Git SHA is required" >&2; exit 2; }
INDEX_FILE="${WEIG_GFM_RUNTIME_INDEX:-runtime-index/linuxserver-tags.json}"
[[ -s "$INDEX_FILE" ]] || { echo "Historical runtime index is required" >&2; exit 2; }
INDEX_SHA="$(sha256sum "$INDEX_FILE" | awk '{print $1}')"
NODE_OPTIONS='' node --input-type=module - "$INDEX_FILE" "$VERSION" <<'NODE'
import fs from 'node:fs';
const [file,version]=process.argv.slice(2);
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
if(data.phase!=='G-FM'||data.provider!=='linuxserver/qbittorrent')throw new Error('Unexpected runtime index identity.');
if(data.frozenCatalogSha256!==manifest.catalogSha256||data.frozenProfileCount!==manifest.profileCount)throw new Error('Runtime index Frozen identity mismatch.');
if(!Array.isArray(data.tagsByVersion?.[version]))throw new Error(`Runtime index has no entry for qB ${version}.`);
NODE

EVIDENCE_DIR="${WEIG_REAL_QB_EVIDENCE_DIR:-artifacts/real-qb-full}"
mkdir -p "$EVIDENCE_DIR"
TMP_ROOT="$(mktemp -d)"
SESSION_STAGE=''
prepare_session_handshake_stage(){
  SESSION_STAGE="$TMP_ROOT/session-handshake-webui"
  mkdir -p "$SESSION_STAGE"
  cp -a webui/. "$SESSION_STAGE/"
  if find "$SESSION_STAGE" -type l -print -quit | grep -q .; then
    echo 'Session handshake staging contains a symlink; qB rejects Alternative WebUI symlinks.' >&2
    return 1
  fi
  local webui_version
  webui_version="$(tr -d '\r\n' < VERSION)"
  [[ "$webui_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Session handshake staging requires a canonical semantic VERSION.' >&2; return 1; }
  while IFS= read -r -d '' file; do
    sed -i -e "s/__WEIG_GIT_SHA__/${WEIG_SHA}/g" -e "s/__WEIG_VERSION__/${webui_version}/g" "$file"
  done < <(find "$SESSION_STAGE" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) -print0)
  printf '%s\n' "$WEIG_SHA" > "$SESSION_STAGE/GIT_SHA"
  if grep -R -l --include='*.html' --include='*.js' --include='*.css' --include='*.json' --include='GIT_SHA' -e '__WEIG_GIT_SHA__' -e '__WEIG_VERSION__' "$SESSION_STAGE" | grep -q .; then
    echo 'Session handshake staging still contains an unresolved product identity placeholder.' >&2
    return 1
  fi
  WEIG_GFM_ALT_WEBUI_STAGE="$SESSION_STAGE"
}
if ((SESSION_HANDSHAKE)); then prepare_session_handshake_stage; fi
ATTEMPTS_FILE="$TMP_ROOT/attempts.tsv"
: > "$ATTEMPTS_FILE"
IMAGE=''; SOURCE_REF=''; PROVIDER=''; MODE=''; PACKAGE_ID=''; RUNTIME_VERSION=''; RUNTIME_IDENTITY=''; PASSWORD=''; TARGET=''; NAME=''; BUILDX_BUILDER=''
NET="weig-gfm-${VERSION//./-}-${PROVIDER_LANE//[^a-zA-Z0-9]/-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
NETWORK_CREATED=0; CONTAINER_CREATED=0; FINALIZED=0; CLEANUP_RESULT='PENDING'
declare -A SEEN_REFS=()

record_attempt(){ local p="$1" r="$2" result="$3" reason="$4"; reason="${reason//$'\t'/ }"; reason="${reason//$'\n'/ }"; printf '%s\t%s\t%s\t%s\n' "$p" "$r" "$result" "$reason" >> "$ATTEMPTS_FILE"; }
log_stage(){ printf '[gfm][%ss][qB %s][lane=%s] %s\n' "$(( $(date +%s) - RUN_STARTED_EPOCH ))" "$VERSION" "$PROVIDER_LANE" "$*"; }
cleanup_container(){ local failed=0; if ((CONTAINER_CREATED)); then docker rm -f "$NAME" >/dev/null 2>&1 || failed=1; CONTAINER_CREATED=0; fi; return "$failed"; }
cleanup_buildx(){ local failed=0; if [[ -n "$BUILDX_BUILDER" ]]; then docker buildx rm --force "$BUILDX_BUILDER" >/dev/null 2>&1 || failed=1; BUILDX_BUILDER=''; fi; return "$failed"; }
cleanup_for_final(){ local failed=0; cleanup_container || failed=1; cleanup_buildx || failed=1; if ((NETWORK_CREATED)); then docker network rm "$NET" >/dev/null 2>&1 || failed=1; NETWORK_CREATED=0; fi; return "$failed"; }
write_runtime_evidence(){
  local status="$1" reason="${2:-}" attempts_copy="$EVIDENCE_DIR/${WEIG_SHA}-${VERSION}-attempts.tsv"
  cp "$ATTEMPTS_FILE" "$attempts_copy"
  GFM_STATUS="$status" GFM_REASON="$reason" GFM_VERSION="$VERSION" GFM_WEIG_SHA="$WEIG_SHA" GFM_PROVIDER="$PROVIDER" GFM_IMAGE="$IMAGE" GFM_SOURCE_REF="$SOURCE_REF" GFM_PACKAGE_ID="$PACKAGE_ID" GFM_RUNTIME_VERSION="$RUNTIME_VERSION" GFM_RUNTIME_IDENTITY="$RUNTIME_IDENTITY" GFM_CLEANUP_RESULT="$CLEANUP_RESULT" GFM_EVIDENCE_DIR="$EVIDENCE_DIR" GFM_ATTEMPTS_FILE="$attempts_copy" GFM_INDEX_SHA="$INDEX_SHA" GFM_PROVIDER_LANE="$PROVIDER_LANE" GFM_DURATION_SECONDS="$(( $(date +%s) - RUN_STARTED_EPOCH ))" NODE_OPTIONS='' node --input-type=module <<'NODE'
import fs from 'node:fs'; import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const attempts=fs.readFileSync(process.env.GFM_ATTEMPTS_FILE,'utf8').trim().split('\n').filter(Boolean).map(line=>{const [provider,source_ref,result,...reason]=line.split('\t');return {provider,source_ref,result,reason:reason.join('\t')};});
const out={schemaVersion:3,phase:'G-FM',module:'runtime-resolver',status:process.env.GFM_STATUS,reason:process.env.GFM_REASON||null,expected_qb_version:process.env.GFM_VERSION,weig_sha:process.env.GFM_WEIG_SHA,webui_version:fs.readFileSync('VERSION','utf8').trim(),frozen_catalog_sha256:manifest.catalogSha256,runtime_index_sha256:process.env.GFM_INDEX_SHA,provider_lane:process.env.GFM_PROVIDER_LANE||'all',duration_seconds:Number(process.env.GFM_DURATION_SECONDS||0),source_cache_scope:process.env.WEIG_GFM_SOURCE_CACHE_SCOPE||null,provider:process.env.GFM_PROVIDER||null,source_ref:process.env.GFM_SOURCE_REF||null,resolved_image:process.env.GFM_IMAGE||null,package_id:process.env.GFM_PACKAGE_ID||null,runtime_version:process.env.GFM_RUNTIME_VERSION||null,runtime_identity:process.env.GFM_RUNTIME_IDENTITY||null,platform:'GitHub Actions Ubuntu / isolated Docker network',architecture:process.arch,deployment_mode:'ephemeral real-qB container; outbound network denied; host access through private internal Docker bridge only',remote_service_exposure:'none',cleanup_result:process.env.GFM_CLEANUP_RESULT||'PENDING',attempts};
const dir=process.env.GFM_EVIDENCE_DIR; fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,`${process.env.GFM_WEIG_SHA}-${process.env.GFM_VERSION}-runtime.json`),`${JSON.stringify(out,null,2)}\n`);
NODE
  rm -f "$attempts_copy"; FINALIZED=1
}
finalize(){ local status="$1" reason="$2" code="$3"; if cleanup_for_final; then CLEANUP_RESULT='PASS'; else CLEANUP_RESULT='FAIL'; fi; if [[ "$CLEANUP_RESULT" != PASS && "$status" == PASS ]]; then status='FAIL'; reason='Semantic execution passed but isolated Docker cleanup failed.'; code=1; fi; write_runtime_evidence "$status" "$reason"; FINALIZED=1; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true; trap - ERR EXIT INT TERM; exit "$code"; }
on_error(){ local code=$?; trap - ERR; if ((FINALIZED)); then exit "$code"; fi; if cleanup_for_final; then CLEANUP_RESULT='PASS'; else CLEANUP_RESULT='FAIL'; fi; write_runtime_evidence 'FAIL' "Unhandled G-FM runner failure with exit code ${code}." || true; FINALIZED=1; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true; exit "$code"; }
on_signal(){ trap - INT TERM; if (( ! FINALIZED )); then cleanup_for_final >/dev/null 2>&1 || true; FINALIZED=1; fi; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true; exit 143; }
trap on_error ERR
trap 'if (( ! FINALIZED )); then cleanup_for_final >/dev/null 2>&1 || true; fi; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true' EXIT
trap on_signal INT TERM

. "$(dirname "$0")/real-qb-full-provider-lib.sh"

run_semantics(){
  local identity="${PACKAGE_ID}; provider=${PROVIDER}; sourceRef=${SOURCE_REF}; image=${IMAGE}; runtime=${RUNTIME_IDENTITY}" rc=0
  WEIG_QB_URL="$TARGET" WEIG_QB_USER=admin WEIG_QB_PASS="$PASSWORD" WEIG_GIT_SHA="$WEIG_SHA" WEIG_QB_BINARY_IDENTITY="$identity" WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' WEIG_QB_ARCH="$(uname -m)" WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB container; outbound network denied; host access through private internal bridge only' WEIG_QB_INSTALL_MODE="$PACKAGE_ID" WEIG_QB_REVERSE_PROXY=none WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" node tests/real-qb-harness.mjs --allow-writes || rc=$?; ((rc==0)) || return "$rc"
  WEIG_QB_URL="$TARGET" WEIG_QB_USER=admin WEIG_QB_PASS="$PASSWORD" WEIG_GIT_SHA="$WEIG_SHA" WEIG_QB_BINARY_IDENTITY="$identity" WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' WEIG_QB_ARCH="$(uname -m)" WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB container; outbound network denied; host access through private internal bridge only' WEIG_QB_INSTALL_MODE="$PACKAGE_ID" WEIG_QB_REVERSE_PROXY=none WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" node tests/real-qb-search.mjs || rc=$?; return "$rc"
}

run_session_handshake(){
  local identity="${PACKAGE_ID}; provider=${PROVIDER}; sourceRef=${SOURCE_REF}; image=${IMAGE}; runtime=${RUNTIME_IDENTITY}"
  WEIG_QB_URL="$TARGET" WEIG_QB_USER=admin WEIG_QB_PASS="$PASSWORD" WEIG_QB_VERSION="$VERSION" WEIG_GIT_SHA="$WEIG_SHA" WEIG_QB_BINARY_IDENTITY="$identity" WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' WEIG_QB_ARCH="$(uname -m)" WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB Docker; outbound network denied; browser access through private internal bridge only' WEIG_QB_INSTALL_MODE="$PACKAGE_ID" WEIG_QB_REVERSE_PROXY=none WEIG_QB_ALT_WEBUI_PATH='/weig-webui' WEIG_QB_CONTAINER_NAME="$NAME" WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" node tests/real-qb-session-handshake.mjs
}
historical_tags(){ NODE_OPTIONS='' node --input-type=module - "$INDEX_FILE" "$VERSION" <<'NODE'
import fs from 'node:fs'; const [file,version]=process.argv.slice(2); const data=JSON.parse(fs.readFileSync(file,'utf8')); for(const tag of data.tagsByVersion?.[version]||[]) console.log(tag);
NODE
}

docker network create --internal "$NET" >/dev/null; NETWORK_CREATED=1
RUNTIME_ESTABLISHED=0
try_direct_image_lane(){
  case "$VERSION" in
    4.1.0) if try_candidate wernight wernight 'wernight/qbittorrent@sha256:f4504b29dce8f4cddcc3e0fe2e6a3410269a41e6843ffc8cb99e0c923f3dee4a' 'wernight source-built historical qB 4.1.0 image (certified representative pin)'; then return 0; fi ;;
    4.6.7) if try_candidate qbittorrentofficial official 'qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951' 'qBittorrent official Docker image 4.6.7-1 (certified representative pin)'; then return 0; fi ;;
    5.0.0) if try_candidate qbittorrentofficial official 'qbittorrentofficial/qbittorrent-nox@sha256:03c968cd9d82c92a90b6ddde6c9a7a4093cf072c329090815c355dabeadd1fc9' 'qBittorrent official Docker image 5.0.0-1 (certified representative pin)'; then return 0; fi ;;
    5.2.3) if try_candidate qbittorrentofficial official 'qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7' 'qBittorrent official Docker image 5.2.3-1 (certified representative pin)'; then return 0; fi ;;
  esac
  for ref in "qbittorrentofficial/qbittorrent-nox:${VERSION}-1" "qbittorrentofficial/qbittorrent-nox:${VERSION}"; do if try_candidate qbittorrentofficial official "$ref" "qBittorrent official Docker image ${VERSION}"; then return 0; fi; done
  for ref in "linuxserver/qbittorrent:${VERSION}" "linuxserver/qbittorrent:version-${VERSION}" "linuxserver/qbittorrent:amd64-${VERSION}" "linuxserver/qbittorrent:amd64-version-${VERSION}"; do if try_candidate linuxserver linuxserver "$ref" "LinuxServer historical qB ${VERSION} wrapper"; then return 0; fi; done
  if try_candidate crazymax crazymax "crazymax/qbittorrent:${VERSION}" "CrazyMax historical qB ${VERSION} wrapper"; then return 0; fi
  return 1
}
try_indexed_image_lane(){
  while IFS= read -r tag; do [[ -n "$tag" ]] || continue; if try_candidate linuxserver linuxserver "linuxserver/qbittorrent:${tag}" "LinuxServer historical qB ${VERSION} indexed tag"; then return 0; fi; done < <(historical_tags)
  return 1
}
try_source_lane(){ try_frozen_source_candidate; }

log_stage "runtime resolution started"
case "$PROVIDER_LANE" in
  images) if try_direct_image_lane; then RUNTIME_ESTABLISHED=1; fi ;;
  indexed) if try_indexed_image_lane; then RUNTIME_ESTABLISHED=1; fi ;;
  source) if try_source_lane; then RUNTIME_ESTABLISHED=1; fi ;;
  all)
    if try_direct_image_lane; then RUNTIME_ESTABLISHED=1; fi
    if (( ! RUNTIME_ESTABLISHED )) && try_indexed_image_lane; then RUNTIME_ESTABLISHED=1; fi
    if (( ! RUNTIME_ESTABLISHED )) && try_source_lane; then RUNTIME_ESTABLISHED=1; fi
    ;;
esac
if ((RUNTIME_ESTABLISHED)); then log_stage "runtime established provider=${PROVIDER:-unknown}"; fi
if (( ! RUNTIME_ESTABLISHED )); then finalize BLOCKED 'No approved historical provider or Frozen official-source profile produced a reachable, authenticated exact-version qB runtime.' 3; fi
if ((SESSION_HANDSHAKE)); then
  log_stage "browser session handshake started"
  if ! run_session_handshake; then finalize FAIL 'Exact qB runtime was established, but the browser session contract failed.' 1; fi
else
  if ! run_semantics; then finalize FAIL 'Exact qB runtime was established, but the real semantic/API evidence harness failed.' 1; fi
fi
finalize PASS '' 0
