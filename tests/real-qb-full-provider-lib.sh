# Sourced by real-qb-full-runner.sh. Uses the runner's exact-version globals.
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
  case "$MODE" in
    official)
      docker run "${common[@]}" --tmpfs /config:rw,exec,nosuid,nodev,mode=1777 --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        -e QBT_LEGAL_NOTICE=confirm -e QBT_WEBUI_PORT=8080 -e QBT_TORRENTING_PORT=6881 "$IMAGE" >/dev/null ;;
    linuxserver)
      docker run "${common[@]}" --tmpfs /config:rw,exec,nosuid,nodev,mode=1777 --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
        -e PUID="$(id -u)" -e PGID="$(id -g)" -e TZ=Etc/UTC -e WEBUI_PORT=8080 -e TORRENTING_PORT=6881 "$IMAGE" >/dev/null ;;
    crazymax)
      docker run "${common[@]}" --tmpfs /data:rw,exec,nosuid,nodev,mode=1777 --ulimit nproc=65535 --ulimit nofile=32000:40000 \
        -e PUID="$(id -u)" -e PGID="$(id -g)" -e TZ=Etc/UTC -e WAN_IP=127.0.0.1 -e WEBUI_PORT=8080 "$IMAGE" >/dev/null ;;
    wernight)
      docker run "${common[@]}" --tmpfs /config:rw,exec,nosuid,nodev,mode=1777 --tmpfs /torrents:rw,nosuid,nodev,mode=1777 \
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
  if [[ ! "$login_code" =~ ^(200|204)$ ]] || ! grep -Eq '(^|[[:space:]])QBT_SID_[^[:space:]]*[[:space:]]' "$jar" 2>/dev/null; then
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
  # qB 4.6.1 introduced generated temporary WebUI credentials for an unset
  # administrator password. Older stable releases retain legacy admin/adminadmin.
  if version_at_least "$VERSION" '4.6.1'; then
    # Certified representative behavior: poll logs first without sending any
    # wrong-password login attempts. Modern qB may ban repeated failed logins.
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
      record_attempt "$PROVIDER" "$SOURCE_REF" AUTH_OR_IDENTITY_FAILED 'could not authenticate and read exact runtime version'
    fi
    cleanup_container >/dev/null 2>&1 || true; return 1
  fi
  record_attempt "$PROVIDER" "$SOURCE_REF" RUNTIME_ESTABLISHED "exact stable qB ${VERSION} identity established"
}
