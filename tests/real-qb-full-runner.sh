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
((ALLOW_WRITES)) || { echo "--allow-writes is required for the isolated G-FM target" >&2; exit 2; }
for cmd in docker node curl; do command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 2; }; done
NODE_OPTIONS='' node tests/real-qb-full-matrix.mjs --assert-version "$VERSION" >/dev/null

WEIG_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
[[ "$WEIG_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "Exact Git SHA is required" >&2; exit 2; }

EVIDENCE_DIR="${WEIG_REAL_QB_EVIDENCE_DIR:-artifacts/real-qb-full}"
mkdir -p "$EVIDENCE_DIR"
TMP_ROOT="$(mktemp -d)"
ATTEMPTS_FILE="$TMP_ROOT/attempts.tsv"
: > "$ATTEMPTS_FILE"

IMAGE=''
SOURCE_REF=''
PROVIDER=''
MODE=''
PACKAGE_ID=''
RUNTIME_VERSION=''
RUNTIME_IDENTITY=''
PASSWORD=''
NAME=''
NET="weig-gfm-${VERSION//./-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
NETWORK_CREATED=0
CONTAINER_CREATED=0
FINALIZED=0
CLEANUP_RESULT='PENDING'
declare -a CANDIDATES=()
declare -A SEEN_REFS=()

add_candidate() {
  local provider="$1" mode="$2" ref="$3" package="$4"
  [[ -n "${SEEN_REFS[$ref]:-}" ]] && return 0
  SEEN_REFS["$ref"]=1
  CANDIDATES+=("$provider"$'\t'"$mode"$'\t'"$ref"$'\t'"$package")
}

record_attempt() {
  local provider="$1" ref="$2" result="$3" reason="$4"
  reason="${reason//$'\t'/ }"
  reason="${reason//$'\n'/ }"
  printf '%s\t%s\t%s\t%s\n' "$provider" "$ref" "$result" "$reason" >> "$ATTEMPTS_FILE"
}

cleanup_container() {
  local failed=0
  if ((CONTAINER_CREATED)); then
    docker rm -f "$NAME" >/dev/null 2>&1 || failed=1
    CONTAINER_CREATED=0
  fi
  return "$failed"
}

cleanup_all() {
  local failed=0
  cleanup_container || failed=1
  if ((NETWORK_CREATED)); then
    docker network rm "$NET" >/dev/null 2>&1 || failed=1
    NETWORK_CREATED=0
  fi
  rm -rf "$TMP_ROOT" >/dev/null 2>&1 || failed=1
  return "$failed"
}

write_runtime_evidence() {
  local status="$1" reason="${2:-}"
  local attempts_copy="$EVIDENCE_DIR/${WEIG_SHA}-${VERSION}-attempts.tsv"
  cp "$ATTEMPTS_FILE" "$attempts_copy"
  GFM_STATUS="$status" \
  GFM_REASON="$reason" \
  GFM_VERSION="$VERSION" \
  GFM_WEIG_SHA="$WEIG_SHA" \
  GFM_PROVIDER="$PROVIDER" \
  GFM_IMAGE="$IMAGE" \
  GFM_SOURCE_REF="$SOURCE_REF" \
  GFM_PACKAGE_ID="$PACKAGE_ID" \
  GFM_RUNTIME_VERSION="$RUNTIME_VERSION" \
  GFM_RUNTIME_IDENTITY="$RUNTIME_IDENTITY" \
  GFM_CLEANUP_RESULT="$CLEANUP_RESULT" \
  GFM_EVIDENCE_DIR="$EVIDENCE_DIR" \
  GFM_ATTEMPTS_FILE="$attempts_copy" \
  NODE_OPTIONS='' node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const attempts=fs.readFileSync(process.env.GFM_ATTEMPTS_FILE,'utf8').trim().split('\n').filter(Boolean).map(line=>{
  const [provider,source_ref,result,...reason]=line.split('\t');
  return {provider,source_ref,result,reason:reason.join('\t')};
});
const out={
  schemaVersion:2,
  phase:'G-FM',
  module:'runtime-resolver',
  status:process.env.GFM_STATUS,
  reason:process.env.GFM_REASON||null,
  expected_qb_version:process.env.GFM_VERSION,
  weig_sha:process.env.GFM_WEIG_SHA,
  webui_version:fs.readFileSync('VERSION','utf8').trim(),
  frozen_catalog_sha256:manifest.catalogSha256,
  provider:process.env.GFM_PROVIDER||null,
  source_ref:process.env.GFM_SOURCE_REF||null,
  resolved_image:process.env.GFM_IMAGE||null,
  package_id:process.env.GFM_PACKAGE_ID||null,
  runtime_version:process.env.GFM_RUNTIME_VERSION||null,
  runtime_identity:process.env.GFM_RUNTIME_IDENTITY||null,
  platform:'GitHub Actions Ubuntu / isolated Docker network',
  architecture:process.arch,
  deployment_mode:'ephemeral real-qB container; outbound network denied; host access through private internal Docker bridge only',
  remote_service_exposure:'none',
  cleanup_result:process.env.GFM_CLEANUP_RESULT||'PENDING',
  attempts
};
const dir=process.env.GFM_EVIDENCE_DIR;
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,`${process.env.GFM_WEIG_SHA}-${process.env.GFM_VERSION}-runtime.json`),`${JSON.stringify(out,null,2)}\n`);
NODE
  rm -f "$attempts_copy"
  FINALIZED=1
}

