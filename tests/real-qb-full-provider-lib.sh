# Sourced by real-qb-full-runner.sh. Uses the runner's exact-version globals.
readonly GFM_PRESET_PASSWORD='Wei.G'
readonly GFM_CHANGED_PASSWORD='Wei.G1'
readonly GFM_SOURCE_BASE_IMAGE='ubuntu:20.04@sha256:8feb4d8ca5354def3d8fce243717141ce31e2c428701f6682bd2fafe15388214'

gfm_auth_lifecycle_version(){
  [[ "$VERSION" =~ ^5\.2\.[0-9]+$ ]]
}
# qB 5.2.x source contract: real auth lifecycle must prove a QBT_SID_* cookie.

gfm_cookie_jar_has_session(){
  local jar="$1"
  awk -F '\t' '
    NF >= 7 && ($1 !~ /^#/ || $1 ~ /^#HttpOnly_/) && length($6) > 0 && length($7) > 0 { found=1 }
    END { exit(found ? 0 : 1) }
  ' "$jar" 2>/dev/null
}

prepare_modern_auth_profile(){
  AUTH_PROFILE="$TMP_ROOT/auth-profile-${RANDOM}"
  local secret=''
  secret="$(WEIG_QB_PRESET_PASSWORD="$GFM_PRESET_PASSWORD" NODE_OPTIONS='' node --input-type=module <<'NODE'
import crypto from 'node:crypto';
const password=process.env.WEIG_QB_PRESET_PASSWORD;
if(!password)process.exit(2);
const salt=crypto.randomBytes(16);
const key=crypto.pbkdf2Sync(Buffer.from(password,'utf8'),salt,100000,64,'sha512');
process.stdout.write(`${salt.toString('base64')}:${key.toString('base64')}`);
NODE
)" || return 1
  [[ "$secret" == *:* ]] || return 1
  mkdir -p "$AUTH_PROFILE/qBittorrent/config" "$AUTH_PROFILE/qBittorrent"
  local conf
  for conf in "$AUTH_PROFILE/qBittorrent/config/qBittorrent.conf" "$AUTH_PROFILE/qBittorrent/qBittorrent.conf"; do
    cat > "$conf" <<EOF_CONF
[BitTorrent]
Session\\DefaultSavePath=/downloads
Session\\Port=6881
Session\\TempPath=/downloads/temp
Session\\TempPathEnabled=true
[Meta]
MigrationVersion=9999
[Preferences]
WebUI\\Port=8080
WebUI\\Username=admin
WebUI\\Password_PBKDF2="@ByteArray(${secret})"
EOF_CONF
  done
  chmod -R u+rwX,go+rX "$AUTH_PROFILE"
}

resolve_ref(){
  local provider="$1" mode="$2" ref="$3" package="$4"
  [[ -n "${SEEN_REFS[$ref]:-}" ]] && return 1
  SEEN_REFS["$ref"]=1
  if ! docker pull --quiet "$ref" >/dev/null 2>&1; then
    record_attempt "$provider" "$ref" UNAVAILABLE 'image tag could not be pulled'
    return 1
  fi
  local resolved
  resolved="$(docker image inspect "$ref" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
  if [[ "$resolved" != *@sha256:* ]]; then
    record_attempt "$provider" "$ref" REJECTED 'pulled image had no immutable RepoDigest'
    return 1
  fi
  PROVIDER="$provider"; MODE="$mode"; SOURCE_REF="$ref"; IMAGE="$resolved"
  PACKAGE_ID="$package; sourceTag=$ref"
}

