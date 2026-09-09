#!/usr/bin/env bash
set -Eeuo pipefail
VERSION=''
ALLOW_WRITES=0
while (($#)); do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --allow-writes) ALLOW_WRITES=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2,3}$ ]] || { echo "--version must be an exact qB stable version" >&2; exit 2; }
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
ATTEMPTS_FILE="$TMP_ROOT/attempts.tsv"
: > "$ATTEMPTS_FILE"
IMAGE=''; SOURCE_REF=''; PROVIDER=''; MODE=''; PACKAGE_ID=''; RUNTIME_VERSION=''; RUNTIME_IDENTITY=''; PASSWORD=''; TARGET=''; NAME=''
NET="weig-gfm-${VERSION//./-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
NETWORK_CREATED=0; CONTAINER_CREATED=0; FINALIZED=0; CLEANUP_RESULT='PENDING'
declare -A SEEN_REFS=()

record_attempt(){ local p="$1" r="$2" result="$3" reason="$4"; reason="${reason//$'\t'/ }"; reason="${reason//$'\n'/ }"; printf '%s\t%s\t%s\t%s\n' "$p" "$r" "$result" "$reason" >> "$ATTEMPTS_FILE"; }
cleanup_container(){ local failed=0; if ((CONTAINER_CREATED)); then docker rm -f "$NAME" >/dev/null 2>&1 || failed=1; CONTAINER_CREATED=0; fi; return "$failed"; }
cleanup_for_final(){ local failed=0; cleanup_container || failed=1; if ((NETWORK_CREATED)); then docker network rm "$NET" >/dev/null 2>&1 || failed=1; NETWORK_CREATED=0; fi; return "$failed"; }
write_runtime_evidence(){
  local status="$1" reason="${2:-}" attempts_copy="$EVIDENCE_DIR/${WEIG_SHA}-${VERSION}-attempts.tsv"
  cp "$ATTEMPTS_FILE" "$attempts_copy"
  GFM_STATUS="$status" GFM_REASON="$reason" GFM_VERSION="$VERSION" GFM_WEIG_SHA="$WEIG_SHA" GFM_PROVIDER="$PROVIDER" GFM_IMAGE="$IMAGE" GFM_SOURCE_REF="$SOURCE_REF" GFM_PACKAGE_ID="$PACKAGE_ID" GFM_RUNTIME_VERSION="$RUNTIME_VERSION" GFM_RUNTIME_IDENTITY="$RUNTIME_IDENTITY" GFM_CLEANUP_RESULT="$CLEANUP_RESULT" GFM_EVIDENCE_DIR="$EVIDENCE_DIR" GFM_ATTEMPTS_FILE="$attempts_copy" GFM_INDEX_SHA="$INDEX_SHA" NODE_OPTIONS='' node --input-type=module <<'NODE'
import fs from 'node:fs'; import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const attempts=fs.readFileSync(process.env.GFM_ATTEMPTS_FILE,'utf8').trim().split('\n').filter(Boolean).map(line=>{const [provider,source_ref,result,...reason]=line.split('\t');return {provider,source_ref,result,reason:reason.join('\t')};});
const out={schemaVersion:3,phase:'G-FM',module:'runtime-resolver',status:process.env.GFM_STATUS,reason:process.env.GFM_REASON||null,expected_qb_version:process.env.GFM_VERSION,weig_sha:process.env.GFM_WEIG_SHA,webui_version:fs.readFileSync('VERSION','utf8').trim(),frozen_catalog_sha256:manifest.catalogSha256,runtime_index_sha256:process.env.GFM_INDEX_SHA,provider:process.env.GFM_PROVIDER||null,source_ref:process.env.GFM_SOURCE_REF||null,resolved_image:process.env.GFM_IMAGE||null,package_id:process.env.GFM_PACKAGE_ID||null,runtime_version:process.env.GFM_RUNTIME_VERSION||null,runtime_identity:process.env.GFM_RUNTIME_IDENTITY||null,platform:'GitHub Actions Ubuntu / isolated Docker network',architecture:process.arch,deployment_mode:'ephemeral real-qB container; outbound network denied; host access through private internal Docker bridge only',remote_service_exposure:'none',cleanup_result:process.env.GFM_CLEANUP_RESULT||'PENDING',attempts};
const dir=process.env.GFM_EVIDENCE_DIR; fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,`${process.env.GFM_WEIG_SHA}-${process.env.GFM_VERSION}-runtime.json`),`${JSON.stringify(out,null,2)}\n`);
NODE
  rm -f "$attempts_copy"; FINALIZED=1
}
finalize(){ local status="$1" reason="$2" code="$3"; if cleanup_for_final; then CLEANUP_RESULT='PASS'; else CLEANUP_RESULT='FAIL'; fi; if [[ "$CLEANUP_RESULT" != PASS && "$status" == PASS ]]; then status='FAIL'; reason='Semantic execution passed but isolated Docker cleanup failed.'; code=1; fi; write_runtime_evidence "$status" "$reason"; FINALIZED=1; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true; trap - ERR EXIT INT TERM; exit "$code"; }
on_error(){ local code=$?; trap - ERR; if ((FINALIZED)); then exit "$code"; fi; if cleanup_for_final; then CLEANUP_RESULT='PASS'; else CLEANUP_RESULT='FAIL'; fi; write_runtime_evidence 'FAIL' "Unhandled G-FM runner failure with exit code ${code}." || true; FINALIZED=1; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true; exit "$code"; }
trap on_error ERR
trap 'if (( ! FINALIZED )); then cleanup_for_final >/dev/null 2>&1 || true; fi; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true' EXIT INT TERM

