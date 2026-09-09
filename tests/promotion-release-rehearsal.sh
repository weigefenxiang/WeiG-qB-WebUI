#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CANDIDATE_DIR=${1:?candidate artifact directory is required}
EVIDENCE_FILE=${2:?candidate deployment evidence file is required}
CANDIDATE_DIR=$(cd "$CANDIDATE_DIR" && pwd)
EVIDENCE_FILE=$(cd "$(dirname "$EVIDENCE_FILE")" && pwd)/$(basename "$EVIDENCE_FILE")
PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"

command -v git >/dev/null || { echo 'git is required' >&2; exit 2; }
command -v node >/dev/null || { echo 'node is required' >&2; exit 2; }
command -v unzip >/dev/null || { echo 'unzip is required' >&2; exit 2; }
command -v sha256sum >/dev/null || { echo 'sha256sum is required' >&2; exit 2; }
command -v cmp >/dev/null || { echo 'cmp is required' >&2; exit 2; }
[[ -s "$PACKAGE" && -s "$SUMS" && -s "$CANDIDATE_SHA_FILE" && -s "$EVIDENCE_FILE" ]] || { echo 'Promotion rehearsal inputs are incomplete.' >&2; exit 2; }

CANDIDATE_SHA=$(tr -d '\r\n' < "$CANDIDATE_SHA_FILE" | tr 'A-F' 'a-f')
EXPECTED_SHA=${GITHUB_SHA:-$CANDIDATE_SHA}
EXPECTED_SHA=$(printf '%s' "$EXPECTED_SHA" | tr 'A-F' 'a-f')
[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ && "$EXPECTED_SHA" == "$CANDIDATE_SHA" ]] || { echo 'Promotion rehearsal exact SHA mismatch.' >&2; exit 1; }

VERSION=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/VERSION 2>/dev/null | tr -d '\r\n')
PACKAGE_GIT_SHA=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/GIT_SHA 2>/dev/null | tr -d '\r\n' | tr 'A-F' 'a-f')
PACKAGE_SUM=$(sha256sum "$PACKAGE" | awk '{print $1}' | tr 'A-F' 'a-f')
EXPECTED_SUM=$(awk '$2=="WeiG-qB-WebUI.zip" || $2=="*WeiG-qB-WebUI.zip" {print $1; exit}' "$SUMS" | tr 'A-F' 'a-f')
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Promotion rehearsal VERSION is invalid.' >&2; exit 1; }
[[ "$PACKAGE_GIT_SHA" == "$CANDIDATE_SHA" ]] || { echo 'Promotion rehearsal package GIT_SHA mismatch.' >&2; exit 1; }
[[ "$EXPECTED_SUM" =~ ^[0-9a-f]{64}$ && "$PACKAGE_SUM" == "$EXPECTED_SUM" ]] || { echo 'Promotion rehearsal candidate SHA256 mismatch.' >&2; exit 1; }

node - "$EVIDENCE_FILE" "$CANDIDATE_SHA" "$VERSION" "$PACKAGE_SUM" <<'NODE'
const fs=require('node:fs');
const [file,sha,version,packageSha]=process.argv.slice(2);
const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
if(evidence.kind!=='release-candidate-deployment-acceptance')throw new Error('deployment evidence kind mismatch');
if(String(evidence.gitSha||'').toLowerCase()!==sha)throw new Error('deployment evidence Git SHA mismatch');
if(evidence.candidate?.version!==version)throw new Error('deployment evidence VERSION mismatch');
if(String(evidence.candidate?.packageSha256||'').toLowerCase()!==packageSha)throw new Error('deployment evidence package SHA256 mismatch');
if(!evidence.checks?.browserLogin||!evidence.checks?.canonicalSettings||!evidence.checks?.alternativeWebuiPath)throw new Error('deployment evidence browser acceptance is incomplete');
NODE

cd "$ROOT"
if [[ "$(git rev-parse --is-shallow-repository)" == 'true' ]]; then
  git fetch --no-tags --unshallow origin dev
fi
git fetch --no-tags origin \
  '+refs/heads/main:refs/remotes/origin/main' \
  '+refs/heads/dev:refs/remotes/origin/dev'

