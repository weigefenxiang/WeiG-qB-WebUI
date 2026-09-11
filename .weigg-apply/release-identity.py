from pathlib import Path

ROOT=Path('.')

def replace_exact(path, old, new, count=1):
    p=ROOT/path
    text=p.read_text(encoding='utf-8')
    found=text.count(old)
    if found != count:
        raise SystemExit(f'{path}: expected {count} matches, found {found}')
    p.write_text(text.replace(old,new,count),encoding='utf-8',newline='\n')

# Linux: resolve one immutable Release tag first, then bind tag -> VERSION -> GIT_SHA.
old_linux='''if [ "$CHANNEL" = "release" ]; then
  if [ -n "$RELEASE_VERSION" ]; then
    RELEASE_BASE="https://github.com/$REPO/releases/download/$RELEASE_TAG"
    RELEASE_LABEL="Release $RELEASE_TAG"
  else
    RELEASE_BASE="https://github.com/$REPO/releases/latest/download"
    RELEASE_LABEL="latest GitHub Release"
  fi
  RELEASE_URL="$RELEASE_BASE/WeiG-qB-WebUI.zip"
  SUM_URL="$RELEASE_BASE/SHA256SUMS"

  download_file "$RELEASE_URL" "$PACKAGE" || {
    if [ -n "$RELEASE_VERSION" ]; then
      echo "Release $RELEASE_TAG was not found or WeiG-qB-WebUI.zip is unavailable. Refusing to fall back to latest or dev." >&2
    else
      echo "No published stable GitHub Release is available. Release installation will not fall back to a branch archive." >&2
    fi
    exit 1
  }
  download_file "$SUM_URL" "$TMP/SHA256SUMS" || {
    echo "$RELEASE_LABEL is missing SHA256SUMS; refusing an unverified installation." >&2
    exit 1
  }
  [ -s "$TMP/SHA256SUMS" ] || { echo "SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE"
  extract_zip "$PACKAGE" "$TMP/release"
  SRC="$TMP/release/WeiG-qB-WebUI"
  SOURCE_SHA=$(cat "$SRC/GIT_SHA" 2>/dev/null | tr -d '\\r\\n' || true)
  valid_sha "$SOURCE_SHA" || { echo "$RELEASE_LABEL does not contain a valid GIT_SHA; refusing an unversioned asset deployment." >&2; exit 1; }
  if [ -n "$RELEASE_VERSION" ]; then
    PACKAGE_VERSION=$(cat "$SRC/VERSION" 2>/dev/null | tr -d '\\r\\n' || true)
    [ "$PACKAGE_VERSION" = "$RELEASE_VERSION" ] || {
      echo "Requested $RELEASE_TAG but the package reports VERSION=$PACKAGE_VERSION; refusing mismatched Release content." >&2
      exit 1
    }
  fi
  echo "Source: $RELEASE_LABEL (checksum verified)"
else'''
new_linux='''if [ "$CHANNEL" = "release" ]; then
  REQUESTED_RELEASE_VERSION="$RELEASE_VERSION"
  REQUESTED_RELEASE_TAG="$RELEASE_TAG"
  RELEASE_META="$TMP/release.json"
  if [ -n "$REQUESTED_RELEASE_VERSION" ]; then
    RELEASE_META_URL="https://api.github.com/repos/$REPO/releases/tags/$REQUESTED_RELEASE_TAG"
  else
    RELEASE_META_URL="https://api.github.com/repos/$REPO/releases/latest"
  fi

  download_file "$RELEASE_META_URL" "$RELEASE_META" || {
    if [ -n "$REQUESTED_RELEASE_VERSION" ]; then
      echo "Release $REQUESTED_RELEASE_TAG was not found. Refusing to fall back to latest or dev." >&2
    else
      echo "No published stable GitHub Release is available. Release installation will not fall back to a branch archive." >&2
    fi
    exit 1
  }
  RESOLVED_RELEASE_TAG=$(sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$RELEASE_META" | head -n1)
  printf '%s' "$RESOLVED_RELEASE_TAG" | grep -Eq '^v[0-9]+\\.[0-9]+\\.[0-9]+$' || {
    echo "GitHub Release metadata returned an invalid tag: ${RESOLVED_RELEASE_TAG:-<empty>}." >&2
    exit 1
  }
  if [ -n "$REQUESTED_RELEASE_TAG" ] && [ "$RESOLVED_RELEASE_TAG" != "$REQUESTED_RELEASE_TAG" ]; then
    echo "Requested $REQUESTED_RELEASE_TAG but GitHub Release metadata resolved $RESOLVED_RELEASE_TAG; refusing mismatched Release identity." >&2
    exit 1
  fi
  RESOLVED_RELEASE_VERSION=${RESOLVED_RELEASE_TAG#v}

  RELEASE_COMMIT_META="$TMP/release-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/$RESOLVED_RELEASE_TAG" "$RELEASE_COMMIT_META" || {
    echo "Unable to resolve commit identity for Release $RESOLVED_RELEASE_TAG." >&2
    exit 1
  }
  RELEASE_EXPECTED_SHA=$(sed -n 's/^[[:space:]]*"sha"[[:space:]]*:[[:space:]]*"\\([0-9a-fA-F]\\{40\\}\\)".*/\\1/p' "$RELEASE_COMMIT_META" | head -n1 | tr 'A-F' 'a-f')
  valid_sha "$RELEASE_EXPECTED_SHA" || { echo "Release $RESOLVED_RELEASE_TAG did not resolve to a valid commit SHA." >&2; exit 1; }

  RELEASE_TAG="$RESOLVED_RELEASE_TAG"
  RELEASE_VERSION="$RESOLVED_RELEASE_VERSION"
  RELEASE_BASE="https://github.com/$REPO/releases/download/$RELEASE_TAG"
  RELEASE_LABEL="Release $RELEASE_TAG"
  RELEASE_URL="$RELEASE_BASE/WeiG-qB-WebUI.zip"
  SUM_URL="$RELEASE_BASE/SHA256SUMS"

  download_file "$RELEASE_URL" "$PACKAGE" || {
    echo "$RELEASE_LABEL does not contain WeiG-qB-WebUI.zip. Refusing to fall back to another Release or branch." >&2
    exit 1
  }
  download_file "$SUM_URL" "$TMP/SHA256SUMS" || {
    echo "$RELEASE_LABEL is missing SHA256SUMS; refusing an unverified installation." >&2
    exit 1
  }
  [ -s "$TMP/SHA256SUMS" ] || { echo "SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE"
  extract_zip "$PACKAGE" "$TMP/release"
  SRC="$TMP/release/WeiG-qB-WebUI"
  SOURCE_SHA=$(cat "$SRC/GIT_SHA" 2>/dev/null | tr -d '\\r\\n' | tr 'A-F' 'a-f' || true)
  valid_sha "$SOURCE_SHA" || { echo "$RELEASE_LABEL does not contain a valid GIT_SHA; refusing an unversioned asset deployment." >&2; exit 1; }
  PACKAGE_VERSION=$(cat "$SRC/VERSION" 2>/dev/null | tr -d '\\r\\n' || true)
  [ "$PACKAGE_VERSION" = "$RELEASE_VERSION" ] || {
    echo "$RELEASE_LABEL maps to VERSION=$RELEASE_VERSION but the package reports VERSION=$PACKAGE_VERSION; refusing mismatched Release content." >&2
    exit 1
  }
  [ "$SOURCE_SHA" = "$RELEASE_EXPECTED_SHA" ] || {
    echo "$RELEASE_LABEL points to Git SHA $RELEASE_EXPECTED_SHA but the package reports GIT_SHA=$SOURCE_SHA; refusing mismatched Release content." >&2
    exit 1
  }
  echo "Source: $RELEASE_LABEL at $RELEASE_EXPECTED_SHA (checksum and Release identity verified)"
else'''
replace_exact('installers/install.sh',old_linux,new_linux)