# Centralized historical build/runtime profile. Product/WebUI capability behavior
# remains release-profile driven; this mapping only describes how to materialize an
# otherwise unavailable exact historical qB runtime for the evidence harness.
frozen_source_build_profile(){
  case "$VERSION" in
    4.1.2)
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
        'libtorrent-1_1_14' \
        '244f0f189ba8ab9801e7fcf553beebfb83d7c86b' \
        'autotools' \
        'n/a' \
        'webui-wildcard-string' \
        "$GFM_SOURCE_BASE_IMAGE"
      ;;
    4.1.*)
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
        'libtorrent-1_1_14' \
        '244f0f189ba8ab9801e7fcf553beebfb83d7c86b' \
        'autotools' \
        'n/a' \
        'baseline' \
        "$GFM_SOURCE_BASE_IMAGE"
      ;;
    4.2.*|4.3.0|4.3.0.1|4.3.1|4.3.2)
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
        'v1.2.12' \
        'e3f2b016dcd37a9a6e8a94006c7befcf2cb7bfac' \
        'cmake' \
        'ON' \
        'baseline' \
        "$GFM_SOURCE_BASE_IMAGE"
      ;;
    4.3.*)
      printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
        'v1.2.12' \
        'e3f2b016dcd37a9a6e8a94006c7befcf2cb7bfac' \
        'cmake' \
        'OFF' \
        'baseline' \
        "$GFM_SOURCE_BASE_IMAGE"
      ;;
    *) return 1 ;;
  esac
}

frozen_qb_source_identity(){
  NODE_OPTIONS='' node --input-type=module - "$VERSION" <<'NODE'
import fs from 'node:fs';
const version=process.argv[2];
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const catalog=JSON.parse(fs.readFileSync(manifest.catalogPath,'utf8'));
const profile=catalog.find(item=>String(item?.qbVersion||'')===version);
if(!profile)throw new Error(`Frozen catalog has no qB ${version} profile.`);
const expectedTag=`release-${version}`;
if(profile.tag!==expectedTag)throw new Error(`Frozen qB ${version} tag mismatch: ${profile.tag||'missing'}`);
if(!/^[0-9a-f]{40}$/i.test(String(profile.sourceSha||'')))throw new Error(`Frozen qB ${version} sourceSha is invalid.`);
process.stdout.write(`${profile.tag}\t${profile.sourceSha}\n`);
NODE
}