MAIN_BEFORE=$(git rev-parse refs/remotes/origin/main | tr 'A-F' 'a-f')
DEV_BEFORE=$(git rev-parse refs/remotes/origin/dev | tr 'A-F' 'a-f')
[[ "$DEV_BEFORE" == "$CANDIDATE_SHA" ]] || { echo "Remote dev moved: expected $CANDIDATE_SHA, got $DEV_BEFORE" >&2; exit 1; }
git merge-base --is-ancestor "$MAIN_BEFORE" "$CANDIDATE_SHA" || { echo 'Current main is not a safe fast-forward ancestor of the candidate.' >&2; exit 1; }

REMOTE_MAIN_BEFORE=$(git ls-remote origin refs/heads/main | awk 'NR==1{print tolower($1)}')
REMOTE_DEV_BEFORE=$(git ls-remote origin refs/heads/dev | awk 'NR==1{print tolower($1)}')
REMOTE_TAG_BEFORE=$(git ls-remote origin "refs/tags/v$VERSION" | awk 'NR==1{print tolower($1)}')
[[ "$REMOTE_MAIN_BEFORE" == "$MAIN_BEFORE" && "$REMOTE_DEV_BEFORE" == "$CANDIDATE_SHA" ]] || { echo 'Remote refs changed before rehearsal began.' >&2; exit 1; }
[[ -z "$REMOTE_TAG_BEFORE" ]] || { echo "Stable tag v$VERSION already exists; refusing pre-release rehearsal." >&2; exit 1; }

TMP_REHEARSAL=$(mktemp -d)
cleanup_rehearsal(){ rm -rf "$TMP_REHEARSAL"; }
trap cleanup_rehearsal EXIT INT TERM
SIM_REPO="$TMP_REHEARSAL/rehearsal.git"
PUBLISHED="$TMP_REHEARSAL/published"
git init --bare "$SIM_REPO" >/dev/null
git -C "$SIM_REPO" fetch --quiet --no-tags "$ROOT/.git" \
  '+refs/remotes/origin/main:refs/base/main' \
  '+refs/remotes/origin/dev:refs/base/dev'
git -C "$SIM_REPO" update-ref refs/heads/main "$MAIN_BEFORE"
git -C "$SIM_REPO" update-ref refs/heads/dev "$CANDIDATE_SHA"
git -C "$SIM_REPO" merge-base --is-ancestor refs/heads/main refs/heads/dev

# Simulate the production safe fast-forward with compare-and-swap semantics.
git -C "$SIM_REPO" update-ref refs/heads/main "$CANDIDATE_SHA" "$MAIN_BEFORE"
SIM_MAIN_PROMOTED=$(git -C "$SIM_REPO" rev-parse refs/heads/main | tr 'A-F' 'a-f')
[[ "$SIM_MAIN_PROMOTED" == "$CANDIDATE_SHA" ]] || { echo 'Simulated promotion did not land on the exact candidate.' >&2; exit 1; }

# Simulate release identity only; no remote tag is created.
git -C "$SIM_REPO" update-ref "refs/tags/v$VERSION" "$CANDIDATE_SHA"
SIM_TAG=$(git -C "$SIM_REPO" rev-parse "refs/tags/v$VERSION" | tr 'A-F' 'a-f')
[[ "$SIM_TAG" == "$SIM_MAIN_PROMOTED" && "$SIM_TAG" == "$CANDIDATE_SHA" ]] || { echo 'Simulated tag/main/candidate identity diverged.' >&2; exit 1; }

# A release must publish byte-identical candidate files, never rebuild them.
mkdir -p "$PUBLISHED"
cp "$PACKAGE" "$PUBLISHED/WeiG-qB-WebUI.zip"
cp "$SUMS" "$PUBLISHED/SHA256SUMS"
cp "$CANDIDATE_SHA_FILE" "$PUBLISHED/CANDIDATE_SHA"
cmp -s "$PACKAGE" "$PUBLISHED/WeiG-qB-WebUI.zip"
cmp -s "$SUMS" "$PUBLISHED/SHA256SUMS"
cmp -s "$CANDIDATE_SHA_FILE" "$PUBLISHED/CANDIDATE_SHA"
PUBLISHED_SUM=$(sha256sum "$PUBLISHED/WeiG-qB-WebUI.zip" | awk '{print $1}' | tr 'A-F' 'a-f')
[[ "$PUBLISHED_SUM" == "$PACKAGE_SUM" ]] || { echo 'Simulated release artifact bytes changed.' >&2; exit 1; }