# Preserve attempts across final cleanup so evidence can describe every rejected provider.
cleanup_for_final() {
  local failed=0
  cleanup_container || failed=1
  if ((NETWORK_CREATED)); then
    docker network rm "$NET" >/dev/null 2>&1 || failed=1
    NETWORK_CREATED=0
  fi
  return "$failed"
}

finalize() {
  local status="$1" reason="$2" code="$3"
  if cleanup_for_final; then CLEANUP_RESULT='PASS'; else CLEANUP_RESULT='FAIL'; fi
  if [[ "$CLEANUP_RESULT" != 'PASS' && "$status" == 'PASS' ]]; then
    status='FAIL'
    reason='Semantic execution passed but isolated Docker cleanup failed.'
    code=1
  fi
  write_runtime_evidence "$status" "$reason"
  FINALIZED=1
  rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true
  trap - ERR EXIT INT TERM
  exit "$code"
}

on_error() {
  local code=$?
  trap - ERR
  if ((FINALIZED)); then exit "$code"; fi
  local reason="Unhandled G-FM runner failure with exit code ${code}."
  if cleanup_for_final; then CLEANUP_RESULT='PASS'; else CLEANUP_RESULT='FAIL'; fi
  write_runtime_evidence 'FAIL' "$reason" || true
  FINALIZED=1
  rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true
  exit "$code"
}
trap on_error ERR
trap 'if (( ! FINALIZED )); then cleanup_for_final >/dev/null 2>&1 || true; fi; rm -rf "$TMP_ROOT" >/dev/null 2>&1 || true' EXIT INT TERM

resolve_ref() {
  local provider="$1" mode="$2" ref="$3" package="$4"
  if ! docker pull --quiet "$ref" >/dev/null 2>&1; then
    record_attempt "$provider" "$ref" 'UNAVAILABLE' 'image tag could not be pulled'
    return 1
  fi
  local resolved
  resolved="$(docker image inspect "$ref" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
  if [[ "$resolved" != *@sha256:* ]]; then
    record_attempt "$provider" "$ref" 'REJECTED' 'pulled image had no immutable RepoDigest'
    return 1
  fi
  PROVIDER="$provider"
  MODE="$mode"
  SOURCE_REF="$ref"
  IMAGE="$resolved"
  PACKAGE_ID="$package; sourceTag=$ref"
  return 0
}