prepare_frozen_source_runtime(){
  local build_profile qb_identity lt_tag lt_sha lt_build lt_deprecated runtime_profile base_image qb_tag qb_sha build_dir image_tag image_id
  build_profile="$(frozen_source_build_profile)" || return 1
  IFS=$'\t' read -r lt_tag lt_sha lt_build lt_deprecated runtime_profile base_image <<<"$build_profile"
  qb_identity="$(frozen_qb_source_identity)" || {
    record_attempt frozen-official-source "qB ${VERSION}" REJECTED 'Frozen catalog source identity could not be resolved'
    return 1
  }
  IFS=$'\t' read -r qb_tag qb_sha <<<"$qb_identity"

  PROVIDER='frozen-official-source'
  MODE='source'
  SOURCE_REF="qbittorrent/${qb_tag}@${qb_sha}; libtorrent/${lt_tag}@${lt_sha}"
  PACKAGE_ID="Frozen official source build qB ${VERSION}; qbSourceSha=${qb_sha}; libtorrentSha=${lt_sha}; libtorrentDeprecated=${lt_deprecated}; runtimeProfile=${runtime_profile}; base=${base_image}"
  build_dir="$TMP_ROOT/source-build-${VERSION//./-}-${RANDOM}"
  image_tag="weig-gfm-source:${VERSION}-${qb_sha:0:12}"
  mkdir -p "$build_dir"

  cat >"$build_dir/Dockerfile" <<'DOCKER'
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
ARG DEBIAN_FRONTEND=noninteractive
ARG QB_TAG
ARG QB_SOURCE_SHA
ARG LT_TAG
ARG LT_SOURCE_SHA
ARG LT_BUILD
ARG LT_DEPRECATED
ARG QB_RUNTIME_PROFILE
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git build-essential pkg-config autoconf automake libtool cmake ninja-build \
    libssl-dev zlib1g-dev \
    libboost-dev libboost-system-dev libboost-chrono-dev libboost-random-dev \
    qtbase5-dev qttools5-dev qttools5-dev-tools libqt5svg5-dev \
    python3 curl \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "$LT_TAG" https://github.com/arvidn/libtorrent.git /src/libtorrent \
 && cd /src/libtorrent \
 && test "$(git rev-parse HEAD)" = "$LT_SOURCE_SHA" \
 && if [ "$LT_BUILD" = autotools ]; then \
      ./autotool.sh \
      && ./configure --disable-debug --enable-encryption --disable-python-binding \
      && make -j2 \
      && make install; \
    else \
      cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_STANDARD=14 -Ddeprecated-functions="$LT_DEPRECATED" \
      && cmake --build build -j2 \
      && cmake --install build; \
    fi \
 && ldconfig
RUN git clone --depth 1 --branch "$QB_TAG" https://github.com/qbittorrent/qBittorrent.git /src/qbittorrent \
 && cd /src/qbittorrent \
 && test "$(git rev-parse HEAD)" = "$QB_SOURCE_SHA" \
 && ./bootstrap.sh \
 && ./configure --disable-gui --prefix=/opt/qb \
 && make -j2 \
 && make install \
 && /opt/qb/bin/qbittorrent-nox --version
ENV PATH="/opt/qb/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/lib"
RUN mkdir -p /root/.config/qBittorrent \
 && if [ "$QB_RUNTIME_PROFILE" = 'webui-wildcard-string' ]; then \
      printf '[LegalNotice]\nAccepted=true\n[Preferences]\nWebUI\\Address=*\nWebUI\\ServerDomains=*\n' > /root/.config/qBittorrent/qBittorrent.conf; \
    else \
      printf '[LegalNotice]\nAccepted=true\n' > /root/.config/qBittorrent/qBittorrent.conf; \
    fi
ENTRYPOINT ["/opt/qb/bin/qbittorrent-nox"]
DOCKER

  if ! docker build --pull \
      --build-arg "BASE_IMAGE=$base_image" \
      --build-arg "QB_TAG=$qb_tag" \
      --build-arg "QB_SOURCE_SHA=$qb_sha" \
      --build-arg "LT_TAG=$lt_tag" \
      --build-arg "LT_SOURCE_SHA=$lt_sha" \
      --build-arg "LT_BUILD=$lt_build" \
      --build-arg "LT_DEPRECATED=$lt_deprecated" \
      --build-arg "QB_RUNTIME_PROFILE=$runtime_profile" \
      -t "$image_tag" "$build_dir"; then
    record_attempt "$PROVIDER" "$SOURCE_REF" BUILD_FAILED 'exact Frozen official-source runtime image could not be built'
    return 1
  fi

  image_id="$(docker image inspect "$image_tag" --format '{{.Id}}' 2>/dev/null || true)"
  if [[ "$image_id" != sha256:* ]]; then
    record_attempt "$PROVIDER" "$SOURCE_REF" REJECTED 'source-built image had no immutable local image ID'
    return 1
  fi
  IMAGE="$image_id"
  record_attempt "$PROVIDER" "$SOURCE_REF" BUILD_ESTABLISHED "exact Frozen qB ${VERSION} source image built as ${image_id}"
}

start_runtime(){
  NAME="weig-gfm-${VERSION//./-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
  local common=(-d -t --name "$NAME" --network "$NET")
  local -a config_args
  local use_preset=0
  if gfm_auth_lifecycle_version && [[ "$MODE" =~ ^(official|linuxserver)$ ]]; then
    prepare_modern_auth_profile || return 1
    config_args=(--mount "type=bind,src=${AUTH_PROFILE},dst=/config")
    use_preset=1
  else
    config_args=(--tmpfs /config:rw,exec,nosuid,nodev,mode=1777)
  fi
  case "$MODE" in
    official)
      if ((use_preset)); then
        docker run "${common[@]}" "${config_args[@]}" --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
          -e PUID="$(id -u)" -e PGID="$(id -g)" -e QBT_LEGAL_NOTICE=confirm -e QBT_WEBUI_PORT=8080 -e QBT_TORRENTING_PORT=6881 "$IMAGE" >/dev/null
      else
        docker run "${common[@]}" "${config_args[@]}" --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
          -e QBT_LEGAL_NOTICE=confirm -e QBT_WEBUI_PORT=8080 -e QBT_TORRENTING_PORT=6881 "$IMAGE" >/dev/null
      fi ;;
    linuxserver)
      docker run "${common[@]}" "${config_args[@]}" --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        -e PUID="$(id -u)" -e PGID="$(id -g)" -e TZ=Etc/UTC -e WEBUI_PORT=8080 -e TORRENTING_PORT=6881 "$IMAGE" >/dev/null ;;
    crazymax)
      docker run "${common[@]}" --tmpfs /data:rw,exec,nosuid,nodev,mode=1777 --ulimit nproc=65535 --ulimit nofile=32000:40000 \
        -e PUID="$(id -u)" -e PGID="$(id -g)" -e TZ=Etc/UTC -e WAN_IP=127.0.0.1 -e WEBUI_PORT=8080 "$IMAGE" >/dev/null ;;
    wernight)
      docker run "${common[@]}" "${config_args[@]}" --tmpfs /torrents:rw,nosuid,nodev,mode=1777 \
        --tmpfs /downloads:rw,nosuid,nodev,mode=1777 "$IMAGE" >/dev/null ;;
    source)
      docker run "${common[@]}" --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        "$IMAGE" --webui-port=8080 >/dev/null ;;
    *) return 1 ;;
  esac
  CONTAINER_CREATED=1
}

