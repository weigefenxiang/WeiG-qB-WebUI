#!/usr/bin/env bash
set -Eeuo pipefail
VERSION=''
while (($#)); do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$VERSION" =~ ^4\.1\.9(\.1)?$ ]] || { echo "--version must be 4.1.9 or 4.1.9.1" >&2; exit 2; }
for cmd in bash node setsid; do command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 2; }; done
WEIG_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
[[ "$WEIG_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "Exact Git SHA is required" >&2; exit 2; }
ROOT="${WEIG_SESSION_RACE_DIR:-artifacts/session-handshake-race}/${WEIG_SHA}-${VERSION}"
mkdir -p "$ROOT"
RESULTS="$ROOT/lane-results.tsv"
: > "$RESULTS"
RACE_STARTED="$(date +%s)"
lanes=(images indexed source)
declare -A PID_LANE PID_STARTED
active=()

start_lane(){
  local lane="$1" dir="$ROOT/$lane" pid
  mkdir -p "$dir"
  printf '[race][qB %s] start lane=%s\n' "$VERSION" "$lane"
  setsid env WEIG_REAL_QB_EVIDENCE_DIR="$dir" \
    bash tests/real-qb-full-runner.sh --version "$VERSION" --allow-writes --session-handshake --provider-lane "$lane" \
    > >(sed -u "s/^/[lane:$lane] /" | tee "$dir/lane.log") 2>&1 &
  pid=$!
  PID_LANE["$pid"]="$lane"
  PID_STARTED["$pid"]="$(date +%s)"
  active+=("$pid")
}
stop_lane(){
  local pid="$1"
  kill -TERM -- "-$pid" >/dev/null 2>&1 || true
}
cleanup_all(){
  local pid
  for pid in "${active[@]:-}"; do [[ -n "${PID_LANE[$pid]:-}" ]] && stop_lane "$pid"; done
}
trap cleanup_all INT TERM

for lane in "${lanes[@]}"; do start_lane "$lane"; done
winner=''
winner_pid=''
saw_failure=0
while (("${#active[@]}" > 0)); do
  finished=''
  set +e
  wait -n -p finished "${active[@]}"
  rc=$?
  set -e
  lane="${PID_LANE[$finished]:-unknown}"
  elapsed="$(( $(date +%s) - ${PID_STARTED[$finished]:-$RACE_STARTED} ))"
  printf '%s\t%s\t%s\n' "$lane" "$rc" "$elapsed" >> "$RESULTS"
  printf '[race][qB %s] lane=%s exit=%s elapsed=%ss\n' "$VERSION" "$lane" "$rc" "$elapsed"
  next=()
  for pid in "${active[@]}"; do [[ "$pid" != "$finished" ]] && next+=("$pid"); done
  active=("${next[@]}")
  unset 'PID_LANE[$finished]' 'PID_STARTED[$finished]'
  if ((rc==0)); then winner="$lane"; winner_pid="$finished"; break; fi
  ((rc==1)) && saw_failure=1
done

if [[ -n "$winner" ]]; then
  for pid in "${active[@]:-}"; do
    lane="${PID_LANE[$pid]:-unknown}"
    stop_lane "$pid"
    started="${PID_STARTED[$pid]:-$RACE_STARTED}"
    set +e; wait "$pid"; rc=$?; set -e
    printf '%s\t%s\t%s\n' "$lane" "$rc" "$(( $(date +%s)-started ))" >> "$RESULTS"
  done
  active=()
fi

WEIG_RACE_ROOT="$ROOT" WEIG_RACE_WINNER="$winner" WEIG_RACE_VERSION="$VERSION" WEIG_RACE_SHA="$WEIG_SHA" WEIG_RACE_RESULTS="$RESULTS" WEIG_RACE_DURATION="$(( $(date +%s)-RACE_STARTED ))" node --input-type=module <<'NODE'
import fs from 'node:fs'; import path from 'node:path';
const root=process.env.WEIG_RACE_ROOT,winner=process.env.WEIG_RACE_WINNER,version=process.env.WEIG_RACE_VERSION,sha=process.env.WEIG_RACE_SHA.toLowerCase();
const rows=fs.readFileSync(process.env.WEIG_RACE_RESULTS,'utf8').trim().split('\n').filter(Boolean).map(line=>{const [lane,exit_code,duration_seconds]=line.split('\t');return {lane,exit_code:Number(exit_code),duration_seconds:Number(duration_seconds)};});
const summary={schemaVersion:1,module:'session-handshake-provider-race',weig_sha:sha,qb_version:version,winner:winner||null,duration_seconds:Number(process.env.WEIG_RACE_DURATION||0),lanes:rows};
if(winner){
  const dir=path.join(root,winner),files=fs.readdirSync(dir);
  const runtimeFile=files.find(name=>name.endsWith('-runtime.json')),handshakeFile=files.find(name=>name.endsWith('-session-handshake.json'));
  if(!runtimeFile||!handshakeFile)throw new Error('Winning lane did not publish runtime + session handshake evidence.');
  const runtime=JSON.parse(fs.readFileSync(path.join(dir,runtimeFile),'utf8')),handshake=JSON.parse(fs.readFileSync(path.join(dir,handshakeFile),'utf8'));
  if(runtime.weig_sha!==sha||runtime.expected_qb_version!==version||runtime.provider_lane!==winner||runtime.status!=='PASS')throw new Error('Winning runtime evidence identity/status mismatch.');
  if(handshake.weig_sha!==sha||handshake.qb_version!==version||handshake.capture_status!=='CAPTURED'||handshake.session_contract_status!=='PASS')throw new Error('Winning session handshake evidence identity/status mismatch.');
  summary.provider=runtime.provider||null; summary.source_ref=runtime.source_ref||null; summary.runtime_duration_seconds=runtime.duration_seconds||null;
}
fs.writeFileSync(path.join(root,'race-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
NODE

if [[ -n "$winner" ]]; then
  printf '[race][qB %s] PASS winner=%s total=%ss\n' "$VERSION" "$winner" "$(( $(date +%s)-RACE_STARTED ))"
  exit 0
fi
if ((saw_failure)); then
  echo "[race][qB $VERSION] no provider lane passed; at least one established runtime failed the session contract." >&2
  exit 1
fi
echo "[race][qB $VERSION] no provider lane could establish an approved exact runtime." >&2
exit 3