discover_linuxserver_tags() {
  local tags_json="$TMP_ROOT/linuxserver-tags.json"
  if ! curl -fsSL --retry 2 --connect-timeout 10 --max-time 30 \
    'https://hub.docker.com/v2/repositories/linuxserver/qbittorrent/tags?page_size=1000' > "$tags_json"; then
    return 0
  fi
  VERSION="$VERSION" NODE_OPTIONS='' node --input-type=module - "$tags_json" <<'NODE'
import fs from 'node:fs';
const file=process.argv[2];
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const version=process.env.VERSION;
const esc=version.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const re=new RegExp(`^(?:amd64-)?(?:version-)?${esc}(?=$|[_-]|\\d{8})`);
const names=(Array.isArray(data.results)?data.results:[]).map(x=>String(x?.name||'')).filter(name=>re.test(name));
const score=name=>{
  if(name===version)return 0;
  if(name===`version-${version}`)return 1;
  if(name.startsWith(`${version}_`))return 2;
  if(name.startsWith(`version-${version}_`))return 3;
  if(name.startsWith(`amd64-${version}`))return 4;
  return 5;
};
names.sort((a,b)=>score(a)-score(b)||a.localeCompare(b));
for(const name of names.slice(0,12))console.log(name);
NODE
}

build_candidates() {
  case "$VERSION" in
    4.1.0)
      add_candidate 'wernight' 'wernight' \
        'wernight/qbittorrent@sha256:f4504b29dce8f4cddcc3e0fe2e6a3410269a41e6843ffc8cb99e0c923f3dee4a' \
        'wernight source-built historical qB 4.1.0 image (certified representative pin)'
      ;;
    4.6.7)
      add_candidate 'qbittorrentofficial' 'official' \
        'qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951' \
        'qBittorrent official Docker image 4.6.7-1 (certified representative pin)'
      ;;
    5.0.0)
      add_candidate 'qbittorrentofficial' 'official' \
        'qbittorrentofficial/qbittorrent-nox@sha256:03c968cd9d82c92a90b6ddde6c9a7a4093cf072c329090815c355dabeadd1fc9' \
        'qBittorrent official Docker image 5.0.0-1 (certified representative pin)'
      ;;
    5.2.3)
      add_candidate 'qbittorrentofficial' 'official' \
        'qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7' \
        'qBittorrent official Docker image 5.2.3-1 (certified representative pin)'
      ;;
  esac

  add_candidate 'qbittorrentofficial' 'official' "qbittorrentofficial/qbittorrent-nox:${VERSION}-1" "qBittorrent official Docker image ${VERSION}-1"
  add_candidate 'qbittorrentofficial' 'official' "qbittorrentofficial/qbittorrent-nox:${VERSION}" "qBittorrent official Docker image ${VERSION}"

  for ref in \
    "linuxserver/qbittorrent:${VERSION}" \
    "linuxserver/qbittorrent:version-${VERSION}" \
    "linuxserver/qbittorrent:amd64-${VERSION}" \
    "linuxserver/qbittorrent:amd64-version-${VERSION}"; do
    add_candidate 'linuxserver' 'linuxserver' "$ref" "LinuxServer historical qB ${VERSION} wrapper"
  done

  add_candidate 'crazymax' 'crazymax' "crazymax/qbittorrent:${VERSION}" "CrazyMax historical qB ${VERSION} wrapper"

  while IFS= read -r tag; do
    [[ -n "$tag" ]] || continue
    add_candidate 'linuxserver' 'linuxserver' "linuxserver/qbittorrent:${tag}" "LinuxServer historical qB ${VERSION} discovered tag"
  done < <(discover_linuxserver_tags)
}