. "$(dirname "$0")/real-qb-full-provider-lib.sh"

run_semantics(){
  local identity="${PACKAGE_ID}; provider=${PROVIDER}; sourceRef=${SOURCE_REF}; image=${IMAGE}; runtime=${RUNTIME_IDENTITY}" rc=0
  WEIG_QB_URL="$TARGET" WEIG_QB_USER=admin WEIG_QB_PASS="$PASSWORD" WEIG_GIT_SHA="$WEIG_SHA" WEIG_QB_BINARY_IDENTITY="$identity" WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' WEIG_QB_ARCH="$(uname -m)" WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB container; outbound network denied; host access through private internal bridge only' WEIG_QB_INSTALL_MODE="$PACKAGE_ID" WEIG_QB_REVERSE_PROXY=none WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" node tests/real-qb-harness.mjs --allow-writes || rc=$?; ((rc==0)) || return "$rc"
  WEIG_QB_URL="$TARGET" WEIG_QB_USER=admin WEIG_QB_PASS="$PASSWORD" WEIG_GIT_SHA="$WEIG_SHA" WEIG_QB_BINARY_IDENTITY="$identity" WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' WEIG_QB_ARCH="$(uname -m)" WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB container; outbound network denied; host access through private internal bridge only' WEIG_QB_INSTALL_MODE="$PACKAGE_ID" WEIG_QB_REVERSE_PROXY=none WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" node tests/real-qb-search.mjs || rc=$?; return "$rc"
}

historical_tags(){ NODE_OPTIONS='' node --input-type=module - "$INDEX_FILE" "$VERSION" <<'NODE'
import fs from 'node:fs'; const [file,version]=process.argv.slice(2); const data=JSON.parse(fs.readFileSync(file,'utf8')); for(const tag of data.tagsByVersion?.[version]||[]) console.log(tag);
NODE
}

docker network create --internal "$NET" >/dev/null; NETWORK_CREATED=1
RUNTIME_ESTABLISHED=0
case "$VERSION" in
  4.1.0) if try_candidate wernight wernight 'wernight/qbittorrent@sha256:f4504b29dce8f4cddcc3e0fe2e6a3410269a41e6843ffc8cb99e0c923f3dee4a' 'wernight source-built historical qB 4.1.0 image (certified representative pin)'; then RUNTIME_ESTABLISHED=1; fi ;;
  4.6.7) if try_candidate qbittorrentofficial official 'qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951' 'qBittorrent official Docker image 4.6.7-1 (certified representative pin)'; then RUNTIME_ESTABLISHED=1; fi ;;
  5.0.0) if try_candidate qbittorrentofficial official 'qbittorrentofficial/qbittorrent-nox@sha256:03c968cd9d82c92a90b6ddde6c9a7a4093cf072c329090815c355dabeadd1fc9' 'qBittorrent official Docker image 5.0.0-1 (certified representative pin)'; then RUNTIME_ESTABLISHED=1; fi ;;
  5.2.3) if try_candidate qbittorrentofficial official 'qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7' 'qBittorrent official Docker image 5.2.3-1 (certified representative pin)'; then RUNTIME_ESTABLISHED=1; fi ;;
esac
if (( ! RUNTIME_ESTABLISHED )); then for ref in "qbittorrentofficial/qbittorrent-nox:${VERSION}-1" "qbittorrentofficial/qbittorrent-nox:${VERSION}"; do if try_candidate qbittorrentofficial official "$ref" "qBittorrent official Docker image ${VERSION}"; then RUNTIME_ESTABLISHED=1; break; fi; done; fi
if (( ! RUNTIME_ESTABLISHED )); then for ref in "linuxserver/qbittorrent:${VERSION}" "linuxserver/qbittorrent:version-${VERSION}" "linuxserver/qbittorrent:amd64-${VERSION}" "linuxserver/qbittorrent:amd64-version-${VERSION}"; do if try_candidate linuxserver linuxserver "$ref" "LinuxServer historical qB ${VERSION} wrapper"; then RUNTIME_ESTABLISHED=1; break; fi; done; fi
if (( ! RUNTIME_ESTABLISHED )); then if try_candidate crazymax crazymax "crazymax/qbittorrent:${VERSION}" "CrazyMax historical qB ${VERSION} wrapper"; then RUNTIME_ESTABLISHED=1; fi; fi
if (( ! RUNTIME_ESTABLISHED )); then while IFS= read -r tag; do [[ -n "$tag" ]] || continue; if try_candidate linuxserver linuxserver "linuxserver/qbittorrent:${tag}" "LinuxServer historical qB ${VERSION} indexed tag"; then RUNTIME_ESTABLISHED=1; break; fi; done < <(historical_tags); fi
if (( ! RUNTIME_ESTABLISHED )); then finalize BLOCKED 'No approved historical provider produced a reachable, authenticated exact-version qB runtime under its documented container contract.' 3; fi
if ! run_semantics; then finalize FAIL 'Exact qB runtime was established, but the real semantic/API evidence harness failed.' 1; fi
finalize PASS '' 0
