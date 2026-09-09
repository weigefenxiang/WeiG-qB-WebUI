# Sourced by real-qb-full-runner.sh. Uses the runner's exact-version globals.
readonly GFM_PRESET_PASSWORD='Wei.G'
readonly GFM_CHANGED_PASSWORD='Wei.G1'

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