start_runtime() {
  NAME="weig-gfm-${VERSION//./-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
  local common=(
    -d -t --name "$NAME" --network "$NET"
  )
  case "$MODE" in
    official)
      docker run "${common[@]}" \
        --tmpfs /config:rw,exec,nosuid,nodev,mode=1777 \
        --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        -e QBT_LEGAL_NOTICE=confirm \
        -e QBT_WEBUI_PORT=8080 \
        -e QBT_TORRENTING_PORT=6881 \
        "$IMAGE" >/dev/null
      ;;
    linuxserver)
      docker run "${common[@]}" \
        --tmpfs /config:rw,exec,nosuid,nodev,mode=1777 \
        --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        -e PUID="$(id -u)" \
        -e PGID="$(id -g)" \
        -e TZ=Etc/UTC \
        -e WEBUI_PORT=8080 \
        -e TORRENTING_PORT=6881 \
        "$IMAGE" >/dev/null
      ;;
    crazymax)
      docker run "${common[@]}" \
        --tmpfs /data:rw,exec,nosuid,nodev,mode=1777 \
        --ulimit nproc=65535 \
        --ulimit nofile=32000:40000 \
        -e PUID="$(id -u)" \
        -e PGID="$(id -g)" \
        -e TZ=Etc/UTC \
        -e WAN_IP=127.0.0.1 \
        -e WEBUI_PORT=8080 \
        "$IMAGE" >/dev/null
      ;;
    wernight)
      docker run "${common[@]}" \
        --tmpfs /config:rw,exec,nosuid,nodev,mode=1777 \
        --tmpfs /torrents:rw,nosuid,nodev,mode=1777 \
        --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        "$IMAGE" >/dev/null
      ;;
    *)
      return 1
      ;;
  esac
  CONTAINER_CREATED=1
}