wait_ready(){
  local ip code state
  ip="$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || true)"
  [[ "$ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || return 1
  TARGET="http://${ip}:8080/"
  for _ in $(seq 1 60); do
    state="$(docker inspect "$NAME" --format '{{.State.Running}}' 2>/dev/null || true)"
    [[ "$state" == true ]] || return 1
    code="$(curl --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 2 "${TARGET}api/v2/app/version" || true)"
    [[ "$code" =~ ^(200|403)$ ]] && return 0
    sleep 1
  done
  return 1
}

runtime_version_with_auth(){
  local pass="$1" jar="$TMP_ROOT/cookies-${RANDOM}.txt" login_code reported
  login_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 5 --cookie-jar "$jar" \
    --data-urlencode 'username=admin' --data-urlencode "password=${pass}" \
    "${TARGET}api/v2/auth/login" || true)"
  if [[ ! "$login_code" =~ ^(200|204)$ ]] || ! gfm_cookie_jar_has_session "$jar"; then
    rm -f "$jar"
    return 1
  fi
  reported="$(curl --silent --show-error --connect-timeout 2 --max-time 5 --cookie "$jar" "${TARGET}api/v2/app/version" || true)"
  rm -f "$jar"
  [[ -n "$reported" ]] || return 1
  printf '%s' "$reported"
}

version_at_least(){
  local left="$1" right="$2" IFS='.' i l r
  local -a la=($left) ra=($right)
  for i in 0 1 2 3; do
    l="${la[$i]:-0}"; r="${ra[$i]:-0}"
    ((10#$l > 10#$r)) && return 0
    ((10#$l < 10#$r)) && return 1
  done
  return 0
}

establish_identity(){
  local reported='' temp=''
  if gfm_auth_lifecycle_version && [[ "$MODE" =~ ^(official|linuxserver)$ ]]; then
    reported="$(runtime_version_with_auth "$GFM_PRESET_PASSWORD")" || return 1
    PASSWORD="$GFM_PRESET_PASSWORD"
  elif version_at_least "$VERSION" '4.6.1'; then
    # qB 4.6.1 introduced generated temporary WebUI credentials for an unset
    # administrator password. Poll logs before any legacy fallback to avoid bans.
    for _ in $(seq 1 30); do
      temp="$(docker logs "$NAME" 2>&1 | sed -n 's/.*temporary password is provided for this session: \([^[:space:]]*\).*/\1/p' | tail -n1)"
      [[ -n "$temp" ]] && break
      sleep 1
    done
    if [[ -n "$temp" ]]; then
      reported="$(runtime_version_with_auth "$temp")" || return 1
      PASSWORD="$temp"
    else
      reported="$(runtime_version_with_auth 'adminadmin')" || return 1
      PASSWORD='adminadmin'
    fi
  else
    reported="$(runtime_version_with_auth 'adminadmin')" || return 1
    PASSWORD='adminadmin'
  fi
  reported="${reported//$'\r'/}"
  reported="${reported//$'\n'/}"
  RUNTIME_VERSION="$reported"
  if [[ "$reported" != "$VERSION" && "$reported" != "v$VERSION" ]]; then
    return 2
  fi
  RUNTIME_VERSION="$VERSION"
  local binary=''
  binary="$(docker exec "$NAME" sh -lc 'qbittorrent-nox --version 2>/dev/null || qbittorrent --version 2>/dev/null || /app/qbittorrent-nox --version 2>/dev/null || /usr/bin/qbittorrent-nox --version 2>/dev/null' | head -n1 | tr -d '\r' || true)"
  RUNTIME_IDENTITY="api=${reported}; binary=${binary:-unavailable}"

  if gfm_auth_lifecycle_version && [[ "$PASSWORD" == "$GFM_PRESET_PASSWORD" ]]; then
    WEIG_QB_URL="$TARGET" WEIG_QB_USER=admin WEIG_QB_PASS="$GFM_PRESET_PASSWORD" WEIG_QB_CHANGED_PASS="$GFM_CHANGED_PASSWORD" \
      WEIG_QB_VERSION="$VERSION" WEIG_GIT_SHA="$WEIG_SHA" WEIG_REAL_QB_EVIDENCE_DIR="$EVIDENCE_DIR" NODE_OPTIONS='' \
      node tests/real-qb-full-auth-lifecycle.mjs || return 3
    PASSWORD="$GFM_CHANGED_PASSWORD"
  fi
}

try_candidate(){
  local provider="$1" mode="$2" ref="$3" package="$4" identity_rc=0 state=''
  resolve_ref "$provider" "$mode" "$ref" "$package" || return 1
  if ! start_runtime; then
    record_attempt "$PROVIDER" "$SOURCE_REF" START_FAILED 'docker run failed under documented provider contract'
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  if ! wait_ready; then
    state="$(docker inspect "$NAME" --format 'running={{.State.Running}} exit={{.State.ExitCode}}' 2>/dev/null || true)"
    record_attempt "$PROVIDER" "$SOURCE_REF" NOT_READY "WebUI/API did not become ready; ${state:-container state unavailable}"
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  if establish_identity; then identity_rc=0; else identity_rc=$?; fi
  if ((identity_rc!=0)); then
    if ((identity_rc==2)); then
      record_attempt "$PROVIDER" "$SOURCE_REF" IDENTITY_MISMATCH "expected stable qB ${VERSION}, got ${RUNTIME_VERSION:-unknown}"
    else
      record_attempt "$PROVIDER" "$SOURCE_REF" AUTH_OR_IDENTITY_FAILED 'could not authenticate and read exact runtime version/auth lifecycle evidence'
    fi
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  record_attempt "$PROVIDER" "$SOURCE_REF" RUNTIME_ESTABLISHED "exact stable qB ${VERSION} identity established"
}

try_frozen_source_candidate(){
  local identity_rc=0 state=''
  prepare_frozen_source_runtime || return 1
  if ! start_runtime; then
    record_attempt "$PROVIDER" "$SOURCE_REF" START_FAILED 'source-built exact historical qB docker run failed'
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  if ! wait_ready; then
    state="$(docker inspect "$NAME" --format 'running={{.State.Running}} exit={{.State.ExitCode}}' 2>/dev/null || true)"
    record_attempt "$PROVIDER" "$SOURCE_REF" NOT_READY "source-built WebUI/API did not become ready; ${state:-container state unavailable}"
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  if establish_identity; then identity_rc=0; else identity_rc=$?; fi
  if ((identity_rc!=0)); then
    if ((identity_rc==2)); then
      record_attempt "$PROVIDER" "$SOURCE_REF" IDENTITY_MISMATCH "expected Frozen stable qB ${VERSION}, got ${RUNTIME_VERSION:-unknown}"
    else
      record_attempt "$PROVIDER" "$SOURCE_REF" AUTH_OR_IDENTITY_FAILED 'source-built runtime could not authenticate and prove exact qB identity'
    fi
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  record_attempt "$PROVIDER" "$SOURCE_REF" RUNTIME_ESTABLISHED "exact Frozen source-built qB ${VERSION} identity established"
}