# Windows: same immutable Release metadata/tag/commit identity chain.
old_ps='''  if($Channel -eq 'Release'){
    if($releaseVersion){
      $releaseBase="https://github.com/$Repo/releases/download/$releaseTag"
      $releaseLabel="Release $releaseTag"
    } else {
      $releaseBase="https://github.com/$Repo/releases/latest/download"
      $releaseLabel='latest GitHub Release'
    }

    try {
      Invoke-WebRequest -UseBasicParsing "$releaseBase/WeiG-qB-WebUI.zip" -OutFile $archive
    } catch {
      if($releaseVersion){
        throw "Release $releaseTag was not found or WeiG-qB-WebUI.zip is unavailable. Refusing to fall back to latest or dev."
      }
      throw 'No published stable GitHub Release is available. Release installation will not fall back to a branch archive.'
    }

    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {
      Invoke-WebRequest -UseBasicParsing "$releaseBase/SHA256SUMS" -OutFile $sumFile
    } catch {
      throw "$releaseLabel is missing SHA256SUMS; refusing an unverified installation."
    }
    Verify-PackageChecksum $archive $sumFile

    $root=Join-Path $tmp 'release'
    Expand-Archive $archive $root -Force
    $web=Join-Path $root 'WeiG-qB-WebUI'
    $shaFile=Join-Path $web 'GIT_SHA'
    if(!(Test-Path $shaFile)){throw "$releaseLabel does not contain GIT_SHA; refusing an unversioned asset deployment."}
    $sourceSha=(Get-Content $shaFile -Raw).Trim()
    if($sourceSha -notmatch '^[0-9a-fA-F]{40}$'){throw "$releaseLabel contains an invalid GIT_SHA."}
    if($releaseVersion){
      $packageVersion=(Get-Content (Join-Path $web 'VERSION') -Raw).Trim()
      if($packageVersion -ne $releaseVersion){
        throw "Requested $releaseTag but the package reports VERSION=$packageVersion; refusing mismatched Release content."
      }
    }
    Assert-MaterializedWebUI $web
    Write-Host "Source: $releaseLabel (checksum verified, materialized WebUI)"
  } else {'''