wait_ready() {
  local ip code state
  ip="$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || true)"
  [[ "$ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || return 1
  TARGET="http://${ip}:8080/"
  for _ in $(seq 1 60); do
    state="$(docker inspect "$NAME" --format '{{.State.Running}}' 2>/dev/null || true)"
    [[ "$state" == 'true' ]] || return 1
    code="$(curl --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 2 "${TARGET}api/v2/app/version" || true)"
    [[ "$code" =~ ^(200|403)$ ]] && return 0
    sleep 1
  done
  return 1
}

runtime_version_with_auth() {
  local candidate_pass="$1"
  local jar="$TMP_ROOT/cookies-${RANDOM}.txt"
  local body
  body="$(curl --silent --show-error --connect-timeout 2 --max-time 5 \
    --cookie-jar "$jar" \
    --data-urlencode 'username=admin' \
    --data-urlencode "password=${candidate_pass}" \
    "${TARGET}api/v2/auth/login" || true)"
  if [[ "$body" != 'Ok.' ]]; then
    rm -f "$jar"
    return 1
  fi
  local reported
  reported="$(curl --silent --show-error --connect-timeout 2 --max-time 5 --cookie "$jar" "${TARGET}api/v2/app/version" || true)"
  rm -f "$jar"
  [[ -n "$reported" ]] || return 1
  printf '%s' "$reported"
}

establish_identity() {
  local temporary=''
  temporary="$(docker logs "$NAME" 2>&1 | sed -n 's/.*temporary password is provided for this session: \([^[:space:]]*\).*/\1/p' | tail -n1)"
  local reported=''
  if [[ -n "$temporary" ]]; then
    reported="$(runtime_version_with_auth "$temporary" || true)"
    if [[ -n "$reported" ]]; then PASSWORD="$temporary"; fi
  fi
  if [[ -z "$reported" ]]; then
    reported="$(runtime_version_with_auth 'adminadmin' || true)"
    if [[ -n "$reported" ]]; then PASSWORD='adminadmin'; fi
  fi
  [[ -n "$reported" ]] || return 1
  local numeric
  numeric="$(printf '%s\n' "$reported" | grep -oE '[0-9]+(\.[0-9]+){2,3}' | head -n1 || true)"
  [[ "$numeric" == "$VERSION" ]] || {
    RUNTIME_VERSION="$reported"
    return 2
  }
  RUNTIME_VERSION="$numeric"
  local binary=''
  binary="$(docker exec "$NAME" sh -lc \
    'qbittorrent-nox --version 2>/dev/null || qbittorrent --version 2>/dev/null || /app/qbittorrent-nox --version 2>/dev/null || /usr/bin/qbittorrent-nox --version 2>/dev/null' \
    | head -n1 | tr -d '\r' || true)"
  RUNTIME_IDENTITY="api=${reported}; binary=${binary:-unavailable}"
  return 0
}

run_semantics() {
  local binary_identity="${PACKAGE_ID}; provider=${PROVIDER}; sourceRef=${SOURCE_REF}; image=${IMAGE}; runtime=${RUNTIME_IDENTITY}"
  local rc=0
  WEIG_QB_URL="$TARGET" \
  WEIG_QB_USER='admin' \
  WEIG_QB_PASS="$PASSWORD" \
  WEIG_GIT_SHA="$WEIG_SHA" \
  WEIG_QB_BINARY_IDENTITY="$binary_identity" \
  WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' \
  WEIG_QB_ARCH="$(uname -m)" \
  WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB container; outbound network denied; host access through private internal bridge only' \
  WEIG_QB_INSTALL_MODE="$PACKAGE_ID" \
  WEIG_QB_REVERSE_PROXY='none' \
  WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" \
  node tests/real-qb-harness.mjs --allow-writes || rc=$?
  ((rc==0)) || return "$rc"

  WEIG_QB_URL="$TARGET" \
  WEIG_QB_USER='admin' \
  WEIG_QB_PASS="$PASSWORD" \
  WEIG_GIT_SHA="$WEIG_SHA" \
  WEIG_QB_BINARY_IDENTITY="$binary_identity" \
  WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' \
  WEIG_QB_ARCH="$(uname -m)" \
  WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB container; outbound network denied; host access through private internal bridge only' \
  WEIG_QB_INSTALL_MODE="$PACKAGE_ID" \
  WEIG_QB_REVERSE_PROXY='none' \
  WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" \
  node tests/real-qb-search.mjs || rc=$?
  return "$rc"
}

docker network create --internal "$NET" >/dev/null
NETWORK_CREATED=1
build_candidates

RUNTIME_ESTABLISHED=0
for candidate in "${CANDIDATES[@]}"; do
  IFS=$'\t' read -r candidate_provider candidate_mode candidate_ref candidate_package <<< "$candidate"
  if ! resolve_ref "$candidate_provider" "$candidate_mode" "$candidate_ref" "$candidate_package"; then
    continue
  fi

  NAME=''
  CONTAINER_CREATED=0
  if ! start_runtime; then
    record_attempt "$PROVIDER" "$SOURCE_REF" 'START_FAILED' 'docker run failed under documented provider contract'
    cleanup_container >/dev/null 2>&1 || true
    continue
  fi
  if ! wait_ready; then
    local_state="$(docker inspect "$NAME" --format 'running={{.State.Running}} exit={{.State.ExitCode}}' 2>/dev/null || true)"
    record_attempt "$PROVIDER" "$SOURCE_REF" 'NOT_READY' "WebUI/API did not become ready; ${local_state:-container state unavailable}"
    cleanup_container >/dev/null 2>&1 || true
    continue
  fi

  set +e
  establish_identity
  identity_rc=$?
  set -e
  if ((identity_rc != 0)); then
    if ((identity_rc == 2)); then
      record_attempt "$PROVIDER" "$SOURCE_REF" 'IDENTITY_MISMATCH' "expected qB ${VERSION}, got ${RUNTIME_VERSION:-unknown}"
    else
      record_attempt "$PROVIDER" "$SOURCE_REF" 'AUTH_OR_IDENTITY_FAILED' 'could not authenticate and read exact runtime version'
    fi
    cleanup_container >/dev/null 2>&1 || true
    continue
  fi

  record_attempt "$PROVIDER" "$SOURCE_REF" 'RUNTIME_ESTABLISHED' "exact qB ${VERSION} identity established"
  RUNTIME_ESTABLISHED=1
  break
done

if (( ! RUNTIME_ESTABLISHED )); then
  finalize 'BLOCKED' 'No approved historical provider produced a reachable, authenticated exact-version qB runtime under its documented container contract.' 3
fi

if ! run_semantics; then
  finalize 'FAIL' 'Exact qB runtime was established, but the real semantic/API evidence harness failed.' 1
fi

finalize 'PASS' '' 0