# Rehearse rollback only inside the temporary bare repository.
git -C "$SIM_REPO" update-ref -d "refs/tags/v$VERSION" "$CANDIDATE_SHA"
git -C "$SIM_REPO" update-ref refs/heads/main "$MAIN_BEFORE" "$CANDIDATE_SHA"
SIM_MAIN_ROLLED_BACK=$(git -C "$SIM_REPO" rev-parse refs/heads/main | tr 'A-F' 'a-f')
[[ "$SIM_MAIN_ROLLED_BACK" == "$MAIN_BEFORE" ]] || { echo 'Simulated rollback did not restore the original main baseline.' >&2; exit 1; }
[[ ! -e "$SIM_REPO/refs/tags/v$VERSION" ]] || { echo 'Simulated rollback left the release tag behind.' >&2; exit 1; }

REMOTE_MAIN_AFTER=$(git ls-remote origin refs/heads/main | awk 'NR==1{print tolower($1)}')
REMOTE_DEV_AFTER=$(git ls-remote origin refs/heads/dev | awk 'NR==1{print tolower($1)}')
REMOTE_TAG_AFTER=$(git ls-remote origin "refs/tags/v$VERSION" | awk 'NR==1{print tolower($1)}')
[[ "$REMOTE_MAIN_AFTER" == "$REMOTE_MAIN_BEFORE" ]] || { echo 'Remote main changed during isolated rehearsal.' >&2; exit 1; }
[[ "$REMOTE_DEV_AFTER" == "$REMOTE_DEV_BEFORE" ]] || { echo 'Remote dev changed during isolated rehearsal.' >&2; exit 1; }
[[ "$REMOTE_TAG_AFTER" == "$REMOTE_TAG_BEFORE" ]] || { echo 'Remote stable tag state changed during isolated rehearsal.' >&2; exit 1; }

export EVIDENCE_FILE CANDIDATE_SHA VERSION PACKAGE_SUM MAIN_BEFORE DEV_BEFORE SIM_MAIN_PROMOTED SIM_TAG SIM_MAIN_ROLLED_BACK REMOTE_MAIN_AFTER REMOTE_DEV_AFTER
node <<'NODE'
const fs=require('node:fs');
const file=process.env.EVIDENCE_FILE;
const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
evidence.promotionReleaseRehearsal={
  isolated:true,
  remoteWrites:0,
  candidateSha:process.env.CANDIDATE_SHA,
  version:process.env.VERSION,
  packageSha256:process.env.PACKAGE_SUM,
  mainBefore:process.env.MAIN_BEFORE,
  devBefore:process.env.DEV_BEFORE,
  simulatedMainAfterPromotion:process.env.SIM_MAIN_PROMOTED,
  simulatedTag:`v${process.env.VERSION}`,
  simulatedTagSha:process.env.SIM_TAG,
  simulatedMainAfterRollback:process.env.SIM_MAIN_ROLLED_BACK,
  remoteMainAfter:process.env.REMOTE_MAIN_AFTER,
  remoteDevAfter:process.env.REMOTE_DEV_AFTER,
  checks:{
    currentDevExactCandidate:true,
    mainFastForwardable:true,
    stableTagInitiallyAbsent:true,
    deploymentEvidenceIdentity:true,
    simulatedPromotionExactSha:true,
    simulatedReleaseTagExactSha:true,
    releaseArtifactByteIdentity:true,
    simulatedRollbackRestoresMain:true,
    remoteRefsUntouched:true
  }
};
fs.writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');
NODE

printf 'Promotion/release rehearsal passed: main %s -> %s -> %s, simulated tag v%s, exact candidate SHA256 %s, zero remote writes\n' \
  "$MAIN_BEFORE" "$CANDIDATE_SHA" "$SIM_MAIN_ROLLED_BACK" "$VERSION" "$PACKAGE_SUM"