new_ps='''  if($Channel -eq 'Release'){
    $requestedReleaseVersion=$releaseVersion
    $requestedReleaseTag=$releaseTag
    $apiHeaders=@{'User-Agent'='WeiG-qB-WebUI-installer'}
    try {
      if($requestedReleaseVersion){
        $releaseMeta=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/releases/tags/$requestedReleaseTag"
      } else {
        $releaseMeta=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/releases/latest"
      }
    } catch {
      if($requestedReleaseVersion){throw "Release $requestedReleaseTag was not found. Refusing to fall back to latest or dev."}
      throw 'No published stable GitHub Release is available. Release installation will not fall back to a branch archive.'
    }

    $resolvedReleaseTag=[string]$releaseMeta.tag_name
    if($resolvedReleaseTag -notmatch '^v(\\d+\\.\\d+\\.\\d+)$'){throw "GitHub Release metadata returned an invalid tag: $resolvedReleaseTag"}
    $resolvedReleaseVersion=$Matches[1]
    if($requestedReleaseTag -and $resolvedReleaseTag -ne $requestedReleaseTag){
      throw "Requested $requestedReleaseTag but GitHub Release metadata resolved $resolvedReleaseTag; refusing mismatched Release identity."
    }
    try {
      $releaseCommit=Invoke-RestMethod -UseBasicParsing -Headers $apiHeaders "https://api.github.com/repos/$Repo/commits/$resolvedReleaseTag"
    } catch {
      throw "Unable to resolve commit identity for Release $resolvedReleaseTag."
    }
    $releaseExpectedSha=([string]$releaseCommit.sha).ToLowerInvariant()
    if($releaseExpectedSha -notmatch '^[0-9a-f]{40}$'){throw "Release $resolvedReleaseTag did not resolve to a valid commit SHA."}

    $releaseTag=$resolvedReleaseTag
    $releaseVersion=$resolvedReleaseVersion
    $releaseBase="https://github.com/$Repo/releases/download/$releaseTag"
    $releaseLabel="Release $releaseTag"

    try {
      Invoke-WebRequest -UseBasicParsing "$releaseBase/WeiG-qB-WebUI.zip" -OutFile $archive
    } catch {
      throw "$releaseLabel does not contain WeiG-qB-WebUI.zip. Refusing to fall back to another Release or branch."
    }

    $sumFile=Join-Path $tmp 'SHA256SUMS'
    try {
      Invoke-WebRequest -UseBasicParsing "$releaseBase/SHA256SUMS" -OutFile $sumFile
    } catch {
      throw "$releaseLabel is missing SHA256SUMS; refusing an unverified installation."
    }
    Verify-PackageChecksum $archive $sumFile

    $root=Join-Path $tmp 'release'
    Expand-Archive $archive $root -Force
    $web=Join-Path $root 'WeiG-qB-WebUI'
    $shaFile=Join-Path $web 'GIT_SHA'
    if(!(Test-Path $shaFile)){throw "$releaseLabel does not contain GIT_SHA; refusing an unversioned asset deployment."}
    $sourceSha=(Get-Content $shaFile -Raw).Trim().ToLowerInvariant()
    if($sourceSha -notmatch '^[0-9a-f]{40}$'){throw "$releaseLabel contains an invalid GIT_SHA."}
    $versionFile=Join-Path $web 'VERSION'
    if(!(Test-Path $versionFile)){throw "$releaseLabel does not contain VERSION; refusing an unversioned asset deployment."}
    $packageVersion=(Get-Content $versionFile -Raw).Trim()
    if($packageVersion -ne $releaseVersion){
      throw "$releaseLabel maps to VERSION=$releaseVersion but the package reports VERSION=$packageVersion; refusing mismatched Release content."
    }
    if($sourceSha -ne $releaseExpectedSha){
      throw "$releaseLabel points to Git SHA $releaseExpectedSha but the package reports GIT_SHA=$sourceSha; refusing mismatched Release content."
    }
    Assert-MaterializedWebUI $web
    Write-Host "Source: $releaseLabel at $releaseExpectedSha (checksum and Release identity verified, materialized WebUI)"
  } else {'''
replace_exact('installers/install.ps1',old_ps,new_ps)

# Candidate acceptance mock must exercise exact Release identity APIs for the dev candidate.
p=ROOT/'tests/candidate-deployment.sh'
t=p.read_text(encoding='utf-8')
old_mock='''case "$url" in
  */releases/download/v"$WEIG_CANDIDATE_VERSION"/WeiG-qB-WebUI.zip)
    src="$WEIG_CANDIDATE_PACKAGE"
    ;;
  */releases/download/v"$WEIG_CANDIDATE_VERSION"/SHA256SUMS)
    src="$WEIG_CANDIDATE_SUMS"
    ;;
  *)
    echo "candidate mock curl: unexpected URL: $url" >&2
    exit 22
    ;;
esac
cp "$src" "$out"'''
new_mock='''case "$url" in
  */releases/tags/v"$WEIG_CANDIDATE_VERSION")
    printf '{"tag_name":"v%s"}\\n' "$WEIG_CANDIDATE_VERSION" > "$out"
    exit 0
    ;;
  */commits/v"$WEIG_CANDIDATE_VERSION")
    printf '{"sha":"%s"}\\n' "$WEIG_CANDIDATE_SHA" > "$out"
    exit 0
    ;;
  */releases/download/v"$WEIG_CANDIDATE_VERSION"/WeiG-qB-WebUI.zip)
    src="$WEIG_CANDIDATE_PACKAGE"
    ;;
  */releases/download/v"$WEIG_CANDIDATE_VERSION"/SHA256SUMS)
    src="$WEIG_CANDIDATE_SUMS"
    ;;
  *)
    echo "candidate mock curl: unexpected URL: $url" >&2
    exit 22
    ;;
esac
cp "$src" "$out"'''
if t.count(old_mock)!=1: raise SystemExit('candidate mock anchor mismatch')
t=t.replace(old_mock,new_mock)
old_exports='''export WEIG_CANDIDATE_VERSION="$VERSION"
export WEIG_CANDIDATE_PACKAGE="$PACKAGE"
export WEIG_CANDIDATE_SUMS="$SUMS"
export PATH="$MOCK_BIN:$PATH"'''
new_exports='''export WEIG_CANDIDATE_VERSION="$VERSION"
export WEIG_CANDIDATE_SHA="$EXPECTED_SHA"
export WEIG_CANDIDATE_PACKAGE="$PACKAGE"
export WEIG_CANDIDATE_SUMS="$SUMS"
export PATH="$MOCK_BIN:$PATH"'''
if t.count(old_exports)!=1: raise SystemExit('candidate export anchor mismatch')
t=t.replace(old_exports,new_exports)
p.write_text(t,encoding='utf-8',newline='\n')

# Platform contract now requires immutable Release identity resolution on both platforms.
p=ROOT/'tests/platform-contract.mjs'
t=p.read_text(encoding='utf-8')
t=t.replace("const live=fs.readFileSync(path.join(root,'tests/live.sh'),'utf8');", "const live=fs.readFileSync(path.join(root,'tests/live.sh'),'utf8');\nconst candidateDeployment=fs.readFileSync(path.join(root,'tests/candidate-deployment.sh'),'utf8');")
t=t.replace("assert.match(sh,/releases\\/latest\\/download/,'Linux default Release channel must consume latest Release assets');\nassert.match(sh,/releases\\/download\\/\\$RELEASE_TAG/,'Linux installer must support exact tagged Release assets');\nassert.match(sh,/PACKAGE_VERSION/,'Linux exact Release install must verify package VERSION');", "assert.match(sh,/api\\.github\\.com\\/repos\\/\\$REPO\\/releases\\/latest/,'Linux latest install must resolve one concrete GitHub Release tag before downloading assets');\nassert.match(sh,/api\\.github\\.com\\/repos\\/\\$REPO\\/releases\\/tags\\/\\$REQUESTED_RELEASE_TAG/,'Linux exact version install must resolve Release metadata for the requested tag');\nassert.match(sh,/releases\\/download\\/\\$RELEASE_TAG/,'Linux installer must pin asset downloads to the resolved exact Release tag');\nassert.match(sh,/api\\.github\\.com\\/repos\\/\\$REPO\\/commits\\/\\$RESOLVED_RELEASE_TAG/,'Linux Release install must resolve the tag to an exact commit SHA');\nassert.match(sh,/PACKAGE_VERSION.*RELEASE_VERSION|RELEASE_VERSION.*PACKAGE_VERSION/s,'Linux Release install must bind package VERSION to the resolved tag version');\nassert.match(sh,/SOURCE_SHA.*RELEASE_EXPECTED_SHA|RELEASE_EXPECTED_SHA.*SOURCE_SHA/s,'Linux Release install must bind package GIT_SHA to the resolved tag commit');")
t=t.replace("assert.match(ps,/releases\\/latest\\/download/,'Windows default Release channel must consume latest Release assets');\nassert.match(ps,/releases\\/download\\/\\$releaseTag/,'Windows installer must support exact tagged Release assets');\nassert.match(ps,/packageVersion/,'Windows exact Release install must verify package VERSION');", "assert.match(ps,/api\\.github\\.com\\/repos\\/\\$Repo\\/releases\\/latest/,'Windows latest install must resolve one concrete GitHub Release tag before downloading assets');\nassert.match(ps,/api\\.github\\.com\\/repos\\/\\$Repo\\/releases\\/tags\\/\\$requestedReleaseTag/,'Windows exact version install must resolve Release metadata for the requested tag');\nassert.match(ps,/releases\\/download\\/\\$releaseTag/,'Windows installer must pin asset downloads to the resolved exact Release tag');\nassert.match(ps,/api\\.github\\.com\\/repos\\/\\$Repo\\/commits\\/\\$resolvedReleaseTag/,'Windows Release install must resolve the tag to an exact commit SHA');\nassert.match(ps,/packageVersion.*releaseVersion|releaseVersion.*packageVersion/s,'Windows Release install must bind package VERSION to the resolved tag version');\nassert.match(ps,/sourceSha.*releaseExpectedSha|releaseExpectedSha.*sourceSha/s,'Windows Release install must bind package GIT_SHA to the resolved tag commit');")
insert="""\nassert.match(candidateDeployment,/releases\\/tags\\/v\"\\$WEIG_CANDIDATE_VERSION\"/,'Candidate deployment must mock the exact Release tag metadata used by the artifact installer');
assert.match(candidateDeployment,/commits\\/v\"\\$WEIG_CANDIDATE_VERSION\"/,'Candidate deployment must mock the exact Release tag commit identity');
assert.match(candidateDeployment,/WEIG_CANDIDATE_SHA=\"\\$EXPECTED_SHA\"/,'Candidate deployment must bind mocked Release commit identity to the candidate SHA');
"""
anchor="assert.doesNotMatch(ps,/Resolve-MainSha/,'Windows Release channel must not resolve main as a payload source');\n"
if t.count(anchor)!=1: raise SystemExit('platform insertion anchor mismatch')
t=t.replace(anchor,anchor+insert)
t=t.replace("console.log('Platform contract passed: Linux/Windows Dev consume one exact-SHA materialized qB-aware translation payload with raw-source fallback forbidden, Windows qB config mutation preserves original text encoding, installers preserve simplified version/dev/output/configure/rollback semantics and legacy aliases, and LIVE rollback retention remains capped at three backups.');", "console.log('Platform contract passed: Linux/Windows Release installs pin one concrete tag and require tag/VERSION/GIT_SHA identity; Dev consumes one exact-SHA materialized qB-aware payload with raw-source fallback forbidden; Windows qB config mutation preserves original text encoding; installer compatibility and LIVE rollback retention remain guarded.');")
p.write_text(t,encoding='utf-8',newline='\n')

print('Release tag/VERSION/GIT_SHA identity patch applied.')
